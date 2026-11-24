/** Prefill sample for the mock-data-generator playground (Orders-shaped). */
export const DEFAULT_SAMPLE = {
  id: 1,
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  status: 'shipped',
  currency: 'USD',
  total: 19.99,
  items: [
    { orderId: 1, name: 'Notebook', qty: 2, price: 9.99 },
  ],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-02T00:00:00.000Z',
} as const

export const DEFAULT_SAMPLE_JSON = `${JSON.stringify(DEFAULT_SAMPLE, null, 2)}\n`

export const DEFAULT_CONTEXT = 'prices in USD, 3 items'
export const DEFAULT_COUNT = 3
/** Default nested list length when the Items control is set (Orders / products / …). */
export const DEFAULT_ITEM_COUNT = 3
export const DEFAULT_SEED = 42
export const MIN_RECORDS = 1
export const MAX_RECORDS = 50
export const MIN_ITEMS_PER_LIST = 1
export const MAX_ITEMS_PER_LIST = 50

/** One-click playground samples — JSON + context land in the editor (and thus the share hash). */
export type PlaygroundPresetId =
  | 'users'
  | 'orders'
  | 'weather'
  | 'products'
  | 'blog'
  | 'payments'
  | 'flights'
  | 'paginated'
  | 'error'
  | 'jsonplaceholder'

export interface PlaygroundPreset {
  id: PlaygroundPresetId
  label: string
  context: string
  sample: unknown
  /** Shown on the start-page teaser (keep to 3–4). */
  teaser?: boolean
  /** Static capture from a well-known public API (no live browser fetch). */
  realApi?: {
    name: string
    /** Documented origin URL — for display only; never fetched from the playground. */
    sourceUrl: string
    capturedNote: string
  }
}

export const PLAYGROUND_PRESETS: readonly PlaygroundPreset[] = [
  {
    id: 'users',
    label: 'Users',
    context: 'swedish users, EU phone numbers',
    teaser: true,
    sample: {
      users: [
        {
          id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: 'Lovelace',
          phone: '+46 70 123 45 67',
          city: 'Stockholm',
          country: 'SE',
          active: true,
        },
      ],
    },
  },
  {
    id: 'orders',
    label: 'Orders',
    context: DEFAULT_CONTEXT,
    teaser: true,
    sample: DEFAULT_SAMPLE,
  },
  {
    id: 'products',
    label: 'Products',
    context: 'catalog of products, prices in EUR',
    teaser: true,
    sample: {
      products: [
        {
          id: 'sku-1001',
          sku: 'NB-A5',
          name: 'A5 Notebook',
          category: 'stationery',
          price: 12.5,
          currency: 'EUR',
          inStock: true,
        },
      ],
    },
  },
  {
    id: 'jsonplaceholder',
    label: 'JSONPlaceholder',
    context: 'english users',
    // Full tool page only — start teaser keeps 3 chips (Users / Orders / Products).
    teaser: false,
    realApi: {
      name: 'JSONPlaceholder',
      sourceUrl: 'https://jsonplaceholder.typicode.com/users/1',
      capturedNote: 'Static capture of GET /users/1 — not fetched live in the browser.',
    },
    sample: {
      id: 1,
      name: 'Leanne Graham',
      username: 'Bret',
      email: 'Sincere@april.biz',
      address: {
        street: 'Kulas Light',
        suite: 'Apt. 556',
        city: 'Gwenborough',
        zipcode: '92998-3874',
        geo: { lat: '-37.3159', lng: '81.1496' },
      },
      phone: '1-770-736-8031 x56442',
      website: 'hildegard.org',
      company: {
        name: 'Romaguera-Crona',
        catchPhrase: 'Multi-layered client-server neural-net',
        bs: 'harness real-time e-markets',
      },
    },
  },
  {
    id: 'weather',
    label: 'Weather',
    context: 'metric units, European cities',
    sample: {
      location: { name: 'Stockholm', country: 'SE' },
      current: {
        temp_c: 12.4,
        condition: 'Partly cloudy',
        humidity: 64,
        wind_kph: 18.5,
        observed_at: '2024-06-15T14:30:00.000Z',
      },
    },
  },
  {
    id: 'blog',
    label: 'Blog',
    context: 'blog posts with comments',
    sample: {
      posts: [
        {
          id: 101,
          title: 'Shipping mocks offline',
          author: 'Ada Lovelace',
          body: 'How we keep E2E green when the network is blocked.',
          publishedAt: '2024-06-01T10:00:00.000Z',
          comments: [
            {
              id: 1,
              author: 'Grace Hopper',
              body: 'Love the deterministic seeds.',
              createdAt: '2024-06-01T12:00:00.000Z',
            },
          ],
        },
      ],
    },
  },
  {
    id: 'payments',
    label: 'Payments',
    context: 'mix of paid/refunded/failed, prices in USD',
    sample: {
      transactions: [
        {
          id: 'txn_01HXYZ',
          amount: 49.99,
          currency: 'USD',
          status: 'paid',
          method: 'card',
          customerEmail: 'ada@example.com',
          createdAt: '2024-05-20T09:15:00.000Z',
        },
      ],
    },
  },
  {
    id: 'flights',
    label: 'Flights',
    context: 'European cities',
    sample: {
      bookings: [
        {
          confirmationCode: 'ABC123',
          passengerName: 'Ada Lovelace',
          from: 'ARN',
          to: 'LHR',
          departureAt: '2024-07-12T06:40:00.000Z',
          arrivalAt: '2024-07-12T08:55:00.000Z',
          seat: '12A',
          status: 'confirmed',
        },
      ],
    },
  },
  {
    id: 'paginated',
    label: 'Paginated',
    context: '10 users',
    sample: {
      items: [
        { id: 1, name: 'Ada Lovelace', email: 'ada@example.com' },
        { id: 2, name: 'Grace Hopper', email: 'grace@example.com' },
      ],
      page: 1,
      pageSize: 20,
      total: 48,
      next: '/api/users?page=2',
    },
  },
  {
    id: 'error',
    label: 'Error',
    context: 'mix of failed/pending',
    sample: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Retry after the indicated delay.',
        status: 429,
        retryAfterSec: 30,
        requestId: 'req_7c9e6679',
      },
    },
  },
] as const

/** Presets shown on the start-page teaser (3–4). */
export const TEASER_PRESETS: readonly PlaygroundPreset[] = PLAYGROUND_PRESETS.filter(
  (preset) => preset.teaser
)

export function presetSampleJson(preset: PlaygroundPreset): string {
  return `${JSON.stringify(preset.sample, null, 2)}\n`
}

export function findPreset(id: string): PlaygroundPreset | undefined {
  return PLAYGROUND_PRESETS.find((preset) => preset.id === id)
}

export const CHAOS_LEVELS = ['realistic', 'mild', 'wild', 'nightmare'] as const
export type PlaygroundChaosLevel = (typeof CHAOS_LEVELS)[number]

export const CHAOS_LEVEL_INDEX: Record<PlaygroundChaosLevel, number> = {
  realistic: 0,
  mild: 1,
  wild: 2,
  nightmare: 3,
}

export const MAX_SHARE_HASH_LENGTH = 7000

/** Demo CLI shown in the playground CTA (same as Getting Started). */
export const TRY_DEMO_COMMAND = 'npx -p @sgedda/mockifyer-core mockifyer try'
