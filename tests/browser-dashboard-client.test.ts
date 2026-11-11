/**
 * Tests for browser-safe dashboard client.
 */

import { BrowserDashboardClient } from '../packages/mockifyer-core/src/utils/dashboard-client.browser';

describe('BrowserDashboardClient', () => {
  const mockFetch = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('constructor', () => {
    it('normalizes dashboard base URL', () => {
      const client = new BrowserDashboardClient({
        dashboardBaseUrl: 'http://localhost:3002/',
      });
      expect(client.dashboardBaseUrl).toBe('http://localhost:3002');
    });

    it('stores auth credentials', () => {
      const client = new BrowserDashboardClient({
        dashboardBaseUrl: 'http://localhost:3002',
        auth: { user: 'admin', password: 'secret' },
      });
      expect(client.dashboardBaseUrl).toBe('http://localhost:3002');
    });

    it('stores client ID', () => {
      const client = new BrowserDashboardClient({
        dashboardBaseUrl: 'http://localhost:3002',
        clientId: 'web-client',
      });
      expect(client.clientId).toBe('web-client');
    });
  });

  describe('getScenarioConfig', () => {
    it('fetches scenario config from dashboard', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({
          currentScenario: 'test-scenario',
          scenarios: ['default', 'test-scenario'],
        }),
      });

      const client = new BrowserDashboardClient({
        dashboardBaseUrl: 'http://localhost:3002',
      });
      const config = await client.getScenarioConfig();

      expect(config.currentScenario).toBe('test-scenario');
      expect(config.scenarios).toEqual(['default', 'test-scenario']);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/scenario-config',
        expect.objectContaining({
          credentials: 'omit',
        })
      );
    });

    it('includes auth header when configured', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ currentScenario: 'default' }),
      });

      const client = new BrowserDashboardClient({
        dashboardBaseUrl: 'http://localhost:3002',
        auth: { user: 'admin', password: 'secret' },
      });
      await client.getScenarioConfig();

      const call = mockFetch.mock.calls[0];
      const headers = call[1].headers as Headers;
      expect(headers.get('Authorization')).toBe('Basic ' + btoa('admin:secret'));
    });

    it('throws on error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ error: 'Internal server error' }),
      });

      const client = new BrowserDashboardClient({
        dashboardBaseUrl: 'http://localhost:3002',
      });

      await expect(client.getScenarioConfig()).rejects.toThrow('Internal server error');
    });
  });

  describe('setScenario', () => {
    it('posts scenario change to dashboard', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            success: true,
            message: 'Scenario changed',
            currentScenario: 'new-scenario',
            scenarios: ['default', 'new-scenario'],
          }),
      });

      const client = new BrowserDashboardClient({
        dashboardBaseUrl: 'http://localhost:3002',
      });
      const result = await client.setScenario('new-scenario');

      expect(result.success).toBe(true);
      expect(result.currentScenario).toBe('new-scenario');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/scenario-config/set',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ scenario: 'new-scenario' }),
        })
      );
    });
  });

  describe('getClientLanes', () => {
    it('fetches client lanes from dashboard', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            enabled: true,
            lanes: [
              { clientId: 'web-client', scenario: 'test', note: null },
            ],
            discoveredLanes: ['web-client'],
            globalScenario: 'default',
          }),
      });

      const client = new BrowserDashboardClient({
        dashboardBaseUrl: 'http://localhost:3002',
      });
      const lanes = await client.getClientLanes();

      expect(lanes.enabled).toBe(true);
      expect(lanes.lanes).toHaveLength(1);
      expect(lanes.lanes[0].clientId).toBe('web-client');
    });
  });

  describe('setClientLaneScenario', () => {
    it('sets scenario for a client lane', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({}),
      });

      const client = new BrowserDashboardClient({
        dashboardBaseUrl: 'http://localhost:3002',
      });
      await client.setClientLaneScenario('web-client', 'test-scenario');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/client-lanes/web-client/scenario',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ scenario: 'test-scenario' }),
        })
      );
    });
  });

  describe('postNetworkEvent', () => {
    it('posts network event to dashboard', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ ok: true }),
      });

      const client = new BrowserDashboardClient({
        dashboardBaseUrl: 'http://localhost:3002',
        clientId: 'web-client',
      });
      await client.postNetworkEvent({
        transport: 'fetch',
        method: 'GET',
        url: 'https://api.example.com/data',
        source: 'mock-hit',
        status: 200,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/network-events',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('mock-hit'),
        })
      );
    });

    it('never throws on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const client = new BrowserDashboardClient({
        dashboardBaseUrl: 'http://localhost:3002',
      });

      // Should not throw
      await expect(
        client.postNetworkEvent({
          transport: 'fetch',
          method: 'GET',
          url: 'https://api.example.com/data',
          source: 'mock-hit',
        })
      ).resolves.toBeUndefined();
    });
  });

  describe('health', () => {
    it('returns true when dashboard is reachable', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const client = new BrowserDashboardClient({
        dashboardBaseUrl: 'http://localhost:3002',
      });
      const healthy = await client.health();

      expect(healthy).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3002/api/health',
        expect.objectContaining({ credentials: 'omit' })
      );
    });

    it('returns false when dashboard is unreachable', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const client = new BrowserDashboardClient({
        dashboardBaseUrl: 'http://localhost:3002',
      });
      const healthy = await client.health();

      expect(healthy).toBe(false);
    });
  });

  describe('pollScenario', () => {
    it('returns current scenario on success', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ currentScenario: 'test' }),
      });

      const client = new BrowserDashboardClient({
        dashboardBaseUrl: 'http://localhost:3002',
      });
      const scenario = await client.pollScenario();

      expect(scenario).toBe('test');
    });

    it('returns null on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const client = new BrowserDashboardClient({
        dashboardBaseUrl: 'http://localhost:3002',
      });
      const scenario = await client.pollScenario();

      expect(scenario).toBe(null);
    });
  });

  describe('pollClientLaneScenario', () => {
    it('returns lane scenario when lanes are enabled', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            enabled: true,
            lanes: [{ clientId: 'web-client', scenario: 'test', note: null }],
            globalScenario: 'default',
          }),
      });

      const client = new BrowserDashboardClient({
        dashboardBaseUrl: 'http://localhost:3002',
      });
      const scenario = await client.pollClientLaneScenario('web-client');

      expect(scenario).toBe('test');
    });

    it('returns global scenario when lane not found', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            enabled: true,
            lanes: [],
            globalScenario: 'default',
          }),
      });

      const client = new BrowserDashboardClient({
        dashboardBaseUrl: 'http://localhost:3002',
      });
      const scenario = await client.pollClientLaneScenario('unknown');

      expect(scenario).toBe('default');
    });

    it('returns null when lanes are disabled', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            enabled: false,
            lanes: [],
            globalScenario: null,
          }),
      });

      const client = new BrowserDashboardClient({
        dashboardBaseUrl: 'http://localhost:3002',
      });
      const scenario = await client.pollClientLaneScenario('web-client');

      expect(scenario).toBe(null);
    });

    it('returns null on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const client = new BrowserDashboardClient({
        dashboardBaseUrl: 'http://localhost:3002',
      });
      const scenario = await client.pollClientLaneScenario('web-client');

      expect(scenario).toBe(null);
    });
  });
});
