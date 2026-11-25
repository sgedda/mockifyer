/**
 * Cards normalize + HTML/React exporters (look + keyframes preserved in copy).
 */
import {
  exportCardsEmbedSnippet,
  exportCardsHtml,
  exportCardsReact,
  normalizeToCards,
  suggestedThemeForCards,
} from '../mockifyer-web/frontend/src/lib/mock-data-generator/cards'
import {
  decodeShareHash,
  encodeShareHash,
} from '../mockifyer-web/frontend/src/lib/mock-data-generator/share-state'

const USERS = {
  users: [
    {
      id: 'u1',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '+46 70 123 45 67',
      city: 'Stockholm',
      active: true,
    },
    {
      id: 'u2',
      email: 'alan@example.com',
      firstName: 'Alan',
      lastName: 'Turing',
      phone: '+44 7700 900123',
      city: 'London',
      active: false,
    },
  ],
}

const ORDER = {
  id: 42,
  email: 'buyer@example.com',
  status: 'shipped',
  currency: 'USD',
  total: 19.99,
  items: [{ name: 'Notebook', qty: 2, price: 9.99 }],
}

const PRODUCT = {
  id: 'sku-1',
  sku: 'NB-A5',
  name: 'A5 Notebook',
  category: 'stationery',
  price: 12.5,
  currency: 'EUR',
  inStock: true,
}

describe('normalizeToCards', () => {
  it('maps users wrapper to user cards', () => {
    const cards = normalizeToCards(USERS)
    expect(cards).toHaveLength(2)
    expect(cards[0]!.kind).toBe('user')
    expect(cards[0]!.title).toContain('Ada')
    expect(cards[0]!.rawJson).toContain('ada@example.com')
  })

  it('maps order objects to order cards with money highlight', () => {
    const cards = normalizeToCards(ORDER)
    expect(cards).toHaveLength(1)
    expect(cards[0]!.kind).toBe('order')
    expect(cards[0]!.highlight).toMatch(/\$|USD|19/)
    expect(cards[0]!.badge?.toLowerCase()).toContain('shipped')
  })

  it('maps products to product cards', () => {
    const cards = normalizeToCards({ products: [PRODUCT] })
    expect(cards[0]!.kind).toBe('product')
    expect(cards[0]!.title).toBe('A5 Notebook')
    expect(suggestedThemeForCards(cards)).toBe('glass')
  })

  it('suggests trading theme for users-only', () => {
    expect(suggestedThemeForCards(normalizeToCards(USERS))).toBe('trading')
  })

  it('suggests receipt theme for orders-only', () => {
    expect(suggestedThemeForCards(normalizeToCards(ORDER))).toBe('receipt')
  })
})

describe('exportCardsHtml', () => {
  it('emits self-contained HTML with shared CSS keyframes and theme class', () => {
    const cards = normalizeToCards(USERS)
    const html = exportCardsHtml({ cards, theme: 'trading', title: 'Test cards' })
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('mdg-theme-trading')
    expect(html).toContain('@keyframes mdg-card-enter')
    expect(html).toContain('prefers-reduced-motion')
    expect(html).toContain('Ada')
    expect(html).toContain('is-flipped')
    expect(html).toContain('mdg-card-back')
  })

  it('embed snippet points at share URL', () => {
    const snippet = exportCardsEmbedSnippet(
      'https://mockifyer.dev/tools/mock-data-generator#mdg1.test'
    )
    expect(snippet).toContain('<iframe')
    expect(snippet).toContain('mdg1.test')
  })
})

describe('exportCardsReact', () => {
  it('emits a single TSX component with inline STYLES and default cards', () => {
    const cards = normalizeToCards(ORDER)
    const tsx = exportCardsReact({ cards, theme: 'receipt', componentName: 'OrderCards' })
    expect(tsx).toContain('export function OrderCards')
    expect(tsx).toContain('const STYLES = `')
    expect(tsx).toContain('@keyframes mdg-card-enter')
    expect(tsx).toContain('theme = "receipt"')
    expect(tsx).toContain('DEFAULT_CARDS')
    expect(tsx).toContain('Order 42')
  })
})

describe('share hash view + theme', () => {
  it('round-trips cards view and theme', () => {
    const encoded = encodeShareHash({
      input: JSON.stringify(USERS),
      context: 'swedish users',
      seed: 42,
      count: 1,
      itemCount: 5,
      level: 'wild',
      checked: [],
      view: 'cards',
      cardTheme: 'trading',
    })
    expect(encoded.ok).toBe(true)
    if (!encoded.ok) return
    const decoded = decodeShareHash(encoded.hash)
    expect(decoded?.view).toBe('cards')
    expect(decoded?.cardTheme).toBe('trading')
  })
})
