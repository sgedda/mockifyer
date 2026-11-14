/**
 * Tests for drift management: history tracking, accept, snooze, ignore-field.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import {
  checkDrift,
  acceptDrift,
  acceptAllWarnings,
  snoozeEndpoint,
  addIgnoreField,
  loadDriftHistory,
  writeDriftHistory,
  enhanceReportWithHistory,
  DriftHistoryReport,
} from '@sgedda/mockifyer-core/utils/drift';
import { MockData } from '@sgedda/mockifyer-core';

describe('drift-management', () => {
  let server: http.Server;
  let serverPort: number;
  let testDir: string;

  beforeAll((done) => {
    server = http.createServer((req, res) => {
      const url = req.url || '';

      const pathname = url.split('?')[0];

      if (pathname === '/users/1') {
        // Missing email field (breaking drift)
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 1, name: 'Alice Updated' }));
      } else if (pathname === '/users/2') {
        // New field (warning)
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 2, name: 'Bob', email: 'bob@example.com', newField: 'warning' }));
      } else if (pathname === '/users/3') {
        // Unchanged (for accept)
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 3, name: 'Charlie', email: 'charlie@example.com', role: 'admin' }));
      } else if (pathname === '/trips') {
        const dated = url.includes('date=');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(dated ? { kind: 'dated-live' } : { kind: 'bare-live' }));
      } else if (pathname === '/vendor/user') {
        res.writeHead(200, { 'Content-Type': 'application/vnd.github+json' });
        res.end(JSON.stringify({ id: 9, name: 'Vendor', stable: true }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(0, () => {
      const addr = server.address();
      serverPort = typeof addr === 'object' && addr ? addr.port : 0;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    testDir = path.join(__dirname, `drift-mgmt-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  function createMockFile(scenario: string, mockData: MockData, filename: string) {
    const scenarioPath = path.join(testDir, scenario);
    fs.mkdirSync(scenarioPath, { recursive: true });
    fs.writeFileSync(
      path.join(scenarioPath, filename),
      JSON.stringify(mockData, null, 2)
    );
  }

  describe('history tracking', () => {
    it('should write and load drift history', async () => {
      createMockFile(
        'default',
        {
          request: {
            method: 'GET',
            url: `http://localhost:${serverPort}/users/1`,
            headers: {},
            queryParams: {},
          },
          response: {
            status: 200,
            data: { id: 1, name: 'Alice', email: 'alice@example.com' },
          },
        } as MockData,
        'user1.json'
      );

      const report = await checkDrift({
        scenario: 'default',
        mockDataPath: testDir,
        driftOptions: {},
      });

      expect(report.driftedMocks).toBe(1);

      const history = loadDriftHistory(testDir, 'default');
      expect(history).not.toBeNull();
      expect(history!.reportVersion).toBe(1);
      expect(history!.timestamp).toBeDefined();
      expect(history!.mockReports.length).toBe(1);
      expect(history!.mockReports[0].issues[0].firstSeen).toBeDefined();
      expect(history!.mockReports[0].issues[0].lastSeen).toBeDefined();
      expect(history!.mockReports[0].issues[0].occurrences).toBe(1);
    });

    it('should track issue occurrences across runs', async () => {
      createMockFile(
        'default',
        {
          request: {
            method: 'GET',
            url: `http://localhost:${serverPort}/users/1`,
            headers: {},
            queryParams: {},
          },
          response: {
            status: 200,
            data: { id: 1, name: 'Alice', email: 'alice@example.com' },
          },
        } as MockData,
        'user1.json'
      );

      // First run
      await checkDrift({
        scenario: 'default',
        mockDataPath: testDir,
        driftOptions: {},
      });

      // Second run
      await checkDrift({
        scenario: 'default',
        mockDataPath: testDir,
        driftOptions: {},
      });

      const history = loadDriftHistory(testDir, 'default');
      expect(history!.mockReports[0].issues[0].occurrences).toBe(2);
    });

    it('should skip history with --no-history', async () => {
      createMockFile(
        'default',
        {
          request: {
            method: 'GET',
            url: `http://localhost:${serverPort}/users/1`,
            headers: {},
            queryParams: {},
          },
          response: {
            status: 200,
            data: { id: 1, name: 'Alice', email: 'alice@example.com' },
          },
        } as MockData,
        'user1.json'
      );

      await checkDrift({
        scenario: 'default',
        mockDataPath: testDir,
        driftOptions: { noHistory: true },
      });

      const history = loadDriftHistory(testDir, 'default');
      expect(history).toBeNull();
    });

    it('should clean up old history reports', async () => {
      createMockFile(
        'default',
        {
          request: {
            method: 'GET',
            url: `http://localhost:${serverPort}/users/1`,
            headers: {},
            queryParams: {},
          },
          response: {
            status: 200,
            data: { id: 1, name: 'Alice', email: 'alice@example.com' },
          },
        } as MockData,
        'user1.json'
      );

      // Run 5 times with retention of 3
      for (let i = 0; i < 5; i++) {
        await checkDrift({
          scenario: 'default',
          mockDataPath: testDir,
          driftOptions: { historyRetention: 3 },
        });
        // Wait to ensure distinct timestamps
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const driftDir = path.join(testDir, 'default', '.drift');
      const files = fs.readdirSync(driftDir).filter((f) => f !== 'latest.json');
      expect(files.length).toBeLessThanOrEqual(3);
      expect(files.length).toBeGreaterThan(0);
    }, 10000);
  });

  describe('accept drift', () => {
    it('should accept one endpoint and update mock file', async () => {
      const mockPath = path.join(testDir, 'default', 'user3.json');
      createMockFile(
        'default',
        {
          request: {
            method: 'GET',
            url: `http://localhost:${serverPort}/users/3`,
            headers: {},
            queryParams: {},
          },
          response: {
            status: 200,
            data: { id: 3, name: 'Old Name', email: 'old@example.com' },
          },
        } as MockData,
        'user3.json'
      );

      const result = await acceptDrift({
        method: 'GET',
        path: '/users/3',
        mockDataPath: testDir,
        scenario: 'default',
        driftOptions: {},
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Updated GET /users/3');

      const updatedMock = JSON.parse(fs.readFileSync(mockPath, 'utf-8'));
      expect(updatedMock.response.data.name).toBe('Charlie');
      expect(updatedMock.response.data.role).toBe('admin');
      expect(updatedMock.request.method).toBe('GET');
    });

    it('should accept all warnings', async () => {
      createMockFile(
        'default',
        {
          request: {
            method: 'GET',
            url: `http://localhost:${serverPort}/users/2`,
            headers: {},
            queryParams: {},
          },
          response: {
            status: 200,
            data: { id: 2, name: 'Bob', email: 'bob@example.com' },
          },
        } as MockData,
        'user2.json'
      );

      const result = await acceptAllWarnings({
        mockDataPath: testDir,
        scenario: 'default',
        driftOptions: {},
      });

      expect(result.accepted).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.messages[0]).toContain('✓');
    });

    it('stores a +json live body as an object', async () => {
      const mockPath = path.join(testDir, 'default', 'vendor.json');
      createMockFile(
        'default',
        {
          request: {
            method: 'GET',
            url: `http://localhost:${serverPort}/vendor/user`,
            headers: {},
            queryParams: {},
          },
          response: {
            status: 200,
            data: { id: 9, name: 'Old', stable: false },
          },
        } as MockData,
        'vendor.json'
      );

      const result = await acceptDrift({
        method: 'GET',
        path: '/vendor/user',
        mockDataPath: testDir,
        scenario: 'default',
        driftOptions: {},
      });

      expect(result.success).toBe(true);
      const updatedMock = JSON.parse(fs.readFileSync(mockPath, 'utf-8'));
      expect(updatedMock.response.data).toEqual({ id: 9, name: 'Vendor', stable: true });
    });

    it('updates the exact path when a query variant of the same pathname also exists', async () => {
      const barePath = path.join(testDir, 'default', 'z-bare.json');
      const datedPath = path.join(testDir, 'default', 'a-dated.json');
      createMockFile(
        'default',
        {
          request: {
            method: 'GET',
            url: `http://localhost:${serverPort}/trips`,
            headers: {},
            queryParams: {},
          },
          response: { status: 200, data: { kind: 'stored-bare' } },
        } as MockData,
        'z-bare.json'
      );
      createMockFile(
        'default',
        {
          request: {
            method: 'GET',
            url: `http://localhost:${serverPort}/trips?date=2026-11-10`,
            headers: {},
            queryParams: {},
          },
          response: { status: 200, data: { kind: 'stored-dated' } },
        } as MockData,
        'a-dated.json'
      );

      const result = await acceptDrift({
        method: 'GET',
        path: '/trips',
        mockDataPath: testDir,
        scenario: 'default',
        driftOptions: {},
      });

      expect(result.success).toBe(true);
      expect(JSON.parse(fs.readFileSync(barePath, 'utf-8')).response.data.kind).toBe('bare-live');
      expect(JSON.parse(fs.readFileSync(datedPath, 'utf-8')).response.data.kind).toBe('stored-dated');
    });

    it('refuses to accept a pathname that matches several query variants', async () => {
      const firstPath = path.join(testDir, 'default', 'a-trip.json');
      const secondPath = path.join(testDir, 'default', 'b-trip.json');
      createMockFile(
        'default',
        {
          request: {
            method: 'GET',
            url: `http://localhost:${serverPort}/trips?date=2026-11-10`,
            headers: {},
            queryParams: {},
          },
          response: { status: 200, data: { kind: 'stored-dated' } },
        } as MockData,
        'a-trip.json'
      );
      createMockFile(
        'default',
        {
          request: {
            method: 'GET',
            url: `http://localhost:${serverPort}/trips?date=2026-11-11`,
            headers: {},
            queryParams: {},
          },
          response: { status: 200, data: { kind: 'stored-other' } },
        } as MockData,
        'b-trip.json'
      );

      const result = await acceptDrift({
        method: 'GET',
        path: '/trips',
        mockDataPath: testDir,
        scenario: 'default',
        driftOptions: {},
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Multiple mocks match');
      expect(JSON.parse(fs.readFileSync(firstPath, 'utf-8')).response.data.kind).toBe('stored-dated');
      expect(JSON.parse(fs.readFileSync(secondPath, 'utf-8')).response.data.kind).toBe('stored-other');
    });

    it('accepts the only query variant when the path omits that query', async () => {
      const mockPath = path.join(testDir, 'default', 'only-dated.json');
      createMockFile(
        'default',
        {
          request: {
            method: 'GET',
            url: `http://localhost:${serverPort}/trips?date=2026-11-10`,
            headers: {},
            queryParams: {},
          },
          response: { status: 200, data: { kind: 'stored-dated' } },
        } as MockData,
        'only-dated.json'
      );

      const result = await acceptDrift({
        method: 'GET',
        path: '/trips',
        mockDataPath: testDir,
        scenario: 'default',
        driftOptions: {},
      });

      expect(result.success).toBe(true);
      expect(JSON.parse(fs.readFileSync(mockPath, 'utf-8')).response.data.kind).toBe('dated-live');
    });

    it('should fail gracefully when endpoint not found', async () => {
      const result = await acceptDrift({
        method: 'GET',
        path: '/nonexistent',
        mockDataPath: testDir,
        scenario: 'default',
        driftOptions: {},
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Mock file not found');
    });
  });

  describe('snooze endpoint', () => {
    it('should snooze an endpoint', async () => {
      createMockFile(
        'default',
        {
          request: {
            method: 'GET',
            url: `http://localhost:${serverPort}/users/1`,
            headers: {},
            queryParams: {},
          },
          response: {
            status: 200,
            data: { id: 1, name: 'Alice', email: 'alice@example.com' },
          },
        } as MockData,
        'user1.json'
      );

      // First run to create history
      await checkDrift({
        scenario: 'default',
        mockDataPath: testDir,
        driftOptions: {},
      });

      const result = await snoozeEndpoint({
        method: 'GET',
        path: '/users/1',
        days: 7,
        mockDataPath: testDir,
        scenario: 'default',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Snoozed');
      expect(result.expiresAt).toBeDefined();

      const history = loadDriftHistory(testDir, 'default');
      expect(history!.mockReports[0].snoozedUntil).toBeDefined();
    });

    it('should skip snoozed endpoints in drift check', async () => {
      createMockFile(
        'default',
        {
          request: {
            method: 'GET',
            url: `http://localhost:${serverPort}/users/1`,
            headers: {},
            queryParams: {},
          },
          response: {
            status: 200,
            data: { id: 1, name: 'Alice', email: 'alice@example.com' },
          },
        } as MockData,
        'user1.json'
      );

      // First run
      await checkDrift({
        scenario: 'default',
        mockDataPath: testDir,
        driftOptions: {},
      });

      // Snooze
      await snoozeEndpoint({
        method: 'GET',
        path: '/users/1',
        days: 7,
        mockDataPath: testDir,
        scenario: 'default',
      });

      // Second run
      const report = await checkDrift({
        scenario: 'default',
        mockDataPath: testDir,
        driftOptions: {},
      });

      expect(report.driftedMocks).toBe(0);
      expect(report.skippedCount).toBe(1);
      expect(report.mockReports[0].skipReason).toContain('Snoozed until');
    });

    it('does not snooze a different query variant when the path is ambiguous', async () => {
      createMockFile(
        'default',
        {
          request: {
            method: 'GET',
            url: `http://localhost:${serverPort}/trips?date=2026-11-10`,
            headers: {},
            queryParams: {},
          },
          response: { status: 200, data: { kind: 'stored-dated' } },
        } as MockData,
        'a-trip.json'
      );
      createMockFile(
        'default',
        {
          request: {
            method: 'GET',
            url: `http://localhost:${serverPort}/trips?date=2026-11-11`,
            headers: {},
            queryParams: {},
          },
          response: { status: 200, data: { kind: 'stored-other' } },
        } as MockData,
        'b-trip.json'
      );

      await checkDrift({
        scenario: 'default',
        mockDataPath: testDir,
        driftOptions: {},
      });

      const result = await snoozeEndpoint({
        method: 'GET',
        path: '/trips',
        days: 7,
        mockDataPath: testDir,
        scenario: 'default',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Multiple endpoints match');
      const history = loadDriftHistory(testDir, 'default');
      expect(history!.mockReports.every((report) => report.snoozedUntil == null)).toBe(true);
    });
  });

  describe('ignore field', () => {
    it('should add ignore field to config', async () => {
      const configPath = path.join(testDir, 'mockifyer.drift.json');

      const result = await addIgnoreField({
        endpoint: 'GET /api/users/123',
        jsonPath: 'lastLoginAt',
        configPath,
      });

      expect(result.success).toBe(true);
      expect(fs.existsSync(configPath)).toBe(true);

      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(config.endpointConfig['GET /api/users/123'].ignorePaths).toContain('lastLoginAt');
    });

    it('should merge with existing config', async () => {
      const configPath = path.join(testDir, 'mockifyer.drift.json');

      await addIgnoreField({
        endpoint: 'GET /api/users/123',
        jsonPath: 'lastLoginAt',
        configPath,
      });

      await addIgnoreField({
        endpoint: 'GET /api/users/123',
        jsonPath: 'createdAt',
        configPath,
      });

      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(config.endpointConfig['GET /api/users/123'].ignorePaths).toEqual([
        'lastLoginAt',
        'createdAt',
      ]);
    });
  });

  describe('endpoint config', () => {
    it('should apply per-endpoint ignorePaths', async () => {
      createMockFile(
        'default',
        {
          request: {
            method: 'GET',
            url: `http://localhost:${serverPort}/users/1`,
            headers: {},
            queryParams: {},
          },
          response: {
            status: 200,
            data: { id: 1, name: 'Alice', email: 'alice@example.com' },
          },
        } as MockData,
        'user1.json'
      );

      const report = await checkDrift({
        scenario: 'default',
        mockDataPath: testDir,
        driftOptions: {
          endpointConfig: {
            'GET /users/1': {
              ignorePaths: ['email'],
            },
          },
        },
      });

      expect(report.driftedMocks).toBe(0);
    });

    it('should match endpoint patterns with wildcards', async () => {
      createMockFile(
        'default',
        {
          request: {
            method: 'GET',
            url: `http://localhost:${serverPort}/users/1`,
            headers: {},
            queryParams: {},
          },
          response: {
            status: 200,
            data: { id: 1, name: 'Alice', email: 'alice@example.com' },
          },
        } as MockData,
        'user1.json'
      );

      const report = await checkDrift({
        scenario: 'default',
        mockDataPath: testDir,
        driftOptions: {
          endpointConfig: {
            'GET /users/*': {
              ignorePaths: ['email'],
            },
          },
        },
      });

      expect(report.driftedMocks).toBe(0);
    });
  });
});
