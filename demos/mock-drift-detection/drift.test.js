import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

const originalFetch = globalThis.fetch;

describe('Mockifyer: Drift Detection', () => {
  describe('Version 1 (original API)', () => {
    beforeAll(() => {
      setupMockifyer({
        mockDataPath: './mock-data',
        defaultScenario: 'default',
        recordMode: false,
        useGlobalFetch: true,
        domainPathRulesMode: 'record_all',
        failOnMissingMock: true,
      });
    });

    afterAll(() => {
      globalThis.fetch = originalFetch;
    });

    it('returns tasks with basic fields', async () => {
      const response = await fetch('https://demo.devxtools.dev/tasks');
      const data = await response.json();
      
      expect(data[0]).toHaveProperty('id');
      expect(data[0]).toHaveProperty('title');
      expect(data[0]).toHaveProperty('completed');
      expect(data[0]).toHaveProperty('userId');
      
      // API v1 doesn't have these fields yet
      expect(data[0]).not.toHaveProperty('priority');
      expect(data[0]).not.toHaveProperty('tags');
    });
  });

  describe('Version 2 (updated API)', () => {
    beforeAll(() => {
      setupMockifyer({
        mockDataPath: './mock-data',
        defaultScenario: 'updated',
        recordMode: false,
        useGlobalFetch: true,
        domainPathRulesMode: 'record_all',
        failOnMissingMock: true,
      });
    });

    afterAll(() => {
      globalThis.fetch = originalFetch;
    });

    it('returns tasks with new fields (drift detected)', async () => {
      const response = await fetch('https://demo.devxtools.dev/tasks');
      const data = await response.json();
      
      expect(data[0]).toHaveProperty('id');
      expect(data[0]).toHaveProperty('title');
      expect(data[0]).toHaveProperty('completed');
      expect(data[0]).toHaveProperty('userId');
      
      // API v2 added these fields
      expect(data[0]).toHaveProperty('priority');
      expect(data[0]).toHaveProperty('tags');
      expect(Array.isArray(data[0].tags)).toBe(true);
    });

    it('detects shape differences', () => {
      // In a real workflow:
      // 1. Run `npm run record` to re-record mocks
      // 2. Run `git diff mock-data/` to see changes
      // 3. Review the diff in your PR
      // 4. Update tests to match the new API shape
      
      expect(true).toBe(true);
    });
  });
});
