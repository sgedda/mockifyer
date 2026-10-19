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
