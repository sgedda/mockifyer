export const SITE_URL = 'https://mockifyer.dev'
export const SITE_NAME = 'Mockifyer'

export const DEFAULT_TITLE =
  'Mockifyer — Record & Replay HTTP API Mocks for Node.js'

export const DEFAULT_DESCRIPTION =
  'Mockifyer records and replays axios and fetch HTTP calls as JSON mocks. Deterministic Node.js API testing with date control, GraphQL matching, and scenario switching.'

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
  '/contact': {
    title: 'Contact',
    description:
      'Get in touch about Mockifyer — questions, feedback, and support for API mocking and record-replay testing.',
    path: '/contact',
  },
  '/e2e-tutorial': {
    title: 'E2E Tutorial: Controlling a nested multi-service stack',
    description:
      'End-to-end walkthrough of the WanderWeird demo stack with Mockifyer. Drive the dashboard GUI, switch scenarios, inject failures, and trace nested HTTP calls across services.',
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
    title: 'Stop Mock Drift - Record Real API Responses',
    description:
      'Hand-written mocks drift from real APIs. Record real responses, re-record when APIs change, and git diff to catch breaking changes. MSW vs record-replay comparison.',
    path: '/guides/mock-drift',
  },
  '/guides/nuxt-ssr-fixtures': {
    title: 'Nuxt SSR Fixtures - Server-Side Fetch Mocking',
    description:
      'Record backend responses for flaky Nuxt 3/Nitro CI. Intercept server-side $fetch and ofetch in the Node.js layer where Playwright can\'t reach.',
    path: '/guides/nuxt-ssr-fixtures',
  },
}

export function getPageSeo(pathname: string): PageSeoConfig {
  const normalized = pathname.replace(/\/index\.html$/, '') || '/'
  return PAGE_SEO[normalized] ?? PAGE_SEO['/']
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
