import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupMockifyer, getCurrentDate } from '@sgedda/mockifyer-fetch';

const originalFetch = globalThis.fetch;

describe('Mockifyer: Record & Replay Basics', () => {
  describe('Scenario: default (real data)', () => {
    beforeAll(() => {
      setupMockifyer({
        mockDataPath: './mock-data',
        defaultScenario: 'default',
        recordMode: false,
        useGlobalFetch: true,
        domainPathRulesMode: 'record_all',
        failOnMissingMock: true,
        dateManipulation: {
          fixedDate: '2026-12-20T00:00:00.000Z',
        },
      });
    });

    afterAll(() => {
      globalThis.fetch = originalFetch;
    });

    it('replays recorded /tasks response', async () => {
      const response = await fetch('https://demo.devxtools.dev/tasks');
      const data = await response.json();
      
      expect(response.ok).toBe(true);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty('id');
      expect(data[0]).toHaveProperty('title');
    });

    it('replays recorded /tasks/1 response', async () => {
      const response = await fetch('https://demo.devxtools.dev/tasks/1');
      const data = await response.json();
      
      expect(data).toEqual({
        id: 1,
        title: 'Set up project repository',
        completed: true,
        userId: 1,
      });
    });

    it('returns frozen date from getCurrentDate', () => {
      const currentDate = getCurrentDate();
      expect(currentDate.toISOString()).toBe('2026-12-20T00:00:00.000Z');
    });
  });

  describe('Scenario: tasks-empty', () => {
    beforeAll(() => {
      setupMockifyer({
        mockDataPath: './mock-data',
        defaultScenario: 'tasks-empty',
        recordMode: false,
        useGlobalFetch: true,
        domainPathRulesMode: 'record_all',
        failOnMissingMock: true,
      });
    });

    afterAll(() => {
      globalThis.fetch = originalFetch;
    });

    it('returns empty array for /tasks', async () => {
      const response = await fetch('https://demo.devxtools.dev/tasks');
      const data = await response.json();
      
      expect(data).toEqual([]);
    });
  });

  describe('Scenario: tasks-error', () => {
    beforeAll(() => {
      setupMockifyer({
        mockDataPath: './mock-data',
        defaultScenario: 'tasks-error',
        recordMode: false,
        useGlobalFetch: true,
        domainPathRulesMode: 'record_all',
        failOnMissingMock: true,
      });
    });

    afterAll(() => {
      globalThis.fetch = originalFetch;
    });

    it('returns 500 error for /tasks', async () => {
      const response = await fetch('https://demo.devxtools.dev/tasks');
      const data = await response.json();
      
      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
      expect(data).toHaveProperty('error');
    });
  });
});
