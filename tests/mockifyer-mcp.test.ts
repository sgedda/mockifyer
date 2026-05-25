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
});
