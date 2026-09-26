import {
  clearMetroAtlasRuntimeSyncState,
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
    it('calls enableMockifyer when Metro reports capturing', async () => {
      let enabled = false;
      const enableMockifyer = jest.fn(() => {
        enabled = true;
      });
      setRegisteredMockifyerRuntimeToggle({
        enableMockifyer,
        isMockifyerEnabled: () => enabled,
      });

      const fetchImpl = jest.fn(async () => ({
        ok: true,
        json: async () => ({
          phase: 'capturing',
          capturing: true,
          activateMockifyer: true,
        }),
      })) as unknown as typeof fetch;

      const first = await syncMockifyerFromMetroAtlasSession({
        metroBaseUrl: 'http://localhost:8081',
        fetchImpl,
      });
      expect(first).toBe(true);
      expect(enableMockifyer).toHaveBeenCalledTimes(1);

      const second = await syncMockifyerFromMetroAtlasSession({
        metroBaseUrl: 'http://localhost:8081',
        fetchImpl,
      });
      expect(second).toBe(false);
      expect(enableMockifyer).toHaveBeenCalledTimes(1);
    });

    it('does not enable when Metro reports idle', async () => {
      const enableMockifyer = jest.fn();
      setRegisteredMockifyerRuntimeToggle({
        enableMockifyer,
        isMockifyerEnabled: () => false,
      });

      const fetchImpl = jest.fn(async () => ({
        ok: true,
        json: async () => ({ phase: 'idle', capturing: false, activateMockifyer: false }),
      })) as unknown as typeof fetch;

      const did = await syncMockifyerFromMetroAtlasSession({
        metroBaseUrl: 'http://localhost:8081',
        fetchImpl,
      });
      expect(did).toBe(false);
      expect(enableMockifyer).not.toHaveBeenCalled();
    });
  });
});
