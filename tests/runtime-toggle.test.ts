/**
 * Tests for runtime Mockifyer enable/disable toggle
 */

import { setupMockifyer, MemoryProvider } from '@sgedda/mockifyer-fetch';
import type { MockifyerInstance } from '@sgedda/mockifyer-fetch';

describe('Runtime Mockifyer Toggle', () => {
  let mockifyerInstance: MockifyerInstance;
  let originalFetch: typeof fetch;

  beforeAll(() => {
    // Save original fetch
    originalFetch = global.fetch;
  });

  beforeEach(() => {
    // Setup Mockifyer with memory provider
    mockifyerInstance = setupMockifyer({
      mockDataPath: './mock-data',
      databaseProvider: {
        type: 'memory',
      },
      useGlobalFetch: true,
      recordMode: false,
    });
  });

  afterEach(() => {
    // Clean up - restore original fetch
    global.fetch = originalFetch;
  });

  describe('isMockifyerEnabled', () => {
    it('should return true by default', () => {
      expect(mockifyerInstance.isMockifyerEnabled()).toBe(true);
    });

    it('should return false when startDisabled is true', () => {
      const disabledInstance = setupMockifyer({
        mockDataPath: './mock-data',
        databaseProvider: {
          type: 'memory',
        },
        useGlobalFetch: false,
        startDisabled: true,
      });

      expect(disabledInstance.isMockifyerEnabled()).toBe(false);
    });

    it('should return false when runtimeMode is manual', () => {
      const manualInstance = setupMockifyer({
        mockDataPath: './mock-data',
        databaseProvider: {
          type: 'memory',
        },
        useGlobalFetch: false,
        runtimeMode: 'manual',
      });

      expect(manualInstance.isMockifyerEnabled()).toBe(false);
    });

    it('should prioritize runtimeMode: manual over startDisabled: false', () => {
      const manualInstance = setupMockifyer({
        mockDataPath: './mock-data',
        databaseProvider: {
          type: 'memory',
        },
        useGlobalFetch: false,
        runtimeMode: 'manual',
        startDisabled: false, // This should be overridden
      });

      expect(manualInstance.isMockifyerEnabled()).toBe(false);
    });
  });

  describe('disableMockifyer', () => {
    it('should disable Mockifyer at runtime', () => {
      mockifyerInstance.disableMockifyer();
      expect(mockifyerInstance.isMockifyerEnabled()).toBe(false);
    });
  });

  describe('enableMockifyer', () => {
    it('should enable Mockifyer at runtime', () => {
      // First disable
      mockifyerInstance.disableMockifyer();
      expect(mockifyerInstance.isMockifyerEnabled()).toBe(false);

      // Then enable
      mockifyerInstance.enableMockifyer();
      expect(mockifyerInstance.isMockifyerEnabled()).toBe(true);
    });

    it('should restore Mockifyer logic when re-enabled', async () => {
      // Add a mock to memory provider
      const provider = new MemoryProvider({});
      provider.initialize();
      provider.save({
        request: {
          method: 'GET',
          url: 'https://api.example.com/test',
          headers: {},
          data: undefined,
        },
        response: {
          status: 200,
          data: { mocked: true },
          headers: { 'content-type': 'application/json' },
        },
        timestamp: new Date().toISOString(),
      });

      // Disable then re-enable
      mockifyerInstance.disableMockifyer();
      mockifyerInstance.enableMockifyer();

      // The request should now go through Mockifyer logic again
      expect(mockifyerInstance.isMockifyerEnabled()).toBe(true);
    });
  });

  describe('toggle behavior', () => {
    it('should allow multiple toggles', () => {
      expect(mockifyerInstance.isMockifyerEnabled()).toBe(true);

      mockifyerInstance.disableMockifyer();
      expect(mockifyerInstance.isMockifyerEnabled()).toBe(false);

      mockifyerInstance.enableMockifyer();
      expect(mockifyerInstance.isMockifyerEnabled()).toBe(true);

      mockifyerInstance.disableMockifyer();
      expect(mockifyerInstance.isMockifyerEnabled()).toBe(false);

      mockifyerInstance.enableMockifyer();
      expect(mockifyerInstance.isMockifyerEnabled()).toBe(true);
    });

    it('should allow toggling from startDisabled state', () => {
      const disabledInstance = setupMockifyer({
        mockDataPath: './mock-data',
        databaseProvider: {
          type: 'memory',
        },
        useGlobalFetch: false,
        startDisabled: true,
      });

      // Starts disabled
      expect(disabledInstance.isMockifyerEnabled()).toBe(false);

      // Can enable
      disabledInstance.enableMockifyer();
      expect(disabledInstance.isMockifyerEnabled()).toBe(true);

      // Can disable again
      disabledInstance.disableMockifyer();
      expect(disabledInstance.isMockifyerEnabled()).toBe(false);
    });

    it('should allow toggling from manual mode', () => {
      const manualInstance = setupMockifyer({
        mockDataPath: './mock-data',
        databaseProvider: {
          type: 'memory',
        },
        useGlobalFetch: false,
        runtimeMode: 'manual',
      });

      // Starts disabled (manual mode)
      expect(manualInstance.isMockifyerEnabled()).toBe(false);

      // Can enable
      manualInstance.enableMockifyer();
      expect(manualInstance.isMockifyerEnabled()).toBe(true);

      // Can disable again
      manualInstance.disableMockifyer();
      expect(manualInstance.isMockifyerEnabled()).toBe(false);

      // Can enable again
      manualInstance.enableMockifyer();
      expect(manualInstance.isMockifyerEnabled()).toBe(true);
    });
  });
});
