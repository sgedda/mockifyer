/**
 * SEO copy + FAQ for /tools/mock-data-generator (below the interactive tool).
 * Keep claims limited to what the playground actually does.
 */

export interface GeneratorFaqItem {
  question: string
  answer: string
}

export const GENERATOR_SEO_TITLE =
  'Free Mock Data Generator – Fake JSON & Types | Mockifyer'

export const GENERATOR_SEO_DESCRIPTION =
  'Free mock data generator: fake JSON (users, orders, more) plus types in TypeScript, Zod, JSON Schema, C#, Kotlin, Swift, Python, or Go. Browser-only.'

export const GENERATOR_FAQ: readonly GeneratorFaqItem[] = [
  {
    question: 'Is the mock data generator free?',
    answer:
      'Yes. The Mockifyer mock data generator on this page is free to use. No account is required.',
  },
  {
    question: 'Does anything leave my browser?',
    answer:
      'No. Sample JSON and generated records stay in your browser. Generation uses the same offline @sgedda/mockifyer-generator engine as the local CLI after the page loads — your data is not uploaded to Mockifyer.',
  },
  {
    question: 'Can I generate fake user data and other API shapes?',
    answer:
      'Yes. Choose Pick a type (Users, Orders, Products, Posts, Payments, or Bookings), set how many objects you want, and Randomize for a new seed. Or switch to Use my own JSON to paste a sample and generate more records with the same shape.',
  },
  {
    question: 'Can I get TypeScript or other types from the generated JSON?',
    answer:
      'Yes. Use the Types tab (beside JSON on desktop; Types view on mobile). Nested objects, arrays, and optional fields are inferred. Choose TypeScript (default), Zod, JSON Schema, C#, Kotlin, Swift, Python TypedDict, or Go structs, then copy the shown language.',
  },
  {
    question: 'Can I use the output in Jest or React Native?',
    answer:
      'Yes. Copy the JSON into fixtures or tests, or download Mockifyer mock scenario files from More. For on-device and CI replay of real HTTP shapes, record once with Mockifyer (axios or fetch) and keep mocks as JSON in your repo.',
  },
  {
    question: 'Does locale or context matter?',
    answer:
      'Yes. The Locale control steers names, phones, and currency. Customize also has Items per list and a lockable Seed so you can keep output stable across regenerations.',
  },
] as const

export function buildGeneratorWebApplicationJsonLd(opts: {
  siteUrl: string
  title: string
  description: string
  path: string
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Mockifyer Mock Data Generator',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript',
    url: `${opts.siteUrl}${opts.path}`,
    description: opts.description,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: [
      'Fake JSON data generator',
      'Random JSON generator with seed',
      'Mock API response shapes (users, orders, products, and more)',
      'Generated types in TypeScript, Zod, JSON Schema, C#, Kotlin, Swift, Python, or Go',
      'Runs offline in the browser',
    ],
    isPartOf: {
      '@type': 'SoftwareApplication',
      name: 'Mockifyer',
      url: opts.siteUrl,
    },
  }
}

export function buildGeneratorFaqPageJsonLd(
  items: readonly GeneratorFaqItem[]
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

/** Combined @graph for prerender / client when a single script tag is preferred. */
export function buildGeneratorJsonLdGraph(opts: {
  siteUrl: string
  title: string
  description: string
  path: string
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      buildGeneratorWebApplicationJsonLd(opts),
      buildGeneratorFaqPageJsonLd(GENERATOR_FAQ),
    ],
  }
}
