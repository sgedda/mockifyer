/**
 * Tests for runtime Mockifyer enable/disable toggle
 */

import {
  setupMockifyer,
  MemoryProvider,
  setScenarioLaunchOverride,
  shouldActivateMockifyerForReactNative,
} from '@sgedda/mockifyer-fetch';
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

  describe('persistRuntimeEnabled', () => {
    it('should restore enabled state from storage on next setup', async () => {
      const store = new Map<string, string>();
      const storage = {
        getItem: async (key: string) => store.get(key) ?? null,
        setItem: async (key: string, value: string) => {
          store.set(key, value);
        },
      };

      const first = setupMockifyer({
        mockDataPath: './mock-data',
        databaseProvider: { type: 'memory' },
        useGlobalFetch: false,
        runtimeMode: 'manual',
        persistRuntimeEnabled: storage,
      });
      expect(first.isMockifyerEnabled()).toBe(false);

      first.enableMockifyer();
      // Allow async persist to flush
      await new Promise((r) => setTimeout(r, 10));
      expect(store.get('@mockifyer/runtime-enabled')).toBe('true');

      const second = setupMockifyer({
        mockDataPath: './mock-data',
        databaseProvider: { type: 'memory' },
        useGlobalFetch: false,
        runtimeMode: 'manual',
        persistRuntimeEnabled: storage,
        initialRuntimeEnabled: true, // simulates async load done by RN helper
      });
      expect(second.isMockifyerEnabled()).toBe(true);
    });

    it('should restore disabled state from storage', async () => {
      const store = new Map<string, string>([['@mockifyer/runtime-enabled', 'false']]);
      const storage = {
        getItem: async (key: string) => store.get(key) ?? null,
        setItem: async (key: string, value: string) => {
          store.set(key, value);
        },
      };

      const instance = setupMockifyer({
        mockDataPath: './mock-data',
        databaseProvider: { type: 'memory' },
        useGlobalFetch: false,
        runtimeMode: 'on',
        persistRuntimeEnabled: storage,
        initialRuntimeEnabled: false,
      });
      expect(instance.isMockifyerEnabled()).toBe(false);
    });
  });

  describe('launch scenario forces enabled', () => {
    afterEach(() => {
      setScenarioLaunchOverride(null);
    });

    it('should start enabled when scenario launch override is from native args (even in manual mode)', () => {
      setScenarioLaunchOverride('e2e-smoke', { fromLaunchArguments: true });
      const instance = setupMockifyer({
        mockDataPath: './mock-data',
        databaseProvider: { type: 'memory' },
        useGlobalFetch: false,
        runtimeMode: 'manual',
      });
      expect(instance.isMockifyerEnabled()).toBe(true);
    });

    it('should prefer native launch scenario over persisted disabled', () => {
      setScenarioLaunchOverride('maestro-login', { fromLaunchArguments: true });
      const instance = setupMockifyer({
        mockDataPath: './mock-data',
        databaseProvider: { type: 'memory' },
        useGlobalFetch: false,
        runtimeMode: 'manual',
        initialRuntimeEnabled: false,
      });
      expect(instance.isMockifyerEnabled()).toBe(true);
    });

    it('should NOT force enabled when override is only defaultScenario (not launch args)', () => {
      setScenarioLaunchOverride('default'); // no fromLaunchArguments
      const instance = setupMockifyer({
        mockDataPath: './mock-data',
        databaseProvider: { type: 'memory' },
        useGlobalFetch: false,
        runtimeMode: 'manual',
      });
      expect(instance.isMockifyerEnabled()).toBe(false);
    });
  });

  describe('shouldActivateMockifyerForReactNative', () => {
    it('activates launch_client when scenario is present without client id', () => {
      expect(
        shouldActivateMockifyerForReactNative({
          runtimeMode: 'launch_client',
          hasLaunchClientId: false,
          hasLaunchScenario: true,
        })
      ).toBe(true);
    });

    it('does not activate launch_client without client id or scenario', () => {
      expect(
        shouldActivateMockifyerForReactNative({
          runtimeMode: 'launch_client',
          hasLaunchClientId: false,
          hasLaunchScenario: false,
        })
      ).toBe(false);
    });

    it('never activates when runtimeMode is off even with scenario', () => {
      expect(
        shouldActivateMockifyerForReactNative({
          runtimeMode: 'off',
          hasLaunchClientId: true,
          hasLaunchScenario: true,
        })
      ).toBe(false);
    });
  });
});
