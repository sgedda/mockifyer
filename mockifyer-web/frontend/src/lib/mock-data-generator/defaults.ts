/** Prefill sample for the mock-data-generator playground. */
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
export const DEFAULT_SEED = 42

export const CHAOS_LEVELS = ['realistic', 'mild', 'wild', 'nightmare'] as const
export type PlaygroundChaosLevel = (typeof CHAOS_LEVELS)[number]

export const CHAOS_LEVEL_INDEX: Record<PlaygroundChaosLevel, number> = {
  realistic: 0,
  mild: 1,
  wild: 2,
  nightmare: 3,
}

export const MAX_SHARE_HASH_LENGTH = 7000
