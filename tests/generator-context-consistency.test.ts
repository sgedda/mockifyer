import {
  applyRelatedFieldConsistency,
  createSeededFaker,
  defaultSampleForEntity,
  emailLocalPartFromName,
  FieldKind,
  generate,
  generateAsync,
  inferFieldKind,
  loadLocale,
  isLocaleLoaded,
  isLineItemProductNamePath,
  parseContext,
  resolveLocaleCode,
  weightedPick,
  createMulberry32,
  __resetLoadedLocalesForTests,
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
      entity: 'user',
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

  it('does not treat bare short codes as locale in ordinary words', () => {
    expect(parseContext('en lista med svenska användare').locale).toBe('sv');
    expect(parseContext('en lista med users').locale).toBeUndefined();
    expect(parseContext('locale sv').locale).toBe('sv');
    expect(parseContext('lang: de').locale).toBe('de');
    expect(parseContext('sv').locale).toBe('sv');
    expect(parseContext('sv-SE').locale).toBe('sv');
  });

  it('treats N items as itemCount, not record count', () => {
    expect(parseContext('swedish users, 5 items')).toEqual({
      locale: 'sv',
      entity: 'user',
      itemCount: 5,
    });
    expect(parseContext('10 orders, 3 items each, prices in EUR')).toEqual({
      count: 10,
      itemCount: 3,
      currency: 'EUR',
      entity: 'order',
    });
    expect(parseContext('5 line items').itemCount).toBe(5);
    expect(parseContext('5 line items').count).toBeUndefined();
    expect(parseContext('3 products in each').itemCount).toBe(3);
    expect(parseContext('3 products in each').count).toBeUndefined();
    expect(parseContext('10 products')).toEqual({
      count: 10,
      entity: 'product',
    });
  });

  it('infers entity for built-in sample shapes', () => {
    expect(parseContext('swedish users').entity).toBe('user');
    expect(parseContext('customers in Berlin').entity).toBe('user');
    expect(parseContext('10 orders').entity).toBe('order');
    expect(parseContext('catalog of products').entity).toBe('product');
    expect(parseContext('random dataset').entity).toBeUndefined();
    const user = defaultSampleForEntity('user') as Record<string, unknown>;
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('phone');
    expect(user).not.toHaveProperty('items');
    const product = defaultSampleForEntity('product') as Record<string, unknown>;
    expect(product).toHaveProperty('sku');
    expect(product).toHaveProperty('price');
    expect(defaultSampleForEntity(undefined)).toHaveProperty('items');
  });

  it('returns empty object for blank input', () => {
    expect(parseContext('')).toEqual({});
    expect(parseContext('   ')).toEqual({});
  });

  it('parses EU / E.164 phone format hints', () => {
    expect(parseContext('swedish users, EU phone numbers').phoneFormat).toBe(
      'international'
    );
    expect(parseContext('E.164 phones').phoneFormat).toBe('international');
    expect(parseContext('international phones').phoneFormat).toBe('international');
    expect(parseContext('national phones').phoneFormat).toBe('national');
    expect(parseContext('swedish users').phoneFormat).toBeUndefined();
  });
});

describe('generator — lazy locales', () => {
  beforeEach(() => {
    __resetLoadedLocalesForTests();
  });
  afterEach(() => {
    __resetLoadedLocalesForTests();
  });

  it('en is always loaded; sync generate works without preload', () => {
    expect(isLocaleLoaded('en')).toBe(true);
    const out = generate({ firstName: 'Ada' }, { count: 1, seed: 1, locale: 'en' });
    expect(typeof (out[0] as { firstName: string }).firstName).toBe('string');
  });

  it('throws a clear error when sync generate uses an unloaded locale', () => {
    expect(isLocaleLoaded('sv')).toBe(false);
    expect(() =>
      generate({ firstName: 'Ada' }, { count: 1, seed: 1, locale: 'sv' })
    ).toThrow(/Locale "sv" is not loaded/);
    expect(() => createSeededFaker(1, 'de')).toThrow(/Locale "de" is not loaded/);
  });

  it('sync generate works after loadLocale', async () => {
    await loadLocale('sv');
    expect(isLocaleLoaded('sv')).toBe(true);
    const a = generate({ firstName: 'Ada' }, { count: 1, seed: 42, locale: 'sv' });
    const b = generate({ firstName: 'Ada' }, { count: 1, seed: 42, locale: 'sv' });
    expect(a).toEqual(b);
  });

  it('generateAsync loads locale then matches sync output', async () => {
    const sample = { firstName: 'Ada', city: 'X' };
    const asyncOut = await generateAsync(sample, { count: 1, seed: 7, locale: 'fr' });
    // fr is now loaded — sync path should match
    const syncOut = generate(sample, { count: 1, seed: 7, locale: 'fr' });
    expect(syncOut).toEqual(asyncOut);
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

  beforeAll(async () => {
    await Promise.all(['sv', 'de', 'fr', 'es'].map((l) => loadLocale(l)));
  });

  it('locale from context changes faker values vs English', async () => {
    const en = generate(sample, { count: 1, seed: 42, locale: 'en' });
    const sv = await generateAsync(sample, { count: 1, seed: 42, locale: 'sv' });
    expect(JSON.stringify(en)).not.toBe(JSON.stringify(sv));
    expect(await generateAsync(sample, { count: 1, seed: 42, locale: 'sv' })).toEqual(sv);
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

  it('explicit options override parsed context', async () => {
    const [record] = (await generateAsync(sample, {
      count: 1,
      seed: 1,
      context: 'Swedish users, prices in SEK',
      locale: 'de',
      currency: 'EUR',
    })) as Array<typeof sample>;
    expect(record.currency).toBe('EUR');
    const fromDe = await generateAsync(sample, {
      count: 1,
      seed: 1,
      locale: 'de',
      currency: 'EUR',
    });
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

  it('swedish locale context pins country to SE', async () => {
    const userSample = {
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
    };
    for (let seed = 0; seed < 25; seed++) {
      const [record] = (await generateAsync(userSample, {
        count: 1,
        seed,
        context: 'swedish users',
      })) as Array<{ users: Array<{ country: string }> }>;
      expect(record.users.length).toBeGreaterThanOrEqual(1);
      for (const user of record.users) {
        expect(user.country).toBe('SE');
      }
    }
  });

  it('EU phone numbers context emits consistent E.164 phones', async () => {
    const userSample = {
      phone: '+46 70 123 45 67',
      country: 'SE',
      firstName: 'Ada',
    };
    const e164 = /^\+[1-9]\d{7,14}$/;
    for (let seed = 0; seed < 30; seed++) {
      const [record] = (await generateAsync(userSample, {
        count: 1,
        seed,
        context: 'swedish users, EU phone numbers',
      })) as Array<{ phone: string; country: string }>;
      expect(record.country).toBe('SE');
      expect(record.phone).toMatch(e164);
      expect(record.phone.startsWith('+46')).toBe(true);
    }
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

  it('same sample+seed+context => identical JSON', async () => {
    const a = await generateAsync(sample, opts);
    const b = await generateAsync(sample, opts);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a).toHaveLength(3);
  });

  it('createSeededFaker respects locale deterministically', async () => {
    await loadLocale('sv');
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

describe('generator — person/product consistency', () => {
  beforeAll(async () => {
    await loadLocale('sv');
  });

  it('emailLocalPartFromName strips accents and joins with dots', () => {
    expect(emailLocalPartFromName('Pernilla Olofsson')).toBe('pernilla.olofsson');
    expect(emailLocalPartFromName('José María')).toBe('jose.maria');
  });

  it('infers items[*].name as ProductName, root name as FullName', () => {
    expect(isLineItemProductNamePath('$.items[*].name', 'name')).toBe(true);
    expect(inferFieldKind('name', ['Widget'], '$.items[*].name').kind).toBe(
      FieldKind.ProductName
    );
    expect(inferFieldKind('name', ['Ada Lovelace'], '$.name').kind).toBe(FieldKind.FullName);
  });

  it('swedish context defaults currency to SEK and aligns email with name', async () => {
    const sample = {
      id: 1,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      status: 'active',
      currency: 'USD',
      total: 19.99,
      items: [{ id: 10, name: 'Widget', qty: 2, price: 9.99 }],
    };
    const records = (await generateAsync(sample, {
      seed: 7,
      context: 'swedish users, 5 items',
    })) as Array<{
      name: string;
      email: string;
      currency: string;
      items: Array<{ name: string }>;
    }>;

    // "5 items" → nested items length; record count defaults to 1
    expect(records).toHaveLength(1);
    const record = records[0]!;
    expect(record.currency).toBe('SEK');
    expect(record.items).toHaveLength(5);
    const local = emailLocalPartFromName(record.name);
    expect(record.email).toBe(`${local}@${record.email.split('@')[1]}`);
    expect(record.email.startsWith(`${local}@`)).toBe(true);
    for (const item of record.items) {
      // Product titles from faker.commerce — not "First Last" person shapes
      expect(item.name).not.toMatch(/^(Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)\s/);
      expect(item.name.split(/\s+/).length).toBeLessThanOrEqual(5);
      // Must not equal the parent person name
      expect(item.name).not.toBe(record.name);
    }
  });

  it('applies itemCount and record count from context phrases', async () => {
    const sample = {
      id: 1,
      status: 'open',
      currency: 'USD',
      total: 10,
      items: [{ id: 1, name: 'Widget', qty: 1, price: 10 }],
    };
    const records = (await generateAsync(sample, {
      seed: 7,
      context: '10 orders, 3 items each, prices in EUR',
    })) as Array<{ currency: string; items: unknown[] }>;
    expect(records).toHaveLength(10);
    for (const record of records) {
      expect(record.currency).toBe('EUR');
      expect(record.items).toHaveLength(3);
    }
  });

  it('applyRelatedFieldConsistency rewrites email from name', () => {
    const record = {
      name: 'Pernilla Olofsson',
      email: 'random.other@corp.example',
    };
    applyRelatedFieldConsistency(record);
    expect(record.email).toBe('pernilla.olofsson@corp.example');
  });
});
