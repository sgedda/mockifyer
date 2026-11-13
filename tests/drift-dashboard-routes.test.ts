/**
 * Tests for dashboard drift routes (/api/drift/*)
 */

import express from 'express';
import request from 'supertest';
import { createServer } from '../packages/mockifyer-dashboard/src/server';
import * as fs from 'fs';
import * as path from 'path';
import type { DriftHistoryReport } from '../packages/mockifyer-core/src/utils/drift';

describe('Drift Dashboard Routes', () => {
  let app: express.Application;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(__dirname, 'tmp-drift-dashboard-'));
    const publicDir = path.join(__dirname, '../packages/mockifyer-dashboard/public');
    app = createServer(publicDir, tmpDir);
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  describe('GET /api/drift/latest', () => {
    it('should return not found when no drift report exists', async () => {
      const response = await request(app)
        .get('/api/drift/latest?scenario=default')
        .expect(200);

      expect(response.body.found).toBe(false);
      expect(response.body.message).toContain('No drift report found');
    });

    it('should return the latest drift report when it exists', async () => {
      const scenarioDir = path.join(tmpDir, 'default');
      const driftDir = path.join(scenarioDir, '.drift');
      fs.mkdirSync(driftDir, { recursive: true });

      const report: DriftHistoryReport = {
        reportVersion: 1,
        timestamp: new Date().toISOString(),
        totalMocks: 5,
        driftedMocks: 2,
        breakingDriftCount: 1,
        warningOnlyCount: 1,
        skippedCount: 0,
        notCheckedCount: 0,
        summary: '2 of 5 mocks drifted: 1 breaking, 1 warning',
        failOnWarnings: false,
        mockReports: [
          {
            method: 'GET',
            url: 'http://api.example.com/users/123',
            hasDrift: true,
            hasBreakingDrift: true,
            issues: [
              {
                path: 'email',
                type: 'missing_key',
                severity: 'breaking',
                expected: 'string',
                message: 'Key "email" removed',
                firstSeen: new Date().toISOString(),
                lastSeen: new Date().toISOString(),
                occurrences: 1,
              },
            ],
          },
          {
            method: 'GET',
            url: 'http://api.example.com/posts',
            hasDrift: true,
            hasBreakingDrift: false,
            issues: [
              {
                path: 'createdAt',
                type: 'extra_key',
                severity: 'warning',
                actual: 'string',
                message: 'New key "createdAt" added',
                firstSeen: new Date().toISOString(),
                lastSeen: new Date().toISOString(),
                occurrences: 1,
              },
            ],
          },
        ],
      };

      fs.writeFileSync(
        path.join(driftDir, 'latest.json'),
        JSON.stringify(report, null, 2)
      );

      const response = await request(app)
        .get('/api/drift/latest?scenario=default')
        .expect(200);

      expect(response.body.found).toBe(true);
      expect(response.body.report).toBeDefined();
      expect(response.body.report.totalMocks).toBe(5);
      expect(response.body.report.breakingDriftCount).toBe(1);
      expect(response.body.report.warningOnlyCount).toBe(1);
    });
  });

  describe('GET /api/drift/history', () => {
    it('should return empty array when no history exists', async () => {
      const response = await request(app)
        .get('/api/drift/history?scenario=default')
        .expect(200);

      expect(response.body.reports).toEqual([]);
    });

    it('should return history reports sorted by timestamp', async () => {
      const scenarioDir = path.join(tmpDir, 'default');
      const driftDir = path.join(scenarioDir, '.drift');
      fs.mkdirSync(driftDir, { recursive: true });

      const timestamps = [
        '2026-11-12T12-00-00Z',
        '2026-11-13T12-00-00Z',
        '2026-11-11T12-00-00Z',
      ];

      timestamps.forEach((ts, idx) => {
        const report: Partial<DriftHistoryReport> = {
          reportVersion: 1,
          timestamp: ts.replace(/-/g, ':').replace('Z', '.000Z'),
          totalMocks: 5,
          driftedMocks: idx,
          breakingDriftCount: idx,
          warningOnlyCount: 0,
          skippedCount: 0,
          notCheckedCount: 0,
          mockReports: [],
          summary: '',
          failOnWarnings: false,
        };

        fs.writeFileSync(
          path.join(driftDir, `${ts}.json`),
          JSON.stringify(report, null, 2)
        );
      });

      const response = await request(app)
        .get('/api/drift/history?scenario=default')
        .expect(200);

      expect(response.body.reports).toHaveLength(3);
      expect(response.body.reports[0].timestamp).toContain('2026-11-13');
      expect(response.body.reports[1].timestamp).toContain('2026-11-12');
      expect(response.body.reports[2].timestamp).toContain('2026-11-11');
    });
  });

  describe('POST /api/drift/accept', () => {
    it('should return 400 when method or path is missing', async () => {
      await request(app)
        .post('/api/drift/accept')
        .send({ scenario: 'default' })
        .expect(400);

      await request(app)
        .post('/api/drift/accept')
        .send({ method: 'GET', scenario: 'default' })
        .expect(400);

      await request(app)
        .post('/api/drift/accept')
        .send({ path: '/users/123', scenario: 'default' })
        .expect(400);
    });

    it('should handle missing mock file gracefully', async () => {
      const response = await request(app)
        .post('/api/drift/accept')
        .send({
          method: 'GET',
          path: '/nonexistent',
          scenario: 'default',
        })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Mock file not found');
    });
  });

  describe('POST /api/drift/snooze', () => {
    it('should return 400 when method or path is missing', async () => {
      await request(app)
        .post('/api/drift/snooze')
        .send({ scenario: 'default', days: 7 })
        .expect(400);
    });

    it('should default to 7 days when days is not provided', async () => {
      const scenarioDir = path.join(tmpDir, 'default');
      fs.mkdirSync(scenarioDir, { recursive: true });

      const mockData = {
        request: { method: 'GET', url: 'http://api.example.com/users/123', headers: {} },
        response: { status: 200, data: { id: 123, name: 'John' } },
      };

      fs.mkdirSync(path.join(scenarioDir, 'api.example.com', 'users'), { recursive: true });
      fs.writeFileSync(
        path.join(scenarioDir, 'api.example.com', 'users', 'GET_123.json'),
        JSON.stringify(mockData, null, 2)
      );

      const response = await request(app)
        .post('/api/drift/snooze')
        .send({
          method: 'GET',
          path: '/users/123',
          scenario: 'default',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.expiresAt).toBeDefined();

      const expiresAt = new Date(response.body.expiresAt);
      const now = new Date();
      const diffDays = Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBeGreaterThanOrEqual(6);
      expect(diffDays).toBeLessThanOrEqual(7);
    });
  });

  describe('POST /api/drift/ignore-field', () => {
    it('should return 400 when endpoint or jsonPath is missing', async () => {
      await request(app)
        .post('/api/drift/ignore-field')
        .send({ endpoint: 'GET /users' })
        .expect(400);

      await request(app)
        .post('/api/drift/ignore-field')
        .send({ jsonPath: 'email' })
        .expect(400);
    });

    it('should create config file and add ignore path', async () => {
      const configPath = path.join(tmpDir, 'mockifyer.drift.json');

      const response = await request(app)
        .post('/api/drift/ignore-field')
        .send({
          endpoint: 'GET /users/123',
          jsonPath: 'email',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Added ignore path');
    });
  });

  describe('POST /api/drift/accept-all-warnings', () => {
    it('should return success even when no warnings exist', async () => {
      const scenarioDir = path.join(tmpDir, 'default');
      fs.mkdirSync(scenarioDir, { recursive: true });

      const response = await request(app)
        .post('/api/drift/accept-all-warnings')
        .send({ scenario: 'default' })
        .expect(200);

      expect(response.body.accepted).toBeDefined();
      expect(response.body.failed).toBeDefined();
      expect(response.body.messages).toBeInstanceOf(Array);
    });
  });

  describe('POST /api/drift/check', () => {
    it('should run drift check and return report', async () => {
      const scenarioDir = path.join(tmpDir, 'default');
      fs.mkdirSync(scenarioDir, { recursive: true });

      const response = await request(app)
        .post('/api/drift/check')
        .send({ scenario: 'default' })
        .expect(200);

      expect(response.body.success).toBeDefined();
      expect(response.body.report).toBeDefined();
      expect(response.body.report.totalMocks).toBeDefined();
      expect(response.body.report.summary).toBeDefined();
    });
  });
});
