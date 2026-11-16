/**
 * Single source of truth for SEO route configuration.
 * Used by both the client-side app and the prerender script.
 */

export interface PageSeoConfig {
  title: string
  description: string
  path: string
  noIndex?: boolean
}

export const SITE_URL = 'https://mockifyer.dev'
export const SITE_NAME = 'Mockifyer'

export const DEFAULT_TITLE = 'Mockifyer — Record & Replay HTTP API Mocks'
export const DEFAULT_DESCRIPTION =
  'Record axios and fetch calls as JSON and replay them in Node and React Native. Selective recording by default; mocks stay in your repo.'

/**
 * SEO configuration for all routes.
 * To add a new route: add one entry here with title (without ' | Mockifyer' suffix),
 * description (<=155 chars), and path. The title suffix is added automatically by formatPageTitle.
 */
export const PAGE_SEO: Record<string, PageSeoConfig> = {
  '/': {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    path: '/',
  },
  '/getting-started': {
    title: 'Getting Started with Mockifyer',
    description:
      'Install @sgedda/mockifyer-axios or mockifyer-fetch, configure mock data paths, and start recording or replaying HTTP API responses in minutes.',
    path: '/getting-started',
  },
  '/date-config': {
    title: 'Date Configuration',
    description:
      'Control time in tests with Mockifyer date manipulation — fixed dates, offsets, and deterministic time-dependent API behavior.',
    path: '/date-config',
  },
  '/config-reference': {
    title: 'Configuration Reference',
    description:
      'Complete reference for Mockifyer environment variables, mock data paths, recording modes, and activation settings.',
    path: '/config-reference',
  },
  '/faq': {
    title: 'Mockifyer FAQ: Record-Replay API Mocks',
    description:
      'Frequently asked questions about Mockifyer: how to record API calls, switch scenarios, and use the dashboard and MCP tools.',
    path: '/faq',
  },
  '/contact': {
    title: 'Contact',
    description:
      'Get in touch about Mockifyer — questions, feedback, and support for API mocking and record-replay testing.',
    path: '/contact',
  },
  '/e2e-tutorial': {
    title: 'E2E Tutorial: Multi-Service Mocks',
    description:
      'End-to-end walkthrough using the WanderWeird demo: a multi-service Expo app with scenarios, dashboard control, and nested request tracing.',
    path: '/e2e-tutorial',
  },
  '/guides/mock-at-the-network-edge': {
    title: 'Mock at the Network Edge - Testing Guide',
    description:
      'Stop mocking hooks and components. Mock HTTP at the network edge to test what users see. Real response shapes, survive refactors, catch breaking API changes.',
    path: '/guides/mock-at-the-network-edge',
  },
  '/guides/reproduce-tester-bugs': {
    title: 'Reproduce Tester Bugs Locally - Testing Guide',
    description:
      'Capture API calls from tester devices, trace requests across services via x-mockifyer-request-id, export as curl, and replay bugs locally.',
    path: '/guides/reproduce-tester-bugs',
  },
  '/guides/stable-react-native-e2e': {
    title: 'Stable React Native E2E Tests - Detox, Appium, Maestro',
    description:
      'Stop Detox, Appium, and Maestro flakes. Lock scenarios with launch arguments, freeze dates, and make the backend deterministic.',
    path: '/guides/stable-react-native-e2e',
  },
  '/guides/mock-drift': {
    title: 'Stop Hand-Written API Mocks from Drifting',
    description:
      'Hand-written mocks drift from real APIs. Record real responses, re-record when APIs change, and git diff to catch breaking changes.',
    path: '/guides/mock-drift',
  },
  '/guides/react-native-without-msw': {
    title: 'MSW vs Recording in React Native',
    description:
      'Compare MSW and Mockifyer for React Native. Recording works on device with no service worker, supports Expo and bare React Native.',
    path: '/guides/react-native-without-msw',
  },
  '/guides/browser-record-replay': {
    title: 'Record and Replay HTTP in the Browser',
    description:
      'Use Mockifyer to record and replay HTTP fetch calls in browser environments, Expo web builds, and Vite projects with the memory provider.',
    path: '/guides/browser-record-replay',
  },
  '/guides/react-native-expo': {
    title: 'React Native + Expo Setup Guide',
    description:
      'Set up Mockifyer in React Native and Expo projects. Configure providers, handle Metro bundler, and record API calls on iOS and Android.',
    path: '/guides/react-native-expo',
  },
  '/guides/selective-recording': {
    title: 'Selective Recording - Record Only What You Need',
    description:
      'Use recordResponses patterns to record only specific URLs. Save repo space by recording full responses selectively.',
    path: '/guides/selective-recording',
  },
  '/guides/record-replay': {
    title: 'Record & Replay Workflow',
    description:
      'Learn the Mockifyer record-replay workflow: capture real API calls, commit mocks to git, and replay them in tests.',
    path: '/guides/record-replay',
  },
  '/guides/maestro-detox-mocks': {
    title: 'Maestro & Detox with Mocked APIs',
    description:
      'Use Mockifyer with Maestro and Detox for stable React Native E2E tests. Lock scenarios and eliminate backend flakes.',
    path: '/guides/maestro-detox-mocks',
  },
  '/guides/scenarios': {
    title: 'Scenarios - Switch Between Test States',
    description:
      'Use scenarios to switch between test states: happy path, errors, edge cases. Organize mocks and test multiple flows.',
    path: '/guides/scenarios',
  },
  '/guides': {
    title: 'Mockifyer Guides: Testing Patterns and Best Practices',
    description:
      'In-depth guides for testing patterns, React Native E2E, debugging tester bugs, and avoiding mock drift with Mockifyer record-replay.',
    path: '/guides',
  },
  '/comparisons/msw': {
    title: 'Mockifyer vs MSW (Mock Service Worker)',
    description:
      'Compare Mockifyer and MSW for API mocking. MSW uses service workers, Mockifyer records real API calls. See which fits your workflow.',
    path: '/comparisons/msw',
  },
  '/comparisons/pollyjs': {
    title: 'Mockifyer vs Polly.js',
    description:
      'Compare Mockifyer and Polly.js for HTTP recording. Both support record-replay, but differ in setup, adapters, and React Native support.',
    path: '/comparisons/pollyjs',
  },
  '/comparisons/nock': {
    title: 'Mockifyer vs Nock',
    description:
      'Compare Mockifyer and Nock for HTTP mocking in Node.js. Nock intercepts http.request, Mockifyer records axios and fetch.',
    path: '/comparisons/nock',
  },
  '/comparisons/wiremock': {
    title: 'Mockifyer vs WireMock',
    description:
      'Compare Mockifyer and WireMock. WireMock runs as a separate server, Mockifyer replays from in-process JSON files.',
    path: '/comparisons/wiremock',
  },
  '/comparisons/mockoon': {
    title: 'Mockifyer vs Mockoon',
    description:
      'Compare Mockifyer and Mockoon. Mockoon is a local mock API server, Mockifyer records and replays real API calls in your tests.',
    path: '/comparisons/mockoon',
  },
  '/features': {
    title: 'Mockifyer Features: Record, Replay, Scenarios',
    description:
      'Selective recording, scenario switching, date freezing, React Native support, GraphQL matching, and a local dashboard for editing mocks.',
    path: '/features',
  },
  '/packages': {
    title: 'Mockifyer npm Packages for Axios and Fetch',
    description:
      '@sgedda/mockifyer-core, mockifyer-axios, mockifyer-fetch for recording and replay. Optional dashboard package for browsing mocks.',
    path: '/packages',
  },
  '/dashboard': {
    title: 'Mockifyer Dashboard and MCP Tools',
    description:
      'Local UI and CLI to browse scenarios, edit mocks, visualize traffic, and expose MCP tools to Cursor and Claude Desktop.',
    path: '/dashboard',
  },
  '/comparisons': {
    title: 'Mockifyer vs MSW, Polly.js, and Nock',
    description:
      'Compare Mockifyer with MSW, Polly.js, and Nock. Learn when record-replay fits better than in-code handlers for API testing.',
    path: '/comparisons',
  },
}

/**
 * Helper to format page title with site name suffix.
 * Only adds suffix if it's not already present as " | Mockifyer" or uses the em dash.
 */
export function formatPageTitle(title: string): string {
  // Homepage uses em dash, don't add suffix
  if (title.includes('—')) {
    return title
  }
  // Already has the suffix pattern, return as-is
  if (title.endsWith(` | ${SITE_NAME}`)) {
    return title
  }
  // Add suffix
  return `${title} | ${SITE_NAME}`
}
