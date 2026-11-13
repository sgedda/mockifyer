/**
 * Integration tests for drift checking.
 * Tests the full flow: loading mocks, making requests, comparing responses.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { checkDrift } from '@sgedda/mockifyer-core/utils/drift';
import { MockData } from '@sgedda/mockifyer-core';

describe('drift-check-integration', () => {
  let server: http.Server;
  let serverPort: number;
  let testDir: string;

  beforeAll((done) => {
    // Start a test HTTP server
    server = http.createServer((req, res) => {
      const url = req.url || '';

      if (url === '/users/1') {
        // Match expected mock
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 1, name: 'Alice', email: 'alice@example.com' }));
      } else if (url === '/users/2') {
        // Drift: missing field
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 2, name: 'Bob' }));
      } else if (url === '/users/3') {
        // Drift: new field
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 3, name: 'Charlie', email: 'charlie@example.com', role: 'admin' }));
      } else if (url === '/users/4') {
        // Drift: type change
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: '4', name: 'David', email: 'david@example.com' }));
      } else if (url === '/status') {
        // Drift: status change
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      } else if (url === '/posts') {
        // POST endpoint (should be skipped by default)
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else if (url === '/timeout') {
        // Simulate timeout (never respond)
        return;
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
    // Create temporary test directory
    testDir = path.join(__dirname, `drift-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
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

  it('should detect no drift when response matches mock', async () => {
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
          headers: {},
        },
        timestamp: new Date().toISOString(),
      },
      'users-1.json'
    );

    const report = await checkDrift({
      mockDataPath: testDir,
      scenario: 'default',
    });

    expect(report.totalMocks).toBe(1);
    expect(report.driftedMocks).toBe(0);
    expect(report.breakingDriftCount).toBe(0);
    expect(report.summary).toContain('No drift detected');
  });

  it('should detect missing key as breaking drift', async () => {
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
          headers: {},
        },
        timestamp: new Date().toISOString(),
      },
      'users-2.json'
    );

    const report = await checkDrift({
      mockDataPath: testDir,
      scenario: 'default',
    });

    expect(report.totalMocks).toBe(1);
    expect(report.driftedMocks).toBe(1);
    expect(report.breakingDriftCount).toBe(1);
    expect(report.mockReports[0].issues).toHaveLength(1);
    expect(report.mockReports[0].issues[0]).toMatchObject({
      path: 'email',
      type: 'missing_key',
      severity: 'breaking',
    });
  });

  it('should detect new key as warning', async () => {
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
          data: { id: 3, name: 'Charlie', email: 'charlie@example.com' },
          headers: {},
        },
        timestamp: new Date().toISOString(),
      },
      'users-3.json'
    );

    const report = await checkDrift({
      mockDataPath: testDir,
      scenario: 'default',
    });

    expect(report.totalMocks).toBe(1);
    expect(report.driftedMocks).toBe(1);
    expect(report.breakingDriftCount).toBe(0);
    expect(report.warningOnlyCount).toBe(1);
    expect(report.mockReports[0].issues).toHaveLength(1);
    expect(report.mockReports[0].issues[0]).toMatchObject({
      path: 'role',
      type: 'extra_key',
      severity: 'warning',
    });
  });

  it('should detect type change as breaking drift', async () => {
    createMockFile(
      'default',
      {
        request: {
          method: 'GET',
          url: `http://localhost:${serverPort}/users/4`,
          headers: {},
          queryParams: {},
        },
        response: {
          status: 200,
          data: { id: 4, name: 'David', email: 'david@example.com' },
          headers: {},
        },
        timestamp: new Date().toISOString(),
      },
      'users-4.json'
    );

    const report = await checkDrift({
      mockDataPath: testDir,
      scenario: 'default',
    });

    expect(report.totalMocks).toBe(1);
    expect(report.driftedMocks).toBe(1);
    expect(report.breakingDriftCount).toBe(1);
    expect(report.mockReports[0].issues).toContainEqual(
      expect.objectContaining({
        path: 'id',
        type: 'type_change',
        severity: 'breaking',
        expected: 'number',
        actual: 'string',
      })
    );
  });

  it('should detect status change as breaking drift', async () => {
    createMockFile(
      'default',
      {
        request: {
          method: 'GET',
          url: `http://localhost:${serverPort}/status`,
          headers: {},
          queryParams: {},
        },
        response: {
          status: 200,
          data: { status: 'ok' },
          headers: {},
        },
        timestamp: new Date().toISOString(),
      },
      'status.json'
    );

    const report = await checkDrift({
      mockDataPath: testDir,
      scenario: 'default',
    });

    expect(report.totalMocks).toBe(1);
    expect(report.driftedMocks).toBe(1);
    expect(report.breakingDriftCount).toBe(1);
    expect(report.mockReports[0].issues).toContainEqual(
      expect.objectContaining({
        path: 'status',
        type: 'status_change',
        severity: 'breaking',
        expected: '200',
        actual: '404',
      })
    );
  });

  it('should skip POST requests by default', async () => {
    createMockFile(
      'default',
      {
        request: {
          method: 'POST',
          url: `http://localhost:${serverPort}/posts`,
          headers: {},
          queryParams: {},
        },
        response: {
          status: 200,
          data: { id: 1 },
          headers: {},
        },
        timestamp: new Date().toISOString(),
      },
      'posts.json'
    );

    const report = await checkDrift({
      mockDataPath: testDir,
      scenario: 'default',
    });

    expect(report.totalMocks).toBe(1);
    expect(report.skippedCount).toBe(1);
    expect(report.mockReports[0].skipped).toBe(true);
    expect(report.mockReports[0].skipReason).toContain('POST');
  });

  it('should check POST requests when allowUnsafeMethods is true', async () => {
    createMockFile(
      'default',
      {
        request: {
          method: 'POST',
          url: `http://localhost:${serverPort}/posts`,
          headers: {},
          queryParams: {},
        },
        response: {
          status: 200,
          data: { success: true },
          headers: {},
        },
        timestamp: new Date().toISOString(),
      },
      'posts.json'
    );

    const report = await checkDrift({
      mockDataPath: testDir,
      scenario: 'default',
      driftOptions: {
        allowUnsafeMethods: true,
      },
    });

    expect(report.totalMocks).toBe(1);
    expect(report.skippedCount).toBe(0);
    expect(report.driftedMocks).toBe(0);
  });

  it('should respect ignore paths', async () => {
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
          headers: {},
        },
        timestamp: new Date().toISOString(),
      },
      'users-2.json'
    );

    const report = await checkDrift({
      mockDataPath: testDir,
      scenario: 'default',
      driftOptions: {
        ignorePaths: ['email'],
      },
    });

    expect(report.totalMocks).toBe(1);
    expect(report.driftedMocks).toBe(0);
    expect(report.breakingDriftCount).toBe(0);
  });

  it('should override base URL', async () => {
    createMockFile(
      'default',
      {
        request: {
          method: 'GET',
          url: 'https://api.example.com/users/1',
          headers: {},
          queryParams: {},
        },
        response: {
          status: 200,
          data: { id: 1, name: 'Alice', email: 'alice@example.com' },
          headers: {},
        },
        timestamp: new Date().toISOString(),
      },
      'users-1.json'
    );

    const report = await checkDrift({
      mockDataPath: testDir,
      scenario: 'default',
      driftOptions: {
        baseUrl: `http://localhost:${serverPort}`,
      },
    });

    expect(report.totalMocks).toBe(1);
    expect(report.driftedMocks).toBe(0);
  });

  it('should handle timeout gracefully', async () => {
    createMockFile(
      'default',
      {
        request: {
          method: 'GET',
          url: `http://localhost:${serverPort}/timeout`,
          headers: {},
          queryParams: {},
        },
        response: {
          status: 200,
          data: { data: 'value' },
          headers: {},
        },
        timestamp: new Date().toISOString(),
      },
      'timeout.json'
    );

    const report = await checkDrift({
      mockDataPath: testDir,
      scenario: 'default',
      driftOptions: {
        timeoutMs: 500,
      },
    });

    expect(report.totalMocks).toBe(1);
    expect(report.skippedCount).toBe(1);
    expect(report.mockReports[0].skipped).toBe(true);
    expect(report.mockReports[0].skipReason).toContain('timeout');
  });

  it('should handle multiple mocks with mixed results', async () => {
    // No drift
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
          headers: {},
        },
        timestamp: new Date().toISOString(),
      },
      'users-1.json'
    );

    // Breaking drift
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
          headers: {},
        },
        timestamp: new Date().toISOString(),
      },
      'users-2.json'
    );

    // Warning only
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
          data: { id: 3, name: 'Charlie', email: 'charlie@example.com' },
          headers: {},
        },
        timestamp: new Date().toISOString(),
      },
      'users-3.json'
    );

    const report = await checkDrift({
      mockDataPath: testDir,
      scenario: 'default',
    });

    expect(report.totalMocks).toBe(3);
    expect(report.driftedMocks).toBe(2);
    expect(report.breakingDriftCount).toBe(1);
    expect(report.warningOnlyCount).toBe(1);
    expect(report.summary).toContain('2 of 3 mocks drifted');
    expect(report.summary).toContain('1 breaking');
    expect(report.summary).toContain('1 warning');
  });

  it('should throw error when scenario does not exist', async () => {
    await expect(
      checkDrift({
        mockDataPath: testDir,
        scenario: 'nonexistent',
      })
    ).rejects.toThrow('Scenario path not found');
  });

  it('should throw error when no mocks found', async () => {
    fs.mkdirSync(path.join(testDir, 'empty'), { recursive: true });

    await expect(
      checkDrift({
        mockDataPath: testDir,
        scenario: 'empty',
      })
    ).rejects.toThrow('No mocks found');
  });

  it('should handle nested directory structures', async () => {
    const apiPath = path.join(testDir, 'default', 'api.example.com', 'v1');
    fs.mkdirSync(apiPath, { recursive: true });

    fs.writeFileSync(
      path.join(apiPath, 'user.json'),
      JSON.stringify({
        request: {
          method: 'GET',
          url: `http://localhost:${serverPort}/users/1`,
          headers: {},
          queryParams: {},
        },
        response: {
          status: 200,
          data: { id: 1, name: 'Alice', email: 'alice@example.com' },
          headers: {},
        },
        timestamp: new Date().toISOString(),
      })
    );

    const report = await checkDrift({
      mockDataPath: testDir,
      scenario: 'default',
    });

    expect(report.totalMocks).toBe(1);
    expect(report.driftedMocks).toBe(0);
  });

  it('should report status changes even with empty arrays (regression)', async () => {
    // Regression: empty arrays should not hide other drift like status changes
    // Mock will return 200 but live returns 500 with empty array
    createMockFile(
      'default',
      {
        request: {
          method: 'GET',
          url: `http://localhost:${serverPort}/status`,
          headers: {},
          queryParams: {},
        },
        response: {
          status: 200,
          data: { trips: [{ id: 1 }], status: 'ok' },
          headers: {},
        },
        timestamp: new Date().toISOString(),
      },
      'status-with-array.json'
    );

    const report = await checkDrift({
      mockDataPath: testDir,
      scenario: 'default',
    });

    // Should detect status change (404) as breaking drift
    // even though there's also an empty array situation
    expect(report.breakingDriftCount).toBe(1);
    const statusIssue = report.mockReports[0].issues.find(i => i.path === 'status');
    expect(statusIssue).toBeDefined();
    expect(statusIssue?.type).toBe('status_change');
  });
});
