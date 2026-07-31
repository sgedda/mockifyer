import {
  resolveClientInitFlags,
  splitDualClientConfigs,
  syncDualMockifyerControls,
  pickPrimaryDualMockifyerInstance,
  buildLocalFilesystemConfig,
  initMockifyerForLocalFilesystemClients,
  type DualMockifyerControlSurface,
  type MockifyerConfig,
} from '../packages/mockifyer-core/src';

describe('dual-client init presets', () => {
  describe('resolveClientInitFlags', () => {
    it('uses package defaults when options omit flags', () => {
      expect(
        resolveClientInitFlags({}, { useGlobalFetch: true, useGlobalAxios: false })
      ).toEqual({ useFetch: true, useAxios: false });

      expect(
        resolveClientInitFlags({}, { useGlobalFetch: false, useGlobalAxios: true })
      ).toEqual({ useFetch: false, useAxios: true });
    });

    it('prefers explicit options over config and defaults', () => {
      expect(
        resolveClientInitFlags(
          {
            useGlobalFetch: true,
            useGlobalAxios: true,
            config: { useGlobalFetch: false, useGlobalAxios: false },
          },
          { useGlobalFetch: false, useGlobalAxios: false }
        )
      ).toEqual({ useFetch: true, useAxios: true });
    });

    it('falls back to config when options omit a flag', () => {
      expect(
        resolveClientInitFlags(
          { config: { useGlobalAxios: true } },
          { useGlobalFetch: true, useGlobalAxios: false }
        )
      ).toEqual({ useFetch: true, useAxios: true });
    });
  });

  describe('splitDualClientConfigs', () => {
    it('splits shared config so each client only patches itself', () => {
      const shared: MockifyerConfig = {
        mockDataPath: './mock-data',
        useGlobalFetch: true,
        useGlobalAxios: true,
        axiosInstance: { id: 'user-axios' },
        clientId: 'lane-a',
      };

      const { fetchConfig, axiosConfig } = splitDualClientConfigs(shared, {
        useFetch: true,
        useAxios: true,
      });

      expect(fetchConfig).toMatchObject({
        mockDataPath: './mock-data',
        clientId: 'lane-a',
        useGlobalFetch: true,
        useGlobalAxios: false,
      });
      expect(axiosConfig).toMatchObject({
        mockDataPath: './mock-data',
        clientId: 'lane-a',
        useGlobalFetch: false,
        useGlobalAxios: true,
        axiosInstance: { id: 'user-axios' },
      });
    });

    it('omits unused client configs', () => {
      const shared: MockifyerConfig = { mockDataPath: './mock-data' };
      expect(
        splitDualClientConfigs(shared, { useFetch: true, useAxios: false }).axiosConfig
      ).toBeUndefined();
      expect(
        splitDualClientConfigs(shared, { useFetch: false, useAxios: true }).fetchConfig
      ).toBeUndefined();
    });
  });

  describe('buildLocalFilesystemConfig', () => {
    it('passes axiosInstance from top-level options', () => {
      const axiosInstance = { interceptors: {} };
      const config = buildLocalFilesystemConfig(
        {
          mockDataPath: './fixtures',
          axiosInstance,
          useGlobalAxios: true,
        },
        { useFetch: false, useAxios: true }
      );
      expect(config.axiosInstance).toBe(axiosInstance);
      expect(config.useGlobalAxios).toBe(true);
      expect(config.useGlobalFetch).toBe(false);
    });
  });

  describe('syncDualMockifyerControls / pickPrimaryDualMockifyerInstance', () => {
    function createSurface(id: string): DualMockifyerControlSurface & { lane?: string; id: string } {
      const surface: DualMockifyerControlSurface & { lane?: string; id: string } = {
        id,
        setClientId(lane: string) {
          surface.lane = lane;
        },
        getClientId() {
          return surface.lane;
        },
        reloadMockData() {
          return `${id}-reloaded`;
        },
        clearStaleCacheEntries() {
          return 1;
        },
      };
      return surface;
    }

    it('forwards setClientId to both instances', () => {
      const fetchInst = createSurface('fetch');
      const axiosInst = createSurface('axios');
      const primary = pickPrimaryDualMockifyerInstance(
        'fetch',
        { useFetch: true, useAxios: true },
        { fetch: fetchInst, axios: axiosInst }
      );

      primary.setClientId('shared-lane');
      expect(fetchInst.getClientId()).toBe('shared-lane');
      expect(axiosInst.getClientId()).toBe('shared-lane');
      expect(primary.clearStaleCacheEntries()).toBe(2);
    });

    it('prefers axios as primary when host is axios', () => {
      const fetchInst = createSurface('fetch');
      const axiosInst = createSurface('axios');
      const primary = pickPrimaryDualMockifyerInstance(
        'axios',
        { useFetch: true, useAxios: true },
        { fetch: fetchInst, axios: axiosInst }
      );
      expect(primary).toBe(axiosInst);
    });
  });

  describe('initMockifyerForLocalFilesystemClients', () => {
    it('calls each setup once with split flags', () => {
      const fetchCalls: MockifyerConfig[] = [];
      const axiosCalls: MockifyerConfig[] = [];

      const result = initMockifyerForLocalFilesystemClients(
        {
          mockDataPath: './mock-data',
          axiosInstance: { tag: 'ax' },
          config: { clientId: 'svc-1' },
        },
        {
          fetch: (config) => {
            fetchCalls.push(config);
            return { kind: 'fetch' };
          },
          axios: (config) => {
            axiosCalls.push(config);
            return { kind: 'axios' };
          },
        },
        { useFetch: true, useAxios: true }
      );

      expect(result).toEqual({ fetch: { kind: 'fetch' }, axios: { kind: 'axios' } });
      expect(fetchCalls).toHaveLength(1);
      expect(axiosCalls).toHaveLength(1);
      expect(fetchCalls[0].useGlobalFetch).toBe(true);
      expect(fetchCalls[0].useGlobalAxios).toBe(false);
      expect(axiosCalls[0].useGlobalAxios).toBe(true);
      expect(axiosCalls[0].useGlobalFetch).toBe(false);
      expect(axiosCalls[0].axiosInstance).toEqual({ tag: 'ax' });
      expect(fetchCalls[0].clientId).toBe('svc-1');
      expect(axiosCalls[0].clientId).toBe('svc-1');
    });

    it('throws when neither client is enabled', () => {
      expect(() =>
        initMockifyerForLocalFilesystemClients({}, {}, { useFetch: false, useAxios: false })
      ).toThrow(/enable at least one/);
    });

    it('throws when axios is requested without a setup', () => {
      expect(() =>
        initMockifyerForLocalFilesystemClients(
          {},
          { fetch: () => ({}) },
          { useFetch: true, useAxios: true }
        )
      ).toThrow(/no axios setupMockifyer/);
    });
  });
});
