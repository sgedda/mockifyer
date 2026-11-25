/**
 * Turn generated playground JSON into display cards (Users / Orders / Products / generic).
 */

import type { CardField, CardKind, MockCard } from './types'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function str(value: unknown): string | undefined {
  if (value == null) return undefined
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return undefined
}

function money(value: unknown, currency?: unknown): string | undefined {
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount)) return undefined
  const code = str(currency) ?? 'USD'
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: code }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${code}`
  }
}

function pickFields(record: Record<string, unknown>, keys: string[]): CardField[] {
  const fields: CardField[] = []
  for (const key of keys) {
    if (!(key in record)) continue
    const value = record[key]
    if (value !== null && typeof value === 'object') continue
    const rendered = str(value)
    if (rendered === undefined) continue
    fields.push({
      label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
      value: rendered,
    })
  }
  return fields
}

function detectKind(record: Record<string, unknown>): CardKind {
  const keys = new Set(Object.keys(record).map((k) => k.toLowerCase()))
  if (
    keys.has('sku') ||
    (keys.has('price') && (keys.has('name') || keys.has('title')) && !keys.has('items'))
  ) {
    return 'product'
  }
  if (
    keys.has('items') ||
    keys.has('total') ||
    (keys.has('status') && (keys.has('email') || keys.has('orderid') || keys.has('id')))
  ) {
    return 'order'
  }
  if (
    keys.has('email') ||
    keys.has('firstname') ||
    keys.has('lastname') ||
    keys.has('username') ||
    (keys.has('name') && keys.has('phone'))
  ) {
    return 'user'
  }
  return 'generic'
}

function unwrapEntities(output: unknown): unknown[] {
  if (output == null) return []
  if (Array.isArray(output)) return output

  const root = asRecord(output)
  if (!root) return [output]

  // Do not unwrap nested `items` (order line-items) — that would drop the order card.
  const listKeys = ['users', 'products', 'orders', 'data', 'results', 'records']
  for (const key of listKeys) {
    const value = root[key]
    if (Array.isArray(value) && value.length > 0) {
      return value
    }
  }

  const keys = Object.keys(root)
  if (keys.length === 1) {
    const only = root[keys[0]!]
    if (Array.isArray(only)) return only
  }

  return [output]
}

function toUserCard(record: Record<string, unknown>, index: number): MockCard {
  const first = str(record.firstName) ?? str(record.firstname)
  const last = str(record.lastName) ?? str(record.lastname)
  const name =
    [first, last].filter(Boolean).join(' ') ||
    str(record.name) ||
    str(record.username) ||
    str(record.email) ||
    `User ${index + 1}`
  const email = str(record.email)
  const active = record.active
  return {
    id: str(record.id) ?? `user-${index}`,
    kind: 'user',
    title: name,
    subtitle: email,
    badge:
      typeof active === 'boolean' ? (active ? 'Active' : 'Inactive') : str(record.role) ?? str(record.username),
    fields: pickFields(record, ['phone', 'city', 'country', 'company', 'website']),
    rawJson: JSON.stringify(record, null, 2),
  }
}

function toOrderCard(record: Record<string, unknown>, index: number): MockCard {
  const items = Array.isArray(record.items) ? record.items : []
  const itemCount = items.length
  const highlight = money(record.total, record.currency)
  const status = str(record.status)
  return {
    id: str(record.id) ?? `order-${index}`,
    kind: 'order',
    title: `Order ${str(record.id) ?? index + 1}`,
    subtitle: str(record.email) ?? str(record.customer) ?? (itemCount ? `${itemCount} line item(s)` : undefined),
    badge: status ? status.replace(/^./, (c) => c.toUpperCase()) : undefined,
    highlight,
    fields: [
      ...pickFields(record, ['currency', 'createdAt', 'updatedAt']),
      ...(itemCount
        ? [{ label: 'Items', value: items.slice(0, 3).map((item) => {
            const row = asRecord(item)
            if (!row) return String(item)
            const name = str(row.name) ?? str(row.title) ?? 'Item'
            const qty = str(row.qty) ?? str(row.quantity)
            return qty ? `${name} ×${qty}` : name
          }).join(', ') + (items.length > 3 ? '…' : '') }]
        : []),
    ],
    rawJson: JSON.stringify(record, null, 2),
  }
}

function toProductCard(record: Record<string, unknown>, index: number): MockCard {
  const title = str(record.name) ?? str(record.title) ?? `Product ${index + 1}`
  const highlight = money(record.price, record.currency)
  const inStock = record.inStock
  return {
    id: str(record.id) ?? str(record.sku) ?? `product-${index}`,
    kind: 'product',
    title,
    subtitle: str(record.sku) ?? str(record.category),
    badge:
      typeof inStock === 'boolean'
        ? inStock
          ? 'In stock'
          : 'Sold out'
        : str(record.category),
    highlight,
    fields: pickFields(record, ['category', 'currency', 'brand', 'color']),
    rawJson: JSON.stringify(record, null, 2),
  }
}

function toGenericCard(record: Record<string, unknown>, index: number): MockCard {
  const keys = Object.keys(record)
  const titleKey = keys.find((k) => /^(name|title|label|email|id)$/i.test(k)) ?? keys[0]
  const title = titleKey ? str(record[titleKey]) ?? titleKey : `Record ${index + 1}`
  const fields = keys
    .filter((k) => k !== titleKey)
    .slice(0, 6)
    .flatMap((key) => {
      const value = record[key]
      if (value !== null && typeof value === 'object') {
        return [{ label: key, value: Array.isArray(value) ? `${value.length} items` : 'object' }]
      }
      const rendered = str(value)
      return rendered === undefined ? [] : [{ label: key, value: rendered }]
    })
  return {
    id: str(record.id) ?? `card-${index}`,
    kind: 'generic',
    title,
    fields,
    rawJson: JSON.stringify(record, null, 2),
  }
}

export function normalizeToCards(output: unknown): MockCard[] {
  const entities = unwrapEntities(output)
  const cards: MockCard[] = []
  entities.forEach((entity, index) => {
    const record = asRecord(entity)
    if (!record) {
      cards.push({
        id: `scalar-${index}`,
        kind: 'generic',
        title: str(entity) ?? `Item ${index + 1}`,
        fields: [],
        rawJson: JSON.stringify(entity, null, 2),
      })
      return
    }
    const kind = detectKind(record)
    if (kind === 'user') cards.push(toUserCard(record, index))
    else if (kind === 'order') cards.push(toOrderCard(record, index))
    else if (kind === 'product') cards.push(toProductCard(record, index))
    else cards.push(toGenericCard(record, index))
  })
  return cards
}

/** Suggested theme for a card kind (user can override). */
export function suggestedThemeForCards(cards: MockCard[]): import('./types').CardTheme {
  const kinds = new Set(cards.map((c) => c.kind))
  if (kinds.has('user') && !kinds.has('order') && !kinds.has('product')) return 'trading'
  if (kinds.has('order') && !kinds.has('user') && !kinds.has('product')) return 'receipt'
  if (kinds.has('product')) return 'glass'
  return 'clean'
}
