export const SITE_URL = 'https://mockifyer.dev'
export const SITE_NAME = 'Mockifyer'

export const DEFAULT_TITLE =
  'Mockifyer — Record & Replay HTTP API Mocks'

export const DEFAULT_DESCRIPTION =
  'Record axios and fetch calls as JSON and replay them in Node and React Native. Selective recording by default; mocks stay in your repo.'

export const DEFAULT_KEYWORDS = [
  'API mocking',
  'HTTP mock',
  'record and replay',
  'axios mock',
  'fetch mock',
  'Node.js testing',
  'deterministic testing',
  'GraphQL mock',
  'integration testing',
  'mock server',
].join(', ')

export const HERO_TAGLINE =
  'Deterministic test state that doesn\'t drift. Record API responses, switch between scenario worlds, and eliminate flaky tests caused by stale data and moving dates.'

export const TWITTER_HANDLE = '@sgedda'

export const OG_IMAGE_URL = `${SITE_URL}/og-image.png`

/** Google Search Console — HTML tag verification for mockifyer.dev */
export const GOOGLE_SITE_VERIFICATION_META = 'za4sE0woq42QVV2_O1lCpLPr7gk806c4CTNGvSpK0Mc'

export interface PageSeoConfig {
  title: string
  description: string
  path?: string
  noIndex?: boolean
}

/**
 * SEO configuration for all routes.
 * To add a new route: add one entry to this object with title (without ' | Mockifyer' suffix),
 * description (<=155 chars), and path. The title suffix is added automatically.
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

export const NOT_FOUND_SEO: PageSeoConfig = {
  title: 'Page Not Found - Mockifyer',
  description: 'The page you are looking for does not exist.',
  noIndex: true,
}

export function getPageSeo(pathname: string): PageSeoConfig | undefined {
  const normalized = pathname.replace(/\/index\.html$/, '').replace(/\/$/, '') || '/'
  return PAGE_SEO[normalized]
}

export function formatPageTitle(title: string): string {
  if (title === DEFAULT_TITLE || title.includes(SITE_NAME)) {
    return title
  }
  return `${title} | ${SITE_NAME}`
}

export function absoluteUrl(path = '/'): string {
  if (path === '/') {
    return SITE_URL
  }
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

export function buildSoftwareApplicationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    url: SITE_URL,
    image: OG_IMAGE_URL,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Node.js',
    description: DEFAULT_DESCRIPTION,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    author: {
      '@type': 'Person',
      name: 'Sebastian Gedda',
      url: 'https://github.com/sgedda',
    },
    codeRepository: 'https://github.com/sgedda/mockifyer',
    keywords: DEFAULT_KEYWORDS,
  }
}

/** FAQPage schema for homepage — helps search and AI answer engines. */
export function buildFaqPageJsonLd(
  items: Array<{ question: string; answer: string }>,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}
