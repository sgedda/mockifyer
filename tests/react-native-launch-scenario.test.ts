jest.mock(
  'react-native-launch-arguments',
  () => ({
    LaunchArguments: {
      value: jest.fn(() => ({})),
    },
  }),
  { virtual: true }
);

import { setScenarioLaunchOverride } from '../packages/mockifyer-core/src/index.react-native';
import { setupMockifyerForReactNative } from '../packages/mockifyer-fetch/src/react-native';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { LaunchArguments } = require('react-native-launch-arguments');

const DASHBOARD_URL = 'http://dashboard.test';
const LAUNCH_SCENARIO = 'e2e-login';

describe('setupMockifyerForReactNative launch scenario (no lane)', () => {
  const originalFetch = global.fetch;
  let upstreamFetch: jest.Mock;

  beforeEach(() => {
    (LaunchArguments.value as jest.Mock).mockReturnValue({ scenario: LAUNCH_SCENARIO });
    upstreamFetch = jest.fn(async () =>
      new Response(
        JSON.stringify({
          source: 'redis',
          response: { data: { ok: true }, status: 200, headers: {} },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    global.fetch = upstreamFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    setScenarioLaunchOverride(null);
    (LaunchArguments.value as jest.Mock).mockReturnValue({});
  });

  it('activates under launch_client and sends the launch scenario on dashboard proxy requests', async () => {
    const result = await setupMockifyerForReactNative({
      isDev: true,
      runtimeMode: 'launch_client',
      proxyBaseUrl: DASHBOARD_URL,
      skipDashboardRedisHealthCheck: true,
    });

    expect(result.status).toBe('active');
    expect(result.instance?.isMockifyerEnabled()).toBe(true);

    const response = await fetch('https://api.example.com/profile');
    expect(await response.json()).toEqual({ ok: true });

    const proxyCall = upstreamFetch.mock.calls.find(([url]) =>
      String(url).startsWith(`${DASHBOARD_URL}/api/proxy`)
    );
    expect(proxyCall).toBeDefined();
    const envelope = JSON.parse(String((proxyCall![1] as RequestInit).body));
    expect(envelope.scenario).toBe(LAUNCH_SCENARIO);
  });
});
