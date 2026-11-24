/**
 * Related-field consistency rules applied after generation (SGE-71).
 *
 * - totals / subtotal / amount = sum of line items (qty × price when present)
 * - ids carried through nested objects (order.id → items[*].orderId, userId ↔ user.id)
 * - created / createdAt ≤ updated / updatedAt (and start ≤ end)
 * - currency fields consistent when a currency option is set
 * - email local-part derived from the same record's person name when both exist
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

const LINE_ARRAY_KEYS = new Set([
  'items',
  'lineitems',
  'lines',
  'products',
  'entries',
  'details',
  'orderitems',
  'orderlineitems',
]);

const TOTAL_KEYS = new Set(['total', 'subtotal', 'amount', 'grandtotal', 'ordertotal']);

const QTY_KEYS = new Set(['qty', 'quantity', 'count', 'qtyordered', 'units']);

const UNIT_PRICE_KEYS = new Set(['price', 'unitprice', 'unit_price', 'unitcost']);

const LINE_AMOUNT_KEYS = new Set(['price', 'amount', 'total', 'linetotal', 'lineamount', 'cost']);

const CURRENCY_KEYS = new Set(['currency', 'currencycode', 'curr']);

const EMAIL_KEYS = new Set(['email', 'emailaddress', 'useremail', 'mail']);

const FULL_NAME_KEYS = new Set(['name', 'fullname', 'displayname', 'customername']);

const FIRST_NAME_KEYS = new Set(['firstname', 'fname', 'givenname', 'first']);

const LAST_NAME_KEYS = new Set(['lastname', 'lname', 'surname', 'familyname', 'last']);

const DATE_PAIRS: Array<[string, string]> = [
  ['created', 'updated'],
  ['createdat', 'updatedat'],
  ['created_at', 'updated_at'],
  ['start', 'end'],
  ['startdate', 'enddate'],
  ['start_date', 'end_date'],
  ['startsat', 'endsat'],
  ['startat', 'endat'],
  ['validfrom', 'validto'],
  ['fromdate', 'todate'],
];

function findKey(obj: Record<string, unknown>, candidates: Set<string>): string | undefined {
  for (const key of Object.keys(obj)) {
    if (candidates.has(normalizeKey(key))) {
      return key;
    }
  }
  return undefined;
}

function findKeys(obj: Record<string, unknown>, candidates: Set<string>): string[] {
  return Object.keys(obj).filter((key) => candidates.has(normalizeKey(key)));
}

function roundMoney(n: number, decimals: number): number {
  if (decimals <= 0) {
    return Math.round(n);
  }
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function lineItemAmount(item: Record<string, unknown>): number | null {
  const qtyKey = findKey(item, QTY_KEYS);
  const unitKey = findKey(item, UNIT_PRICE_KEYS);
  if (qtyKey && unitKey) {
    const qty = item[qtyKey];
    const price = item[unitKey];
    if (typeof qty === 'number' && typeof price === 'number' && Number.isFinite(qty * price)) {
      return qty * price;
    }
  }
  for (const key of findKeys(item, LINE_AMOUNT_KEYS)) {
    // Prefer dedicated line totals over raw price when qty was absent
    if (qtyKey && UNIT_PRICE_KEYS.has(normalizeKey(key))) {
      continue;
    }
    const v = item[key];
    if (typeof v === 'number' && Number.isFinite(v)) {
      return v;
    }
  }
  return null;
}

function applyTotals(obj: Record<string, unknown>): void {
  const totalKeys = findKeys(obj, TOTAL_KEYS);
  if (totalKeys.length === 0) {
    return;
  }

  let lineSum: number | null = null;
  let decimals = 0;

  for (const [key, val] of Object.entries(obj)) {
    if (!Array.isArray(val) || !LINE_ARRAY_KEYS.has(normalizeKey(key))) {
      continue;
    }
    let sum = 0;
    let any = false;
    for (const item of val) {
      if (!isPlainObject(item)) continue;
      const amount = lineItemAmount(item);
      if (amount == null) continue;
      any = true;
      sum += amount;
      if (!Number.isInteger(amount)) {
        decimals = 2;
      }
    }
    if (any) {
      lineSum = sum;
      break;
    }
  }

  if (lineSum == null) {
    return;
  }
  const rounded = roundMoney(lineSum, decimals);
  for (const key of totalKeys) {
    if (typeof obj[key] === 'number' || obj[key] == null) {
      obj[key] = rounded;
    }
  }
}

function syncNestedObjectIds(obj: Record<string, unknown>): void {
  for (const [key, val] of Object.entries(obj)) {
    if (!isPlainObject(val) || val.id == null) {
      continue;
    }
    const id = val.id;
    for (const fk of [`${key}Id`, `${key}_id`]) {
      if (fk in obj) {
        obj[fk] = id;
      }
    }
  }
}

function foreignKeyPrefix(field: string): string | null {
  const idMatch = /^(.*)Id$/.exec(field);
  if (idMatch && idMatch[1] && idMatch[1].length > 0) {
    return idMatch[1];
  }
  const snake = /^(.*)_id$/.exec(field);
  if (snake && snake[1] && snake[1].length > 0) {
    return snake[1];
  }
  return null;
}

function propagateParentId(parent: Record<string, unknown>): void {
  const parentId = parent.id;
  if (parentId == null) {
    return;
  }

  for (const val of Object.values(parent)) {
    if (!Array.isArray(val)) {
      continue;
    }
    for (const item of val) {
      if (!isPlainObject(item)) {
        continue;
      }
      for (const ik of Object.keys(item)) {
        if (ik === 'id') continue;
        const prefix = foreignKeyPrefix(ik);
        if (!prefix) continue;
        const sibling = parent[prefix];
        if (isPlainObject(sibling) && sibling.id != null) {
          item[ik] = sibling.id;
        } else if (!(prefix in parent) || !isPlainObject(parent[prefix])) {
          // FK points at this parent record (e.g. items[*].orderId on an order)
          item[ik] = parentId;
        }
      }
    }
  }
}

function parseTime(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

function applyDateOrder(obj: Record<string, unknown>): void {
  const byNorm = new Map<string, string>();
  for (const key of Object.keys(obj)) {
    byNorm.set(normalizeKey(key), key);
  }

  for (const [earlierNorm, laterNorm] of DATE_PAIRS) {
    const earlierKey = byNorm.get(earlierNorm);
    const laterKey = byNorm.get(laterNorm);
    if (!earlierKey || !laterKey) continue;
    const a = parseTime(obj[earlierKey]);
    const b = parseTime(obj[laterKey]);
    if (a == null || b == null) continue;
    if (a <= b) continue;
    const tmp = obj[earlierKey];
    obj[earlierKey] = obj[laterKey];
    obj[laterKey] = tmp;
  }
}

function applyCurrency(obj: Record<string, unknown>, currency: string): void {
  for (const key of Object.keys(obj)) {
    if (CURRENCY_KEYS.has(normalizeKey(key))) {
      obj[key] = currency;
    }
  }
}

/**
 * ASCII-ish email local-part from a display name
 * (`Pernilla Olofsson` → `pernilla.olofsson`, `José María` → `jose.maria`).
 */
export function emailLocalPartFromName(name: string): string {
  const ascii = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/æ/gi, 'ae')
    .replace(/œ/gi, 'oe')
    .replace(/ð/gi, 'd')
    .replace(/þ/gi, 'th');
  const local = ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .replace(/\.{2,}/g, '.');
  return local || 'user';
}

function personNameFromRecord(obj: Record<string, unknown>): string | null {
  const fullKey = findKey(obj, FULL_NAME_KEYS);
  if (fullKey && typeof obj[fullKey] === 'string' && String(obj[fullKey]).trim()) {
    return String(obj[fullKey]).trim();
  }
  const firstKey = findKey(obj, FIRST_NAME_KEYS);
  const lastKey = findKey(obj, LAST_NAME_KEYS);
  const first = firstKey && typeof obj[firstKey] === 'string' ? String(obj[firstKey]).trim() : '';
  const last = lastKey && typeof obj[lastKey] === 'string' ? String(obj[lastKey]).trim() : '';
  const combined = `${first} ${last}`.trim();
  return combined || null;
}

function emailDomainFromExisting(email: unknown): string {
  if (typeof email === 'string') {
    const at = email.lastIndexOf('@');
    if (at > 0 && at < email.length - 1) {
      const domain = email.slice(at + 1).trim().toLowerCase();
      if (domain.includes('.')) {
        return domain;
      }
    }
  }
  return 'example.com';
}

/**
 * Align email fields with the person name on the same object.
 * Nested line-item objects without a person name are left alone.
 */
function applyEmailFromPersonName(obj: Record<string, unknown>): void {
  const name = personNameFromRecord(obj);
  if (!name) {
    return;
  }
  const emailKeys = findKeys(obj, EMAIL_KEYS);
  if (emailKeys.length === 0) {
    return;
  }
  const local = emailLocalPartFromName(name);
  for (const key of emailKeys) {
    const domain = emailDomainFromExisting(obj[key]);
    obj[key] = `${local}@${domain}`;
  }
}

/**
 * Mutate a generated record (object or array tree) so related fields stay consistent.
 */
export function applyRelatedFieldConsistency(
  value: unknown,
  options: { currency?: string } = {}
): unknown {
  if (Array.isArray(value)) {
    for (const item of value) {
      applyRelatedFieldConsistency(item, options);
    }
    return value;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  // Depth-first so nested objects are consistent before parent aggregates
  for (const child of Object.values(value)) {
    applyRelatedFieldConsistency(child, options);
  }

  syncNestedObjectIds(value);
  propagateParentId(value);
  applyTotals(value);
  applyDateOrder(value);
  if (options.currency) {
    applyCurrency(value, options.currency);
  }
  applyEmailFromPersonName(value);

  return value;
}
