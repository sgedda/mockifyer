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
export const DEFAULT_SEED = 42

/** One-click playground samples — JSON + context land in the editor (and thus the share hash). */
export interface PlaygroundPreset {
  id: 'users' | 'orders' | 'weather'
  label: string
  context: string
  sample: unknown
}

export const PLAYGROUND_PRESETS: readonly PlaygroundPreset[] = [
  {
    id: 'users',
    label: 'Users',
    context: 'swedish users, EU phone numbers',
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
    sample: DEFAULT_SAMPLE,
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
] as const

export function presetSampleJson(preset: PlaygroundPreset): string {
  return `${JSON.stringify(preset.sample, null, 2)}\n`
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
