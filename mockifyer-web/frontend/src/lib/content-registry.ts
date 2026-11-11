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
  // Upcoming guides (Content Writer is drafting these)
  {
    path: '/guides/react-native-expo',
    title: 'React Native & Expo Setup',
    summary: 'Set up Mockifyer in React Native and Expo apps with Metro sync and device storage.',
    seoDescription:
      'Set up Mockifyer in React Native and Expo apps with Metro sync, device storage, and fetch patching. Complete setup guide for mobile development.',
    type: 'guide',
    priority: 0.7,
    changefreq: 'monthly',
    exists: false,
  },
  {
    path: '/guides/selective-recording',
    title: 'Selective Recording',
    summary: 'Record specific endpoints into _scratch, review them, and activate as committed mocks.',
    seoDescription:
      'Selective recording workflow: request-only into _scratch by default, live until activated. Control what gets recorded with domain-path rules.',
    type: 'guide',
    priority: 0.7,
    changefreq: 'monthly',
    exists: false,
  },
  {
    path: '/guides/record-replay',
    title: 'Record & Replay Workflow',
    summary: 'Record API responses from staging, commit as JSON, and replay offline in dev and CI.',
    seoDescription:
      'Complete record and replay workflow: capture real API responses, store as JSON in your repo, switch scenarios at runtime, and replay offline.',
    type: 'guide',
    priority: 0.7,
    changefreq: 'monthly',
    exists: false,
  },
  {
    path: '/guides/maestro-detox-mocks',
    title: 'Maestro & Detox with Mocks',
    summary: 'Deterministic mobile E2E tests with launch arguments and frozen dates.',
    seoDescription:
      'Write deterministic Maestro and Detox tests with launch arguments: lock mock scenarios, freeze dates, and eliminate backend flakes.',
    type: 'guide',
    priority: 0.7,
    changefreq: 'monthly',
    exists: false,
  },
  {
    path: '/guides/scenarios',
    title: 'Scenarios: Switchable Mock Worlds',
    summary: 'Define complete test states as scenarios and switch between them at runtime.',
    seoDescription:
      'Scenarios are switchable mock worlds: trips-empty, trips-one, trips-many. Define complete application states and flip between them at runtime.',
    type: 'guide',
    priority: 0.7,
    changefreq: 'monthly',
    exists: false,
  },
]

/**
 * All comparison pages — each entry becomes a route, SEO entry, sitemap entry, and prerender target.
 * Set exists: false for upcoming comparisons.
 */
export const COMPARISONS: ContentItem[] = [
  // Upcoming comparison pages (Content Writer is drafting these)
  {
    path: '/comparisons/msw',
    title: 'Mockifyer vs MSW',
    summary: 'Compare Mockifyer record-replay with MSW in-code handlers for React and Node.js.',
    seoDescription:
      'Mockifyer vs MSW: Record-replay JSON mocks vs in-code Service Worker handlers. When to choose each for React, React Native, and Node.js testing.',
    type: 'comparison',
    priority: 0.7,
    changefreq: 'monthly',
    exists: false,
  },
  {
    path: '/comparisons/pollyjs',
    title: 'Mockifyer vs Polly.js',
    summary: 'Mockifyer selective recording vs Polly.js framework-agnostic HTTP recording.',
    seoDescription:
      'Compare Mockifyer and Polly.js for HTTP recording and replay. Scenario switching vs time control, React Native support, and dashboard features.',
    type: 'comparison',
    priority: 0.7,
    changefreq: 'monthly',
    exists: false,
  },
  {
    path: '/comparisons/nock',
    title: 'Mockifyer vs Nock',
    summary: 'Committed JSON recordings vs ephemeral test-only Nock interceptors.',
    seoDescription:
      'Mockifyer vs Nock: Committed JSON mocks in your repo vs ephemeral in-test interceptors. When to choose each for Node.js API testing.',
    type: 'comparison',
    priority: 0.7,
    changefreq: 'monthly',
    exists: false,
  },
  {
    path: '/comparisons/wiremock',
    title: 'Mockifyer vs WireMock',
    summary: 'Embedded recording with scenarios vs standalone mock server with stateful scenarios.',
    seoDescription:
      'Compare Mockifyer embedded recording with WireMock standalone server. Record-replay workflows, scenario switching, and JVM integration.',
    type: 'comparison',
    priority: 0.7,
    changefreq: 'monthly',
    exists: false,
  },
  {
    path: '/comparisons/mockoon',
    title: 'Mockifyer vs Mockoon',
    summary: 'Developer-embedded recording vs GUI-driven API design and CRUD mocking.',
    seoDescription:
      'Mockifyer vs Mockoon: Record real API calls in your app vs design mocks with a desktop GUI. Different workflows for different needs.',
    type: 'comparison',
    priority: 0.7,
    changefreq: 'monthly',
    exists: false,
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
