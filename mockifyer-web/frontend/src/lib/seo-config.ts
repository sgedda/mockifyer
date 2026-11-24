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
  'Open-source API mocking for JavaScript and React Native. Record and replay HTTP, edit mocks in a dashboard, catch API drift in CI. Mocks stay in your repo.'

/**
 * SEO configuration for all routes.
 * To add a new route: add one entry here with title (without ' | Mockifyer' suffix),
 * description (<=155 chars), and path. The title suffix is added automatically by formatPageTitle
 * unless the title already includes "Mockifyer".
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
      'Install Mockifyer, configure selective recording into _scratch, activate a mock in the dashboard, and replay your first HTTP response in about five steps.',
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
  '/guides': {
    title: 'Mockifyer Guides',
    description:
      'Practical guides for record-replay API mocking: network-edge testing, React Native E2E, mock drift, SSE/streaming, Atlas maps, and browser record-replay.',
    path: '/guides',
  },
  '/guides/mock-at-the-network-edge': {
    title: 'Mock at the Network Edge - Testing Guide',
    description:
      'Stop mocking hooks and components. Mock HTTP at the network edge to test what users see. Real shapes, survive refactors, catch API breaks.',
    path: '/guides/mock-at-the-network-edge',
  },
  '/guides/reproduce-tester-bugs': {
    title: 'Reproduce Tester Bugs Locally - Testing Guide',
    description:
      'Capture API calls from tester devices, trace requests across services via x-mockifyer-request-id, export as curl, and replay bugs locally.',
    path: '/guides/reproduce-tester-bugs',
  },
  '/guides/stable-react-native-e2e': {
    title: 'Stable React Native E2E: Detox & Maestro',
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
  '/guides/mockifyer-atlas': {
    title: 'Visualize Architecture with Mockifyer Atlas',
    description:
      'Generate interactive traffic maps from recorded HTTP hops. See hosts, request chains, search payloads, and trace multi-service flows.',
    path: '/guides/mockifyer-atlas',
  },
  '/guides/atlas-from-playwright': {
    title: 'Generate Atlas from Playwright E2E',
    description:
      'Record traffic during Playwright tests with Mockifyer, build Atlas HTML in global teardown, and upload it as a CI artifact.',
    path: '/guides/atlas-from-playwright',
  },
  '/guides/streaming': {
    title: 'Mocking SSE and Streaming APIs with Mockifyer',
    description:
      'Record and replay SSE and chunked HTTP streams: tee on record, paced ReadableStream replay, drift caps, and dashboard chunk timelines.',
    path: '/guides/streaming',
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
  '/tools/mock-data-generator': {
    title: 'Mock Data Generator — JSON to Realistic Mocks',
    description:
      'Paste one JSON sample and generate realistic records plus edge-case variants in your browser. Seeded, offline, shareable — then record the real API.',
    path: '/tools/mock-data-generator',
  },
  /**
   * Static Atlas HTML (not an SPA route). Prerender skips /atlas/* and Express
   * serves frontend/public/atlas/wanderweird/index.html. Listed for SEO/sitemap.
   */
  '/atlas/wanderweird': {
    title: 'WanderWeird Atlas — Live Architecture Map',
    description:
      'Interactive Mockifyer Atlas generated from real WanderWeird E2E traffic: endpoints, request chains, and mocked vs live flows.',
    path: '/atlas/wanderweird',
  },
}

/**
 * Trailing-slash URL for the static Atlas directory (relative asset fetches).
 * Prefer this when linking from the marketing site.
 */
export const WANDERWEIRD_ATLAS_HREF = '/atlas/wanderweird/'

/** How-to: generate Atlas HTML from a Playwright E2E run (CI artifact). */
export const ATLAS_FROM_PLAYWRIGHT_HREF = '/guides/atlas-from-playwright'

/** Provenance for the hosted WanderWeird showcase Atlas (from e2e teardown artifact). */
export const WANDERWEIRD_ATLAS_SHOWCASE = {
  totalRequests: 1205,
  observedEndpoints: 21,
  runDate: '2026-11-23',
  scenario: 'WanderWeird E2E Run',
} as const

/**
 * Helper to format page title with site name suffix.
 * Skips the suffix when the title already names Mockifyer (or uses the homepage em dash).
 */
export function formatPageTitle(title: string): string {
  if (title.includes('—') || title.includes(SITE_NAME)) {
    return title
  }
  if (title.endsWith(` | ${SITE_NAME}`)) {
    return title
  }
  return `${title} | ${SITE_NAME}`
}
