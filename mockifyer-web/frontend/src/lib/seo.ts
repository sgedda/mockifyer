// Import shared SEO configuration (single source of truth)
import {
  SITE_URL,
  SITE_NAME,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  PAGE_SEO,
  type PageSeoConfig,
} from './seo-config'

// Re-export for use by other modules
export { SITE_URL, SITE_NAME, DEFAULT_TITLE, DEFAULT_DESCRIPTION, PAGE_SEO, type PageSeoConfig }

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

export const NOT_FOUND_SEO: PageSeoConfig = {
  title: 'Page Not Found - Mockifyer',
  description: 'The page you are looking for does not exist.',
  path: '/404', // Prevent canonical from falling back to homepage
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
