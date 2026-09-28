import {
  clearMetroAtlasRuntimeSyncState,
  noteMockifyerToggledByUser,
  parseMetroAtlasSessionStatus,
  setRegisteredMockifyerRuntimeToggle,
  stopMetroAtlasRuntimeSync,
  syncMockifyerFromMetroAtlasSession,
} from '@sgedda/mockifyer-core';

describe('metro-atlas-runtime-sync', () => {
  afterEach(() => {
    stopMetroAtlasRuntimeSync();
    clearMetroAtlasRuntimeSyncState();
    setRegisteredMockifyerRuntimeToggle(null);
  });

  describe('parseMetroAtlasSessionStatus', () => {
    it('reads capturing as activateMockifyer', () => {
      expect(
        parseMetroAtlasSessionStatus({
          phase: 'capturing',
          capturing: true,
          activateMockifyer: true,
        }),
      ).toEqual({
        phase: 'capturing',
        activateMockifyer: true,
        capturing: true,
      });
    });

    it('treats idle as not activating', () => {
      expect(parseMetroAtlasSessionStatus({ phase: 'idle' })).toEqual({
        phase: 'idle',
        activateMockifyer: false,
        capturing: false,
      });
    });
  });

  describe('syncMockifyerFromMetroAtlasSession', () => {
    function capturingFetch(): typeof fetch {
      return jest.fn(async () => ({
        ok: true,
        json: async () => ({
          phase: 'capturing',
          capturing: true,
          activateMockifyer: true,
        }),
      })) as unknown as typeof fetch;
    }

    function idleFetch(): typeof fetch {
      return jest.fn(async () => ({
        ok: true,
        json: async () => ({
          phase: 'idle',
          capturing: false,
          activateMockifyer: false,
        }),
      })) as unknown as typeof fetch;
    }

    it('enables when capturing if off, then disables again when idle', async () => {
      let enabled = false;
      const enableMockifyer = jest.fn(() => {
        enabled = true;
      });
      const disableMockifyer = jest.fn(() => {
        enabled = false;
      });
      setRegisteredMockifyerRuntimeToggle({
        enableMockifyer,
        disableMockifyer,
        isMockifyerEnabled: () => enabled,
      });

      const first = await syncMockifyerFromMetroAtlasSession({
        metroBaseUrl: 'http://localhost:8081',
        fetchImpl: capturingFetch(),
      });
      expect(first).toBe(true);
      expect(enableMockifyer).toHaveBeenCalledTimes(1);
      expect(disableMockifyer).not.toHaveBeenCalled();

      const second = await syncMockifyerFromMetroAtlasSession({
        metroBaseUrl: 'http://localhost:8081',
        fetchImpl: capturingFetch(),
      });
      expect(second).toBe(false);
      expect(enableMockifyer).toHaveBeenCalledTimes(1);

      const stopped = await syncMockifyerFromMetroAtlasSession({
        metroBaseUrl: 'http://localhost:8081',
        fetchImpl: idleFetch(),
      });
      expect(stopped).toBe(true);
      expect(disableMockifyer).toHaveBeenCalledTimes(1);
      expect(enabled).toBe(false);
    });

    it('does not disable on stop when Mockifyer was already on', async () => {
      let enabled = true;
      const enableMockifyer = jest.fn(() => {
        enabled = true;
      });
      const disableMockifyer = jest.fn(() => {
        enabled = false;
      });
      setRegisteredMockifyerRuntimeToggle({
        enableMockifyer,
        disableMockifyer,
        isMockifyerEnabled: () => enabled,
      });

      const during = await syncMockifyerFromMetroAtlasSession({
        metroBaseUrl: 'http://localhost:8081',
        fetchImpl: capturingFetch(),
      });
      expect(during).toBe(false);
      expect(enableMockifyer).not.toHaveBeenCalled();

      const stopped = await syncMockifyerFromMetroAtlasSession({
        metroBaseUrl: 'http://localhost:8081',
        fetchImpl: idleFetch(),
      });
      expect(stopped).toBe(false);
      expect(disableMockifyer).not.toHaveBeenCalled();
      expect(enabled).toBe(true);
    });

    it('switches transiently so the saved launch preference is left alone', async () => {
      let enabled = false;
      const enableMockifyer = jest.fn(() => {
        enabled = true;
      });
      const disableMockifyer = jest.fn(() => {
        enabled = false;
      });
      setRegisteredMockifyerRuntimeToggle({
        enableMockifyer,
        disableMockifyer,
        isMockifyerEnabled: () => enabled,
      });

      await syncMockifyerFromMetroAtlasSession({
        metroBaseUrl: 'http://localhost:8081',
        fetchImpl: capturingFetch(),
      });
      await syncMockifyerFromMetroAtlasSession({
        metroBaseUrl: 'http://localhost:8081',
        fetchImpl: idleFetch(),
      });
      expect(enableMockifyer).toHaveBeenCalledWith({ transient: true });
      expect(disableMockifyer).toHaveBeenCalledWith({ transient: true });
    });

    it('leaves the toggle to the user once they switch it during capture', async () => {
      let enabled = false;
      const enableMockifyer = jest.fn(() => {
        enabled = true;
      });
      const disableMockifyer = jest.fn(() => {
        enabled = false;
      });
      setRegisteredMockifyerRuntimeToggle({
        enableMockifyer,
        disableMockifyer,
        isMockifyerEnabled: () => enabled,
      });

      await syncMockifyerFromMetroAtlasSession({
        metroBaseUrl: 'http://localhost:8081',
        fetchImpl: capturingFetch(),
      });
      expect(enabled).toBe(true);

      // User turns it off in the app while capture is still running.
      enabled = false;
      noteMockifyerToggledByUser();

      const during = await syncMockifyerFromMetroAtlasSession({
        metroBaseUrl: 'http://localhost:8081',
        fetchImpl: capturingFetch(),
      });
      expect(during).toBe(false);
      expect(enableMockifyer).toHaveBeenCalledTimes(1);

      const stopped = await syncMockifyerFromMetroAtlasSession({
        metroBaseUrl: 'http://localhost:8081',
        fetchImpl: idleFetch(),
      });
      expect(stopped).toBe(false);
      expect(disableMockifyer).not.toHaveBeenCalled();
    });

    it('does not re-enable after a restart when the user switched it off during capture', async () => {
      const store = new Map<string, string>();
      const g = globalThis as { localStorage?: unknown };
      g.localStorage = {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
      };
      try {
        type SyncModule = typeof import('@sgedda/mockifyer-core');
        const launch = (): SyncModule => {
          let mod: SyncModule | undefined;
          jest.isolateModules(() => {
            mod = require('@sgedda/mockifyer-core') as SyncModule;
          });
          return mod as SyncModule;
        };

        let enabled = false;
        const enableMockifyer = jest.fn(() => {
          enabled = true;
        });
        const toggle = {
          enableMockifyer,
          disableMockifyer: () => {
            enabled = false;
          },
          isMockifyerEnabled: () => enabled,
        };

        const first = launch();
        first.setRegisteredMockifyerRuntimeToggle(toggle);
        await first.syncMockifyerFromMetroAtlasSession({
          metroBaseUrl: 'http://localhost:8081',
          fetchImpl: capturingFetch(),
        });
        enabled = false;
        first.noteMockifyerToggledByUser();
        await Promise.resolve();

        // Fresh module state, same storage, Metro still capturing.
        const second = launch();
        second.setRegisteredMockifyerRuntimeToggle(toggle);
        const did = await second.syncMockifyerFromMetroAtlasSession({
          metroBaseUrl: 'http://localhost:8081',
          fetchImpl: capturingFetch(),
        });
        expect(did).toBe(false);
        expect(enableMockifyer).toHaveBeenCalledTimes(1);
        expect(enabled).toBe(false);
      } finally {
        delete g.localStorage;
      }
    });

    it('does not turn Mockifyer back on at launch when the user saved off and capture is already active', async () => {
      const store = new Map<string, string>([['@mockifyer/runtime-enabled', 'false']]);
      const g = globalThis as { localStorage?: unknown };
      g.localStorage = {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
      };
      try {
        let enabled = false;
        const enableMockifyer = jest.fn(() => {
          enabled = true;
        });
        setRegisteredMockifyerRuntimeToggle({
          enableMockifyer,
          disableMockifyer: () => {
            enabled = false;
          },
          isMockifyerEnabled: () => enabled,
        });

        const did = await syncMockifyerFromMetroAtlasSession({
          metroBaseUrl: 'http://localhost:8081',
          fetchImpl: capturingFetch(),
        });
        expect(did).toBe(false);
        expect(enableMockifyer).not.toHaveBeenCalled();
        expect(enabled).toBe(false);

        // Capture starts again after the app has seen Metro idle — that still enables.
        await syncMockifyerFromMetroAtlasSession({
          metroBaseUrl: 'http://localhost:8081',
          fetchImpl: idleFetch(),
        });
        const pressed = await syncMockifyerFromMetroAtlasSession({
          metroBaseUrl: 'http://localhost:8081',
          fetchImpl: capturingFetch(),
        });
        expect(pressed).toBe(true);
        expect(enableMockifyer).toHaveBeenCalledTimes(1);
      } finally {
        delete g.localStorage;
      }
    });

    it('does not enable when Metro reports idle and was never capturing', async () => {
      const enableMockifyer = jest.fn();
      const disableMockifyer = jest.fn();
      setRegisteredMockifyerRuntimeToggle({
        enableMockifyer,
        disableMockifyer,
        isMockifyerEnabled: () => false,
      });

      const did = await syncMockifyerFromMetroAtlasSession({
        metroBaseUrl: 'http://localhost:8081',
        fetchImpl: idleFetch(),
      });
      expect(did).toBe(false);
      expect(enableMockifyer).not.toHaveBeenCalled();
      expect(disableMockifyer).not.toHaveBeenCalled();
    });
  });
});
