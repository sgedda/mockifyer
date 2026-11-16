/**
 * Content registry — single source of truth for guides and comparison pages.
 * Adding a new guide or comparison: add one entry here, and the route, SEO, sitemap,
 * prerender, and hub listings are automatically generated.
 */

export interface ContentItem {
  path: string
  title: string
  summary: string
  type: 'guide' | 'comparison'
  /** SEO-specific title (without ' | Mockifyer' suffix) - defaults to title if not provided */
  seoTitle?: string
  /** SEO description (max 155 chars) */
  seoDescription: string
  /** Priority for sitemap.xml (0.0 to 1.0) */
  priority?: number
  /** Changefreq for sitemap.xml */
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  /** Whether the page component exists (false = upcoming/draft) */
  exists: boolean
}

/**
 * All guides — each entry becomes a route, SEO entry, sitemap entry, and prerender target.
 * Set exists: false for upcoming guides that Content Writer is drafting.
 */
export const GUIDES: ContentItem[] = [
  {
    path: '/guides/mock-at-the-network-edge',
    title: 'Mock at the Network Edge',
    summary: 'Stop mocking hooks and components. Test what users see by mocking HTTP at the network edge.',
    seoTitle: 'Mock at the Network Edge - Testing Guide',
    seoDescription:
      'Stop mocking hooks and components. Mock HTTP at the network edge to test what users see. Real response shapes, survive refactors, catch breaking API changes.',
    type: 'guide',
    priority: 0.7,
    changefreq: 'monthly',
    exists: true,
  },
  {
    path: '/guides/reproduce-tester-bugs',
    title: 'Reproduce Tester Bugs Locally',
    summary: 'Capture API calls from tester devices and replay bugs locally with full tracing.',
    seoTitle: 'Reproduce Tester Bugs Locally - Testing Guide',
    seoDescription:
      'Capture API calls from tester devices, trace requests across services via x-mockifyer-request-id, export as curl, and replay bugs locally.',
    type: 'guide',
    priority: 0.7,
    changefreq: 'monthly',
    exists: true,
  },
  {
    path: '/guides/stable-react-native-e2e',
    title: 'Stable React Native E2E Tests',
    summary: 'Lock scenarios with launch arguments, freeze dates, and make Detox, Appium, and Maestro tests deterministic.',
    seoTitle: 'Stable React Native E2E Tests - Detox, Appium, Maestro',
    seoDescription:
      'Stop Detox, Appium, and Maestro flakes. Lock scenarios with launch arguments, freeze dates, and make the backend deterministic.',
    type: 'guide',
    priority: 0.7,
    changefreq: 'monthly',
    exists: true,
  },
  {
    path: '/guides/mock-drift',
    title: 'Stop Mock Drift',
    summary: 'Record real responses, re-record when APIs change, and git diff to catch breaking changes.',
    seoTitle: 'Stop Hand-Written API Mocks from Drifting',
    seoDescription:
      'Hand-written mocks drift from real APIs. Record real responses, re-record when APIs change, and git diff to catch breaking changes.',
    type: 'guide',
    priority: 0.7,
    changefreq: 'monthly',
    exists: true,
  },
  {
    path: '/guides/react-native-without-msw',
    title: 'React Native: Handlers vs Recording',
    summary: 'Compare MSW and Mockifyer for React Native. Recording works on device with no service worker.',
    seoTitle: 'MSW vs Recording in React Native',
    seoDescription:
      'Compare MSW and Mockifyer for React Native. Recording works on device with no service worker, supports Expo and bare React Native.',
    type: 'guide',
    priority: 0.7,
    changefreq: 'monthly',
    exists: true,
  },
  {
    path: '/guides/react-native-expo',
    title: 'React Native and Expo with Mockifyer',
    summary: 'Set up Mockifyer in React Native and Expo apps with Metro sync and device storage.',
    seoTitle: 'React Native and Expo with Mockifyer',
    seoDescription:
      'Record real fetch calls in Expo and React Native with Mockifyer, then replay them in dev and E2E without hand-written handlers.',
    type: 'guide',
    priority: 0.7,
    changefreq: 'monthly',
    exists: true,
  },
  {
    path: '/guides/selective-recording',
    title: 'Selective HTTP Recording, Not Capture-All',
    summary: 'Requests land as stubs in _scratch and stay live until you activate them.',
    seoTitle: 'Selective HTTP Recording, Not Capture-All',
    seoDescription:
      'Requests land as request-only stubs in _scratch and stay live until you turn on a domain-path rule and activate the mock. Use capture-all only as a short, heavy try-it option.',
    type: 'guide',
    priority: 0.7,
    changefreq: 'monthly',
    exists: true,
  },
  {
    path: '/guides/record-replay',
    title: 'Record and Replay with Mockifyer',
    summary: 'Record real axios or fetch calls in Node, keep JSON mocks in your repo, and replay in tests.',
    seoTitle: 'Record and Replay with Mockifyer',
    seoDescription:
      'Record real axios or fetch calls in Node, keep the JSON mocks in your repo, and replay them in tests and CI with Mockifyer.',
    type: 'guide',
    priority: 0.7,
    changefreq: 'monthly',
    exists: true,
  },
  {
    path: '/guides/maestro-detox-mocks',
    title: 'Mock APIs in Maestro and Detox E2E',
    summary: 'Lock a React Native E2E run to a recorded scenario with launch arguments.',
    seoTitle: 'Mock APIs in Maestro and Detox E2E',
    seoDescription:
      'Lock a React Native E2E run to a recorded Mockifyer scenario with a launch argument from Maestro or Detox. Mocks are served inside the app or by the Mockifyer dashboard, with no WireMock server.',
    type: 'guide',
    priority: 0.7,
    changefreq: 'monthly',
    exists: true,
  },
  {
    path: '/guides/scenarios',
    title: 'Switch Mock Scenarios for Test Data',
    summary: 'Keep empty, many and error states as scenario folders and switch between them.',
    seoTitle: 'Switch Mock Scenarios for Test Data',
    seoDescription:
      'Keep empty, many and error states as Mockifyer scenario folders, and switch between them from the dashboard, env vars, config or React Native launch arguments.',
    type: 'guide',
    priority: 0.7,
    changefreq: 'monthly',
    exists: true,
  },
]

/**
 * All comparison pages — each entry becomes a route, SEO entry, sitemap entry, and prerender target.
 * Set exists: false for upcoming comparisons.
 */
export const COMPARISONS: ContentItem[] = [
  {
    path: '/comparisons/msw',
    title: 'Mockifyer vs MSW (Mock Service Worker)',
    summary: 'Hand-written handlers vs recorded JSON. MSW for GraphQL and browser tests, Mockifyer for scenarios and React Native.',
    seoTitle: 'Mockifyer vs MSW (Mock Service Worker)',
    seoDescription:
      'An honest comparison from Mockifyer\'s author. MSW is the pick for hand-written handlers in browser and Node tests and for GraphQL. Mockifyer records real JSON and replays it selectively, with scenarios and React Native support.',
    type: 'comparison',
    priority: 0.7,
    changefreq: 'monthly',
    exists: true,
  },
  {
    path: '/comparisons/pollyjs',
    title: 'Mockifyer vs Polly.js',
    summary: 'Polly.js pioneered record/replay for JavaScript. Mockifyer adds dashboard, scenarios, and selective recording.',
    seoTitle: 'Mockifyer vs Polly.js',
    seoDescription:
      'A comparison from Mockifyer\'s author. Polly.js pioneered record/replay with HAR recordings for JavaScript tests. Mockifyer adds a dashboard, scenarios, selective request-only recording and React Native support.',
    type: 'comparison',
    priority: 0.7,
    changefreq: 'monthly',
    exists: true,
  },
  {
    path: '/comparisons/nock',
    title: 'Mockifyer vs Nock',
    summary: 'Nock for assertion-heavy Node unit tests. Mockifyer for recorded JSON scenarios in dev, E2E and React Native.',
    seoTitle: 'Mockifyer vs Nock',
    seoDescription:
      'A comparison from Mockifyer\'s author. Nock is the go-to for assertion-heavy Node.js unit tests. Mockifyer records real responses into JSON scenarios for dev, E2E and React Native.',
    type: 'comparison',
    priority: 0.7,
    changefreq: 'monthly',
    exists: true,
  },
  {
    path: '/comparisons/wiremock',
    title: 'Mockifyer vs WireMock',
    summary: 'WireMock is a standalone, language-agnostic server. Mockifyer runs in-process and records real traffic.',
    seoTitle: 'Mockifyer vs WireMock',
    seoDescription:
      'A comparison from Mockifyer\'s author. WireMock is a standalone, language-agnostic mock server. Mockifyer runs in-process in JavaScript and React Native and records real traffic into JSON scenarios.',
    type: 'comparison',
    priority: 0.7,
    changefreq: 'monthly',
    exists: true,
  },
  {
    path: '/comparisons/mockoon',
    title: 'Mockifyer vs Mockoon',
    summary: 'Mockoon is a desktop app for designing mock APIs. Mockifyer records a JS app\'s real traffic. They complement each other.',
    seoTitle: 'Mockifyer vs Mockoon',
    seoDescription:
      'A comparison from Mockifyer\'s author. Mockoon is a desktop app and CLI for designing local mock APIs. Mockifyer records a JS or React Native app\'s real traffic in-process. They complement each other.',
    type: 'comparison',
    priority: 0.7,
    changefreq: 'monthly',
    exists: true,
  },
]

/**
 * Helper to get only items that exist (have components)
 */
export function getExistingContent(items: ContentItem[]): ContentItem[] {
  return items.filter((item) => item.exists)
}

/**
 * Helper to get items by type
 */
export function getContentByType(type: 'guide' | 'comparison'): ContentItem[] {
  return type === 'guide' ? GUIDES : COMPARISONS
}

/**
 * Get all content items (guides + comparisons) that exist
 */
export function getAllExistingContent(): ContentItem[] {
  return [...getExistingContent(GUIDES), ...getExistingContent(COMPARISONS)]
}
