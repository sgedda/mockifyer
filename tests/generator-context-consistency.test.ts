import {
  applyRelatedFieldConsistency,
  createSeededFaker,
  generate,
  parseContext,
  resolveLocaleCode,
  weightedPick,
  createMulberry32,
} from '@sgedda/mockifyer-generator';

describe('parseContext', () => {
  it('parses locale, currency, count, and enum mix from free text', () => {
    const parsed = parseContext(
      'Swedish users, prices in SEK, 20 orders, mix of paid/refunded/failed'
    );
    expect(parsed).toEqual({
      locale: 'sv',
      currency: 'SEK',
      count: 20,
      enumMix: { values: ['paid', 'refunded', 'failed'] },
    });
  });

  it('parses weighted enum mix', () => {
    const parsed = parseContext('70% paid, 20% refunded, 10% failed');
    expect(parsed.enumMix).toEqual({
      values: ['paid', 'refunded', 'failed'],
      weights: [70, 20, 10],
    });
  });

  it('maps language names and locale tags', () => {
    expect(parseContext('German customers').locale).toBe('de');
    expect(parseContext('fr-FR market').locale).toBe('fr');
    expect(parseContext('Spanish names').locale).toBe('es');
    expect(parseContext('en-US users').locale).toBe('en');
    expect(resolveLocaleCode('svenska')).toBe('sv');
    expect(resolveLocaleCode('unknown-xx')).toBe('en');
  });

  it('returns empty object for blank input', () => {
    expect(parseContext('')).toEqual({});
    expect(parseContext('   ')).toEqual({});
  });
});

describe('generator — context options change output', () => {
  const sample = {
    id: 1,
    firstName: 'Ada',
    status: 'shipped',
    currency: 'USD',
    city: 'Austin',
  };

  it('locale from context changes faker values vs English', () => {
    const en = generate(sample, { count: 1, seed: 42, locale: 'en' });
    const sv = generate(sample, { count: 1, seed: 42, locale: 'sv' });
    expect(JSON.stringify(en)).not.toBe(JSON.stringify(sv));
    // Same seed + locale still stable
    expect(generate(sample, { count: 1, seed: 42, locale: 'sv' })).toEqual(sv);
  });

  it('currency option forces currency fields', () => {
    const [record] = generate(sample, {
      count: 1,
      seed: 1,
      currency: 'SEK',
    }) as Array<typeof sample>;
    expect(record.currency).toBe('SEK');
  });

  it('context currency is applied when explicit currency is omitted', () => {
    const [record] = generate(sample, {
      count: 1,
      seed: 1,
      context: 'prices in NOK',
    }) as Array<typeof sample>;
    expect(record.currency).toBe('NOK');
  });

  it('explicit options override parsed context', () => {
    const [record] = generate(sample, {
      count: 1,
      seed: 1,
      context: 'Swedish users, prices in SEK',
      locale: 'de',
      currency: 'EUR',
    }) as Array<typeof sample>;
    expect(record.currency).toBe('EUR');
    const fromDe = generate(sample, { count: 1, seed: 1, locale: 'de', currency: 'EUR' });
    expect(record).toEqual(fromDe[0]);
  });

  it('count from context sets record count', () => {
    const records = generate(sample, {
      seed: 2,
      context: '5 orders',
    });
    expect(records).toHaveLength(5);
  });

  it('enum mix steers status-like fields', () => {
    const records = generate(sample, {
      count: 30,
      seed: 9,
      context: 'mix of paid/refunded/failed',
    }) as Array<{ status: string }>;
    const allowed = new Set(['paid', 'refunded', 'failed']);
    for (const r of records) {
      expect(allowed.has(r.status)).toBe(true);
    }
    expect(new Set(records.map((r) => r.status)).size).toBeGreaterThan(1);
  });

  it('weighted enum mix prefers heavier values', () => {
    const records = generate(sample, {
      count: 100,
      seed: 11,
      context: '90% paid, 5% refunded, 5% failed',
    }) as Array<{ status: string }>;
    const paid = records.filter((r) => r.status === 'paid').length;
    expect(paid).toBeGreaterThan(70);
  });
});

describe('generator — related-field consistency', () => {
  it('sets total/subtotal/amount to sum of line items (qty * price)', () => {
    const sample = {
      total: 0,
      subtotal: 0,
      amount: 0,
      items: [
        { qty: 2, price: 10.5 },
        { qty: 1, price: 3 },
      ],
    };
    const [record] = generate(sample, { count: 1, seed: 5 }) as Array<{
      total: number;
      subtotal: number;
      amount: number;
      items: Array<{ qty: number; price: number }>;
    }>;
    const expected = record.items.reduce((s, i) => s + i.qty * i.price, 0);
    const rounded = Math.round(expected * 100) / 100;
    expect(record.total).toBe(rounded);
    expect(record.subtotal).toBe(rounded);
    expect(record.amount).toBe(rounded);
  });

  it('carries parent id into items[*].orderId', () => {
    const sample = {
      id: 99,
      items: [{ orderId: 99, qty: 1, price: 5 }],
    };
    const [record] = generate(sample, { count: 1, seed: 8 }) as Array<{
      id: number;
      items: Array<{ orderId: number }>;
    }>;
    expect(record.items.length).toBeGreaterThan(0);
    for (const item of record.items) {
      expect(item.orderId).toBe(record.id);
    }
  });

  it('matches userId to user.id', () => {
    const sample = {
      userId: 1,
      user: { id: 1, email: 'a@b.com' },
    };
    const [record] = generate(sample, { count: 1, seed: 3 }) as Array<{
      userId: number;
      user: { id: number };
    }>;
    expect(record.userId).toBe(record.user.id);
  });

  it('ensures createdAt <= updatedAt and start <= end', () => {
    const sample = {
      createdAt: '2024-06-01T12:00:00.000Z',
      updatedAt: '2024-06-02T12:00:00.000Z',
      start: '2024-01-01',
      end: '2024-01-10',
    };
    for (let seed = 0; seed < 25; seed++) {
      const [record] = generate(sample, { count: 1, seed }) as Array<typeof sample>;
      expect(Date.parse(record.createdAt)).toBeLessThanOrEqual(Date.parse(record.updatedAt));
      expect(Date.parse(record.start)).toBeLessThanOrEqual(Date.parse(record.end));
    }
  });

  it('keeps currency fields consistent when currency option is set', () => {
    const sample = {
      currency: 'USD',
      payment: { currencyCode: 'USD', amount: 10 },
    };
    const [record] = generate(sample, {
      count: 1,
      seed: 4,
      currency: 'SEK',
    }) as Array<{
      currency: string;
      payment: { currencyCode: string };
    }>;
    expect(record.currency).toBe('SEK');
    expect(record.payment.currencyCode).toBe('SEK');
  });

  it('applyRelatedFieldConsistency is idempotent for the order fixture', () => {
    const order = {
      id: 7,
      userId: 7,
      user: { id: 7 },
      total: 999,
      currency: 'EUR',
      items: [
        { orderId: 0, qty: 2, price: 4 },
        { orderId: 0, qty: 1, price: 3 },
      ],
      createdAt: '2024-02-02T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    applyRelatedFieldConsistency(order, { currency: 'SEK' });
    expect(order.userId).toBe(7);
    expect(order.items.every((i) => i.orderId === 7)).toBe(true);
    expect(order.total).toBe(11);
    expect(order.currency).toBe('SEK');
    expect(Date.parse(order.createdAt)).toBeLessThanOrEqual(Date.parse(order.updatedAt));
  });
});

describe('generator — determinism with context', () => {
  const sample = {
    id: 1,
    firstName: 'Ada',
    status: 'open',
    currency: 'USD',
    total: 10,
    items: [{ orderId: 1, qty: 2, price: 5 }],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
  };

  const opts = {
    seed: 42,
    context: 'Swedish users, prices in SEK, 3 orders, mix of paid/refunded/failed',
  };

  it('same sample+seed+context => identical JSON', () => {
    const a = generate(sample, opts);
    const b = generate(sample, opts);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a).toHaveLength(3);
  });

  it('createSeededFaker respects locale deterministically', () => {
    expect(createSeededFaker(99, 'sv').person.firstName()).toBe(
      createSeededFaker(99, 'sv').person.firstName()
    );
    expect(createSeededFaker(99, 'sv').person.firstName()).not.toBe(
      createSeededFaker(99, 'en').person.firstName()
    );
  });

  it('weightedPick is deterministic for a given rng sequence', () => {
    const a = createMulberry32(1);
    const b = createMulberry32(1);
    const values = ['paid', 'refunded', 'failed'];
    const weights = [70, 20, 10];
    expect([weightedPick(a, values, weights), weightedPick(a, values, weights)]).toEqual([
      weightedPick(b, values, weights),
      weightedPick(b, values, weights),
    ]);
  });
});
