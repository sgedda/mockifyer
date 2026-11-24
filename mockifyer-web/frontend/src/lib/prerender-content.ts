/**
 * Build-time prerender body content for SEO-critical content routes.
 * Injected into #root at prerender time. Client uses createRoot (not hydrateRoot),
 * so React replaces this HTML on boot — no hydration mismatch risk.
 */

import { HOME_FAQ } from './faq'
import { GUIDE_ITEMS } from './product-docs'
import { PAGE_SEO, SITE_NAME, SITE_URL, type PageSeoConfig } from './seo-config'

export interface PrerenderLink {
  href: string
  label: string
}

export interface PrerenderSection {
  heading: string
  paragraphs: string[]
}

export interface PrerenderBodyContent {
  h1: string
  summary: string
  sections: PrerenderSection[]
  links: PrerenderLink[]
}

/** Routes that get full article/hub body HTML (not just H1 + description). */
export const CONTENT_ROUTES_WITH_FULL_BODY = new Set([
  '/guides',
  '/guides/mock-at-the-network-edge',
  '/guides/reproduce-tester-bugs',
  '/guides/stable-react-native-e2e',
  '/guides/mock-drift',
  '/guides/react-native-without-msw',
  '/guides/browser-record-replay',
  '/guides/mockifyer-atlas',
  '/guides/atlas-from-playwright',
  '/guides/streaming',
  '/comparisons',
  '/faq',
  '/getting-started',
  '/e2e-tutorial',
  '/tools/mock-data-generator',
])

const NAV_LINKS: PrerenderLink[] = [
  { href: '/', label: 'Home' },
  { href: '/getting-started', label: 'Getting Started' },
  { href: '/features', label: 'Features' },
  { href: '/guides', label: 'Guides' },
  { href: '/faq', label: 'FAQ' },
  { href: '/comparisons', label: 'Comparisons' },
  { href: '/packages', label: 'Packages' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/e2e-tutorial', label: 'E2E Tutorial' },
  { href: '/contact', label: 'Contact' },
  { href: '/tools/mock-data-generator', label: 'Mock Data Generator' },
]

function relatedGuideLinks(currentPath: string): PrerenderLink[] {
  return GUIDE_ITEMS.filter((guide) => guide.href !== currentPath).map((guide) => ({
    href: guide.href,
    label: guide.label,
  }))
}

function seoOrThrow(path: string): PageSeoConfig {
  const seo = PAGE_SEO[path]
  if (!seo) {
    throw new Error(`Missing PAGE_SEO for ${path}`)
  }
  return seo
}

const GUIDE_BODIES: Record<string, Omit<PrerenderBodyContent, 'links'>> = {
  '/guides/mock-at-the-network-edge': {
    h1: 'Mock at the Network Edge',
    summary:
      'Your tests pass but bugs ship when you mock hooks and components instead of HTTP. Mock at the network boundary so tests exercise real response shapes, survive refactors, and catch breaking API changes.',
    sections: [
      {
        heading: 'The Principle',
        paragraphs: [
          'Mock what leaves your process (HTTP requests), not what stays inside it (hooks, components, parsers). Record real axios or fetch responses once, store them as JSON in your repo, and replay them in CI.',
          'This keeps UI tests focused on what users see while the backend contract stays honest. When APIs rename fields or change shapes, re-record and git-diff the mocks instead of rewriting hand-written stubs.',
        ],
      },
      {
        heading: 'How Mockifyer Helps',
        paragraphs: [
          'Install @sgedda/mockifyer-axios or @sgedda/mockifyer-fetch, call setupMockifyer before your HTTP client imports, then record with MOCKIFYER_RECORD=true. Switch scenarios for empty, one, or many states without changing test code.',
        ],
      },
    ],
  },
  '/guides/reproduce-tester-bugs': {
    h1: 'Reproduce Tester Bugs Locally',
    summary:
      'Capture API calls from tester devices, correlate multi-service hops with x-mockifyer-request-id, export as curl, and replay the exact failure on your machine.',
    sections: [
      {
        heading: 'Capture Once, Replay Anywhere',
        paragraphs: [
          'When a tester hits a flaky flow, Mockifyer can record the outbound HTTP chain from the device or service under test. Request IDs stitch nested hops together so you can see which upstream response poisoned the UI.',
          'Export the failing request as curl, drop the recorded JSON into a local scenario, and reproduce without waiting for staging to re-enter the same state.',
        ],
      },
    ],
  },
  '/guides/stable-react-native-e2e': {
    h1: 'Stable React Native E2E Tests',
    summary:
      'Stop Detox, Appium, and Maestro flakes by locking Mockifyer scenarios with launch arguments, freezing dates, and making the backend deterministic.',
    sections: [
      {
        heading: 'Lock the Mock World',
        paragraphs: [
          'Pass scenario and client-lane launch arguments so every E2E run boots into the same recorded HTTP world. Combine with date freezing so “opens today” stay stable across timezones and CI clocks.',
          'Mockifyer works on device without a service worker: use @sgedda/mockifyer-fetch with Expo or bare React Native, optional Metro sync, and dashboard proxy lanes for physical devices.',
        ],
      },
    ],
  },
  '/guides/mock-drift': {
    h1: 'Catch API Drift Before Production',
    summary:
      'Hand-written mocks drift from real APIs. Record real responses, re-record when APIs change, and use the drift-check CLI so breaking changes surface in CI instead of production.',
    sections: [
      {
        heading: 'Why Hand-Written Mocks Rot',
        paragraphs: [
          'A common failure: staging renames name to title while tests still assert on name. Hand-written stubs stay green; production breaks. Recorded JSON mocks make contract changes visible in git diff.',
          'The mockifyer-drift-check CLI in @sgedda/mockifyer-core compares recorded mocks against live staging APIs. Run it nightly in GitHub Actions to catch breaking changes before they ship.',
        ],
      },
    ],
  },
  '/guides/react-native-without-msw': {
    h1: 'MSW vs Recording in React Native',
    summary:
      'Compare MSW and Mockifyer for React Native. Recording works on device with no service worker and supports Expo and bare React Native.',
    sections: [
      {
        heading: 'Why Recording Fits Mobile',
        paragraphs: [
          'MSW relies on service workers in the browser and Node interception on the server. React Native has neither. Mockifyer patches fetch at the app layer so the same record-replay workflow works on simulators and devices.',
          'Use launch_client mode for Maestro or Detox, Hybrid storage for Expo, and the dashboard proxy when physical devices need a shared mock lane.',
        ],
      },
    ],
  },
  '/guides/browser-record-replay': {
    h1: 'Record and Replay HTTP in the Browser',
    summary:
      'Use Mockifyer to record and replay HTTP fetch calls in browser environments, Expo web builds, and Vite projects with the memory provider.',
    sections: [
      {
        heading: 'Browser-Friendly Setup',
        paragraphs: [
          'Point setupMockifyer at a memory or filesystem provider depending on your runtime. Record once against a real API, then replay offline in Storybook, Playwright, or local Vite apps.',
          'The interactive browser guide embeds a WebContainer demo so you can try record and replay without installing packages locally.',
        ],
      },
    ],
  },
  '/guides/mockifyer-atlas': {
    h1: 'Visualize Architecture with Mockifyer Atlas',
    summary:
      'Generate interactive traffic maps from recorded HTTP hops. See hosts, request chains, search payloads, and trace multi-service flows.',
    sections: [
      {
        heading: 'Atlas Traffic Maps',
        paragraphs: [
          'Atlas turns recorded hops into an interactive map of hosts and request chains. Search payloads, follow nested calls, and export HTML docs for architecture reviews.',
          'In Metro, press t to start live hop capture while you exercise the app. Combine with x-mockifyer-request-id to understand multi-service graphs end to end.',
        ],
      },
    ],
  },
  '/guides/atlas-from-playwright': {
    h1: 'Generate Atlas from Playwright E2E',
    summary:
      'Record traffic during Playwright tests with Mockifyer, build Atlas HTML in global teardown, and upload it as a CI artifact on every run.',
    sections: [
      {
        heading: 'Playwright teardown builds the map',
        paragraphs: [
          'Wire globalTeardown in playwright.config.ts. After the suite, fetch dashboard network events, scrub secrets, and call buildAtlasDocHtmlFiles to write e2e/atlas-report/.',
          'Upload e2e/atlas-report/ with actions/upload-artifact@v4 (name atlas-architecture) so every CI run keeps an interactive architecture artifact.',
        ],
      },
    ],
  },
  '/guides/streaming': {
    h1: 'Mocking SSE and Streaming APIs with Mockifyer',
    summary:
      'Record chunk timelines for SSE and chunked HTTP bodies with fetch, keep concatenated response.data for compatibility, and replay a paced ReadableStream with original, accelerated, or immediate modes.',
    sections: [
      {
        heading: 'Record with a Tee, Replay with Timing',
        paragraphs: [
          'When a live response is text/event-stream or chunked without Content-Length, Mockifyer tees the body: your caller still gets the live ReadableStream while a background branch timestamps chunks until EOF or byte/duration caps. Caps set truncated; the mock file is saved after the stream ends or a cap is hit.',
          'Configure streamReplay (accelerated default), streamRecordMaxBytes, and streamRecordMaxDurationMs on setupMockifyer. Drift uses capped reads and compares concatenated data. The dashboard shows a chunk timeline; MCP summaries avoid dumping full bodies. Recording is direct-mode only — proxy can replay stream mocks but does not record them yet.',
        ],
      },
    ],
  },
}

function buildGuidesHub(): PrerenderBodyContent {
  const seo = seoOrThrow('/guides')
  return {
    h1: 'Mockifyer Guides',
    summary: seo.description,
    sections: [
      {
        heading: 'Published Guides',
        paragraphs: [
          'Practical guides for record-replay API mocking: network-edge testing, React Native E2E stability, mock drift detection, SSE/streaming, Atlas architecture maps, and browser record-replay.',
          'Each guide links to install steps, configuration tips, and related docs so you can go from concept to a working setup quickly.',
        ],
      },
    ],
    links: [
      ...NAV_LINKS.filter((link) => link.href !== '/guides'),
      ...GUIDE_ITEMS.map((guide) => ({ href: guide.href, label: guide.label })),
    ],
  }
}

function buildFaqBody(): PrerenderBodyContent {
  const seo = seoOrThrow('/faq')
  return {
    h1: 'Frequently Asked Questions',
    summary: seo.description,
    sections: HOME_FAQ.map((item) => ({
      heading: item.question,
      paragraphs: [item.answer],
    })),
    links: NAV_LINKS.filter((link) => link.href !== '/faq'),
  }
}

function buildGettingStartedBody(): PrerenderBodyContent {
  const seo = seoOrThrow('/getting-started')
  return {
    h1: 'Getting Started',
    summary: seo.description,
    sections: [
      {
        heading: 'Quick Start',
        paragraphs: [
          'Optional: run npx -p @sgedda/mockifyer-core mockifyer try for a self-contained record/replay in about 10 seconds (one local call, then replay with 0 network calls).',
          'Install @sgedda/mockifyer-axios or @sgedda/mockifyer-fetch, then call setupMockifyer with selective defaults (recordNewMocksAsPassthrough: true, recordResponses: false). Or run npx -p @sgedda/mockifyer-core mockifyer init. Run your app with recording on. Requests land as request-only stubs in mock-data/_scratch/ and stay on the live API until you activate a mock in the dashboard (untick Always use live API) or via domain-path rules. Capture-all settings are an optional heavy shortcut for tiny demos.',
        ],
      },
      {
        heading: 'Install for Your Stack',
        paragraphs: [
          'Node services typically install @sgedda/mockifyer-core with @sgedda/mockifyer-axios. React Native and browser fetch apps use @sgedda/mockifyer-fetch. Optional @sgedda/mockifyer-dashboard adds a UI, Redis/SQLite lanes, and MCP tooling.',
          'Set MOCKIFYER_PATH, MOCKIFYER_RECORD, and scenario env vars, then call setupMockifyer before importing your HTTP client so interception is ready on the first request.',
        ],
      },
    ],
    links: [
      ...NAV_LINKS.filter((link) => link.href !== '/getting-started'),
      { href: '/config-reference', label: 'Configuration Reference' },
      ...GUIDE_ITEMS.slice(0, 4).map((guide) => ({ href: guide.href, label: guide.label })),
    ],
  }
}

function buildComparisonsBody(): PrerenderBodyContent {
  const seo = seoOrThrow('/comparisons')
  return {
    h1: 'Mockifyer vs MSW, Polly.js, and Nock',
    summary: seo.description,
    sections: [
      {
        heading: 'When Record-Replay Fits',
        paragraphs: [
          'MSW shines with in-code handlers and Service Workers. Polly.js offers framework-agnostic recording. Nock is excellent for Node unit tests with expectations in code. Mockifyer focuses on committed JSON recordings, scenario switching, React Native, and a local dashboard.',
          'Choose Mockifyer when you want searchable mocks in git, multi-service request tracing, date freezing, and the same recordings across Node, Expo, and CI without rewriting handlers for every shape change.',
        ],
      },
      {
        heading: 'Feature Highlights',
        paragraphs: [
          'Record from real APIs into repo JSON, switch scenario worlds at runtime, isolate client lanes, freeze dates, match GraphQL by normalized query plus variables, and inspect hops in the dashboard or Atlas maps.',
        ],
      },
    ],
    links: [
      ...NAV_LINKS.filter((link) => link.href !== '/comparisons'),
      { href: '/guides/react-native-without-msw', label: 'MSW vs Recording in React Native' },
      { href: '/guides/mock-drift', label: 'Stop Mock Drift' },
    ],
  }
}

function buildE2ETutorialBody(): PrerenderBodyContent {
  const seo = seoOrThrow('/e2e-tutorial')
  return {
    h1: 'Controlling a Nested Multi-Service Stack with Mockifyer',
    summary: seo.description,
    sections: [
      {
        heading: 'WanderWeird Walkthrough',
        paragraphs: [
          'This tutorial runs Playwright against the WanderWeird demo: an Expo app plus multiple Node services with scenarios, dashboard control, and nested request tracing.',
          'Each GUI test drives the real Mockifyer dashboard and shows the change land in a running app. Use it to learn scenario switching, lane isolation, and end-to-end hop inspection.',
        ],
      },
      {
        heading: 'What You Will Learn',
        paragraphs: [
          'How to lock a multi-service graph into a known mock world, inspect nested outbound calls, and keep E2E runs deterministic when upstream APIs would otherwise flake.',
        ],
      },
    ],
    links: [
      ...NAV_LINKS.filter((link) => link.href !== '/e2e-tutorial'),
      { href: '/guides/reproduce-tester-bugs', label: 'Reproduce Tester Bugs' },
      { href: '/guides/stable-react-native-e2e', label: 'Stable React Native E2E' },
      { href: '/guides/mockifyer-atlas', label: 'Mockifyer Atlas' },
    ],
  }
}

function buildMockDataGeneratorBody(): PrerenderBodyContent {
  const seo = seoOrThrow('/tools/mock-data-generator')
  return {
    h1: 'Mock Data Generator',
    summary: seo.description,
    sections: [
      {
        heading: 'Generate from one sample',
        paragraphs: [
          'Paste or upload a JSON response, add optional context (for example swedish users or prices in SEK), set a count and seed, then generate realistic records with the same shape.',
          'Inferred field kinds are editable. Edge-case variants follow a chaos slider from realistic to nightmare. Identifier fields stay stable until nightmare, matching the CLI.',
        ],
      },
      {
        heading: 'Nothing leaves your browser',
        paragraphs: [
          'The playground uses the same @sgedda/mockifyer-generator engine as the local CLI. Generation runs offline after the page loads — no account and no server round-trip for your sample JSON.',
          'Download plain JSON or Mockifyer mock scenario files, copy a shareable URL with compressed state in the hash, and repeat locally with npx -p @sgedda/mockifyer-generator mockifyer-generate.',
        ],
      },
      {
        heading: 'Then record the real API',
        paragraphs: [
          'No API yet? Generate from one sample, then follow Getting Started to record the real one when the backend exists. Generated scenarios drop into mock-data/ beside recorded mocks.',
        ],
      },
    ],
    links: [
      { href: '/getting-started', label: 'Getting Started' },
      ...NAV_LINKS.filter(
        (link) =>
          link.href !== '/tools/mock-data-generator' && link.href !== '/getting-started'
      ),
    ],
  }
}

/**
 * Return full prerender body content for a route, or null for lighter pages.
 */
export function getPrerenderBodyContent(routePath: string): PrerenderBodyContent | null {
  if (!CONTENT_ROUTES_WITH_FULL_BODY.has(routePath)) {
    return null
  }

  if (routePath === '/guides') {
    return buildGuidesHub()
  }
  if (routePath === '/faq') {
    return buildFaqBody()
  }
  if (routePath === '/getting-started') {
    return buildGettingStartedBody()
  }
  if (routePath === '/comparisons') {
    return buildComparisonsBody()
  }
  if (routePath === '/e2e-tutorial') {
    return buildE2ETutorialBody()
  }
  if (routePath === '/tools/mock-data-generator') {
    return buildMockDataGeneratorBody()
  }

  const guide = GUIDE_BODIES[routePath]
  if (!guide) {
    return null
  }

  return {
    ...guide,
    links: [
      { href: '/guides', label: 'All Guides' },
      ...NAV_LINKS.filter((link) => !link.href.startsWith('/guides')),
      ...relatedGuideLinks(routePath),
    ],
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;')
}

/**
 * Render semantic article/hub HTML for #root (crawler-visible before JS boots).
 */
export function renderPrerenderBodyHtml(content: PrerenderBodyContent): string {
  const sectionsHtml = content.sections
    .map((section) => {
      const paragraphs = section.paragraphs
        .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
        .join('')
      return `<section><h2>${escapeHtml(section.heading)}</h2>${paragraphs}</section>`
    })
    .join('')

  const linksHtml = content.links
    .map((link) => `<li><a href="${escapeAttr(link.href)}">${escapeHtml(link.label)}</a></li>`)
    .join('')

  return [
    '<article style="max-width:1200px;margin:0 auto;padding:2rem">',
    `<h1>${escapeHtml(content.h1)}</h1>`,
    `<p>${escapeHtml(content.summary)}</p>`,
    sectionsHtml,
    '<nav aria-label="Related pages"><h2>Related pages</h2>',
    `<ul>${linksHtml}</ul>`,
    '</nav>',
    '<noscript><p>This site requires JavaScript for the full interactive experience. The content above is available without JavaScript.</p></noscript>',
    '</article>',
  ].join('')
}

export function buildFaqPageJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: HOME_FAQ.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

export function buildTechArticleJsonLd(seo: PageSeoConfig): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: seo.title,
    description: seo.description,
    url: `${SITE_URL}${seo.path}`,
    author: {
      '@type': 'Person',
      name: 'Sebastian Gedda',
      url: 'https://github.com/sgedda',
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
    mainEntityOfPage: `${SITE_URL}${seo.path}`,
  }
}

/**
 * Route-specific JSON-LD for raw HTML (homepage SoftwareApplication stays in the shell).
 */
export function getRouteJsonLd(routePath: string): Record<string, unknown> | null {
  if (routePath === '/faq') {
    return buildFaqPageJsonLd()
  }
  if (routePath.startsWith('/guides/') && PAGE_SEO[routePath]) {
    return buildTechArticleJsonLd(PAGE_SEO[routePath])
  }
  return null
}
