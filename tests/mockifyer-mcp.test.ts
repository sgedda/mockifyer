import {
  DashboardApiClient,
  encodeMockFilename,
  resolveDashboardApiBaseFromEnv,
} from '../packages/mockifyer-mcp/src/dashboard-client';

describe('mockifyer-mcp dashboard-client', () => {
  it('encodeMockFilename encodes each path segment', () => {
    expect(encodeMockFilename('api.example.com/orders/file.json')).toBe(
      'api.example.com/orders/file.json'
    );
    expect(encodeMockFilename('host/weird name/file.json')).toBe(
      'host/weird%20name/file.json'
    );
  });

  it('resolveDashboardApiBaseFromEnv combines URL and mount prefix', () => {
    const prevUrl = process.env.MOCKIFYER_DASHBOARD_URL;
    const prevBase = process.env.MOCKIFYER_DASHBOARD_BASE;
    process.env.MOCKIFYER_DASHBOARD_URL = 'http://localhost:3002/';
    process.env.MOCKIFYER_DASHBOARD_BASE = '/dashboard';
    expect(resolveDashboardApiBaseFromEnv()).toBe('http://localhost:3002/dashboard/api');
    process.env.MOCKIFYER_DASHBOARD_URL = prevUrl;
    process.env.MOCKIFYER_DASHBOARD_BASE = prevBase;
  });

  it('getMockAiContext builds the ai-context URL', async () => {
    const calls: string[] = [];
    const client = new DashboardApiClient({ apiBase: 'http://test/api' });

    const originalFetch = global.fetch;
    global.fetch = async (input) => {
      calls.push(String(input));
      return new Response(
        JSON.stringify({
          filename: 'a.json',
          scenario: 'default',
          endpoint: { method: 'GET', url: 'https://x/y', pathname: '/y' },
          status: 200,
          mode: 'profile',
          profile: { fields: {}, schema: {}, stateHints: [] },
          discovery: {
            sources: [],
            includedPaths: 0,
            omittedPaths: 0,
            omittedBytes: 0,
            mode: 'profile',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      await client.getMockAiContext({
        filename: 'host/a.json',
        scenario: 'default',
        mode: 'schema',
      });
      expect(calls[0]).toBe(
        'http://test/api/mocks/host/a.json/ai-context?scenario=default&mode=schema'
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('listNetworkEvents builds the network-events URL', async () => {
    const calls: string[] = [];
    const client = new DashboardApiClient({ apiBase: 'http://test/api' });

    const originalFetch = global.fetch;
    global.fetch = async (input) => {
      calls.push(String(input));
      return new Response(
        JSON.stringify({
          scenario: 'default',
          provider: 'filesystem',
          ephemeral: true,
          networkLogConfig: { enabled: true, captureBodies: false, updatedAt: '2026-01-01T00:00:00.000Z' },
          events: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      await client.listNetworkEvents({ scenario: 'default', limit: 50, since: '2026-01-01T00:00:00.000Z' });
      expect(calls[0]).toBe(
        'http://test/api/network-events?scenario=default&limit=50&since=2026-01-01T00%3A00%3A00.000Z'
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('getNetworkTrace builds the trace URL with requestId', async () => {
    const calls: string[] = [];
    const client = new DashboardApiClient({ apiBase: 'http://test/api' });

    const originalFetch = global.fetch;
    global.fetch = async (input) => {
      calls.push(String(input));
      return new Response(
        JSON.stringify({
          provider: 'filesystem',
          networkLogConfig: { enabled: true, captureBodies: true, updatedAt: '2026-01-01T00:00:00.000Z' },
          trace: {
            lookup: { by: 'requestId', value: 'req-1' },
            scenario: 'default',
            rootRequestId: 'req-1',
            anchorRequestId: 'req-1',
            anchorEventId: 'ev-1',
            hopCount: 1,
            hops: [],
            incomplete: false,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      await client.getNetworkTrace({ requestId: 'req-1', scenario: 'default' });
      expect(calls[0]).toBe('http://test/api/network-events/trace?scenario=default&requestId=req-1');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('getNetworkTrace rejects missing lookup keys', async () => {
    const client = new DashboardApiClient({ apiBase: 'http://test/api' });
    await expect(client.getNetworkTrace({})).rejects.toThrow(/requestId|eventId/);
    await expect(client.getNetworkTrace({ requestId: 'a', eventId: 'b' })).rejects.toThrow(/only one/);
  });

  it('getNetworkLogConfig builds the config URL', async () => {
    const calls: string[] = [];
    const client = new DashboardApiClient({ apiBase: 'http://test/api' });

    const originalFetch = global.fetch;
    global.fetch = async (input) => {
      calls.push(String(input));
      return new Response(
        JSON.stringify({
          scenario: 'default',
          provider: 'filesystem',
          enabled: true,
          captureBodies: true,
          updatedAt: '2026-01-01T00:00:00.000Z',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      await client.getNetworkLogConfig('default');
      expect(calls[0]).toBe('http://test/api/network-events/config?scenario=default');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('setScenario POSTs to scenario-config/set', async () => {
    const calls: Array<{ url: string; method?: string; body?: string }> = [];
    const client = new DashboardApiClient({ apiBase: 'http://test/api' });

    const originalFetch = global.fetch;
    global.fetch = async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method,
        body: typeof init?.body === 'string' ? init.body : undefined,
      });
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Scenario switched to "check-in-open"',
          currentScenario: 'check-in-open',
          scenarios: ['check-in-open', 'default'],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      const result = await client.setScenario('check-in-open');
      expect(calls[0]).toEqual({
        url: 'http://test/api/scenario-config/set',
        method: 'POST',
        body: JSON.stringify({ scenario: 'check-in-open' }),
      });
      expect(result.currentScenario).toBe('check-in-open');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('createScenario POSTs deriveFrom to scenario-config/create', async () => {
    const calls: Array<{ url: string; method?: string; body?: string }> = [];
    const client = new DashboardApiClient({ apiBase: 'http://test/api' });

    const originalFetch = global.fetch;
    global.fetch = async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method,
        body: typeof init?.body === 'string' ? init.body : undefined,
      });
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Scenario "check-in-open" created successfully',
          currentScenario: 'check-in-open',
          scenarios: ['check-in-open', 'default'],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      await client.createScenario('check-in-open', 'default');
      expect(calls[0]).toEqual({
        url: 'http://test/api/scenario-config/create',
        method: 'POST',
        body: JSON.stringify({ scenario: 'check-in-open', deriveFrom: 'default' }),
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('setClientLaneScenario PUTs lane scenario mapping', async () => {
    const calls: Array<{ url: string; method?: string; body?: string }> = [];
    const client = new DashboardApiClient({ apiBase: 'http://test/api' });

    const originalFetch = global.fetch;
    global.fetch = async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method,
        body: typeof init?.body === 'string' ? init.body : undefined,
      });
      return new Response(
        JSON.stringify({
          success: true,
          lanes: [{ clientId: 'trips-e2e-checkin', scenario: 'check-in-open', note: null }],
          globalScenario: 'default',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      await client.setClientLaneScenario('trips-e2e-checkin', 'check-in-open');
      expect(calls[0]).toEqual({
        url: 'http://test/api/client-lanes/trips-e2e-checkin/scenario',
        method: 'PUT',
        body: JSON.stringify({ scenario: 'check-in-open' }),
      });

      await client.setClientLaneScenario('trips-e2e-checkin', null);
      expect(calls[1]).toEqual({
        url: 'http://test/api/client-lanes/trips-e2e-checkin/scenario',
        method: 'PUT',
        body: JSON.stringify({ scenario: null }),
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('listClientLanes GETs client-lanes', async () => {
    const calls: string[] = [];
    const client = new DashboardApiClient({ apiBase: 'http://test/api' });

    const originalFetch = global.fetch;
    global.fetch = async (input) => {
      calls.push(String(input));
      return new Response(
        JSON.stringify({
          enabled: true,
          lanes: [],
          discoveredLanes: [],
          globalScenario: 'default',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    try {
      await client.listClientLanes();
      expect(calls[0]).toBe('http://test/api/client-lanes');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
