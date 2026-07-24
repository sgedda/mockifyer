/** Canonical product copy aligned with packages/mockifyer-* (source of truth for the public site). */

export const SITE_GITHUB = 'https://github.com/sgedda/mockifyer'
export const SITE_NPM_SCOPE = 'https://www.npmjs.com/~sgedda'

export interface PublishedPackage {
  name: string
  version: string
  role: string
  install?: string
  npmUrl: string
}

// Package versions below — update when bumping releases in packages/mockifyer-*.
export const PUBLISHED_PACKAGES: PublishedPackage[] = [
  {
    name: '@sgedda/mockifyer-core',
    version: '1.8.37',
    role: 'Types, mock matching, scenarios, date helpers, activation mode, request correlation, AI context builders',
    npmUrl: 'https://www.npmjs.com/package/@sgedda/mockifyer-core',
  },
  {
    name: '@sgedda/mockifyer-axios',
    version: '1.8.21',
    role: 'Axios interceptors — `setupMockifyer()` for Node and browser',
    install: 'npm install @sgedda/mockifyer-core @sgedda/mockifyer-axios axios',
    npmUrl: 'https://www.npmjs.com/package/@sgedda/mockifyer-axios',
  },
  {
    name: '@sgedda/mockifyer-fetch',
    version: '1.8.31',
    role: 'fetch interceptors for Node.js, React Native, and Expo; dashboard proxy helpers',
    install: 'npm install @sgedda/mockifyer-core @sgedda/mockifyer-fetch',
    npmUrl: 'https://www.npmjs.com/package/@sgedda/mockifyer-fetch',
  },
  {
    name: '@sgedda/mockifyer-dashboard',
    version: '1.4.50',
    role: 'CLI + UI to browse, edit, and activate mocks; Redis proxy and client lanes',
    install: 'npx @sgedda/mockifyer-dashboard --path ./mock-data',
    npmUrl: 'https://www.npmjs.com/package/@sgedda/mockifyer-dashboard',
  },
  {
    name: '@sgedda/mockifyer-mcp',
    version: '0.1.0',
    role: 'MCP server for Cursor / Claude — search mocks, AI context, field overrides (requires dashboard)',
    npmUrl: 'https://www.npmjs.com/package/@sgedda/mockifyer-mcp',
  },
  {
    name: '@sgedda/mockifyer-test-helper',
    version: '1.8.9',
    role: 'Test utilities and auto-setup for realistic mock data in tests',
    npmUrl: 'https://www.npmjs.com/package/@sgedda/mockifyer-test-helper',
  },
]

export interface EnvVarDoc {
  name: string
  description: string
  values?: string
}

export const ENV_VAR_DOCS: EnvVarDoc[] = [
  {
    name: 'MOCKIFYER_RECORD',
    description: 'Record real API responses to JSON files when true.',
    values: 'true | false',
  },
  {
    name: 'MOCKIFYER_PATH',
    description: 'Mock data root directory (same as mockDataPath in config).',
  },
  {
    name: 'MOCKIFYER_SCENARIO',
    description: 'Active scenario folder under mock-data/.',
  },
  {
    name: 'MOCKIFYER_MODE',
    description:
      'React Native / Expo: when setupMockifyerForReactNative patches fetch at startup.',
    values: 'on (default) | launch_client | off',
  },
  {
    name: 'MOCKIFYER_ACTIVATION_MODE',
    description:
      'When each outbound request uses Mockifyer (Node axios/fetch). Overrides activationMode in config.',
    values: 'always (default) | client_id_header | off',
  },
  {
    name: 'MOCKIFYER_CLIENT_ID',
    description:
      'Logical client lane for scenario isolation (multi-service / dashboard Redis proxy).',
  },
  {
    name: 'MOCKIFYER_DATE',
    description: 'Fixed ISO date for getCurrentDate() and response date overrides.',
  },
  {
    name: 'MOCKIFYER_DATE_OFFSET',
    description: 'Millisecond offset from current time.',
  },
  {
    name: 'MOCKIFYER_TIMEZONE',
    description: 'IANA timezone for date operations.',
  },
  {
    name: 'MOCKIFYER_USE_SIMILAR_MATCH',
    description: 'Fallback matching on path + method when exact mock key misses.',
    values: 'true | false',
  },
  {
    name: 'MOCKIFYER_USE_SIMILAR_MATCH_CHECK_RESPONSE',
    description: 'When similar matching, also compare response shape.',
    values: 'true | false',
  },
  {
    name: 'MOCKIFYER_RECORD_NEW_AS_PASSTHROUGH',
    description:
      'New recordings stay on the live API until activated in the dashboard (alwaysUseRealApi).',
    values: 'true | false',
  },
  {
    name: 'MOCKIFYER_REFRESH_PASSTHROUGH_RECORDINGS',
    description: 'Update passthrough mock files on each live API response.',
    values: 'true | false',
  },
  {
    name: 'MOCKIFYER_STRICT_SCENARIO',
    description:
      'Dashboard proxy: bypass Mockifyer until clientId or proxy.scenario is set.',
    values: 'true | false',
  },
  {
    name: 'MOCKIFYER_STRICT_LANE_SCENARIO',
    description:
      'Dashboard proxy: no global scenario fallback when clientId is set (lane-only). Default true with proxy.',
    values: 'true | false',
  },
  {
    name: 'MOCKIFYER_DASHBOARD_URL',
    description: 'Dashboard origin for optional SDK network log POSTs (/api/network-events).',
  },
]

export const SETUP_MOCKIFYER_OPTIONS = `{
  mockDataPath: string;              // Required: ./mock-data
  recordMode?: boolean;
  failOnMissingMock?: boolean;
  activationMode?: 'always' | 'client_id_header' | 'off';
  clientId?: string;                 // Lane id (or MOCKIFYER_CLIENT_ID)
  useGlobalAxios?: boolean;          // axios package
  useGlobalFetch?: boolean;          // fetch package
  runtimeMode?: 'on' | 'launch_client' | 'off';  // React Native startup
  recordNewMocksAsPassthrough?: boolean;
  refreshPassthroughRecordings?: boolean;
  useSimilarMatch?: boolean;
  useSimilarMatchCheckResponse?: boolean;
  defaultScenario?: string;
  dateManipulation?: {
    fixedDate?: string | Date;
    offset?: number;
    timezone?: string;
  };
  generateTests?: {
    enabled?: boolean;
    framework?: 'jest' | 'vitest' | 'mocha';
    outputPath?: string;
  };
  proxy?: {                          // fetch: dashboard Redis proxy
    baseUrl?: string;
    strictLaneScenario?: boolean;
  };
}`

export const KEY_FEATURES = [
  {
    icon: '🔒',
    title: 'Record & replay',
    description: 'Capture live axios/fetch responses as JSON; replay offline in dev and CI',
  },
  {
    icon: '🔍',
    title: 'GraphQL matching',
    description: 'Normalized query + sorted variables — reliable replay for GraphQL APIs',
  },
  {
    icon: '📅',
    title: 'Date manipulation',
    description: 'fixedDate, offset, timezone via getCurrentDate() — no flaky time-based tests',
  },
  {
    icon: '🎭',
    title: 'Scenarios',
    description: 'mock-data/<scenario>/ datasets — happy path, errors, and edge cases',
  },
  {
    icon: '🛤️',
    title: 'Client lanes',
    description: 'MOCKIFYER_CLIENT_ID + dashboard Redis proxy for multi-service isolation',
  },
  {
    icon: '🎚️',
    title: 'Activation modes',
    description: 'always, client_id_header (X-Mockifyer-Client-Id), or off per request',
  },
  {
    icon: '📊',
    title: 'Dashboard',
    description: 'Browse, edit, activate passthrough mocks; network timeline and client lanes',
  },
  {
    icon: '🤖',
    title: 'MCP + AI context',
    description: 'mockifyer-mcp tools and lightweight mock projections for IDE assistants',
  },
  {
    icon: '📱',
    title: 'React Native',
    description: 'Hybrid storage, Metro sync, Maestro launch_client mode',
  },
  {
    icon: '🔗',
    title: 'Request correlation',
    description: 'x-mockifyer-request-id headers to trace multi-hop outbound chains',
  },
] as const

export const ACTIVATION_MODE_DOCS = [
  {
    mode: 'always',
    description: 'Default. Every outbound request uses Mockifyer (subject to excludedUrls).',
  },
  {
    mode: 'client_id_header',
    description:
      'Only when X-Mockifyer-Client-Id is set on the request. Ideal for multi-service graphs and opt-in test lanes.',
  },
  {
    mode: 'off',
    description: 'Plain HTTP — no mock lookup or recording.',
  },
] as const

export const MCP_TOOLS = [
  'mockifyer_get_mock_ai_context — lightweight fields/schema for AI',
  'mockifyer_search_mocks / mockifyer_list_mocks',
  'mockifyer_set_field_overrides / mockifyer_copy_array_item',
  'mockifyer_list_scenarios / mockifyer_set_scenario / mockifyer_create_scenario',
  'mockifyer_list_client_lanes / mockifyer_set_client_lane_scenario',
  'mockifyer_get_endpoint_stats',
] as const
