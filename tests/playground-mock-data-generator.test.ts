/**
 * Playground helpers: shareable URL round-trip, determinism, CLI parity,
 * and browser mock-path naming vs the Node writer (SGE-76 / SGE-77).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  FieldKind,
  generateAsync,
  infer,
  serializeMock,
  variants,
} from '@sgedda/mockifyer-generator';
import { getMockRelativeFile as nodeGetMockRelativeFile } from '@sgedda/mockifyer-generator/node';
import { runCli } from '../packages/mockifyer-generator/src/cli';
import {
  encodeShareHash,
  decodeShareHash,
} from '../mockifyer-web/frontend/src/lib/mock-data-generator/share-state';
import { getMockRelativeFile as browserGetMockRelativeFile } from '../mockifyer-web/frontend/src/lib/mock-data-generator/mock-paths';
import { buildVariantZipEntries } from '../mockifyer-web/frontend/src/lib/mock-data-generator/download';
import {
  buildSampleCliCommand,
  buildVariantsCliCommand,
} from '../mockifyer-web/frontend/src/lib/mock-data-generator/cli-command';
import {
  DEFAULT_SAMPLE,
  MAX_SHARE_HASH_LENGTH,
  PLAYGROUND_PRESETS,
  TRY_DEMO_COMMAND,
  presetSampleJson,
} from '../mockifyer-web/frontend/src/lib/mock-data-generator/defaults';
import {
  FIELD_KIND_OPTIONS,
  kindOptionsIncluding,
  partitionFieldRows,
  structuralArrayLabel,
} from '../mockifyer-web/frontend/src/lib/mock-data-generator/field-kinds';

const SAMPLE = {
  id: 1,
  email: 'a@b.com',
  status: 'shipped',
  currency: 'USD',
  total: 19.99,
  items: [{ orderId: 1, qty: 2, price: 9.99 }],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-02T00:00:00.000Z',
};

const SAMPLE_MOCK = {
  request: {
    method: 'GET',
    url: 'https://example.invalid/orders',
    headers: {},
  },
  response: {
    status: 200,
    data: SAMPLE,
    headers: { 'content-type': 'application/json' },
  },
  timestamp: '2024-01-01T00:00:00.000Z',
  duration: 12,
};

describe('playground shareable URL state', () => {
  it('round-trips input, context, seed, count, slider, and checklist', () => {
    const encoded = encodeShareHash({
      input: JSON.stringify(DEFAULT_SAMPLE, null, 2),
      context: 'prices in SEK, 20 orders',
      seed: 42,
      count: 5,
      level: 'wild',
      checked: ['empty-lists', 'http-404'],
      overrides: { '$.email': 'email' },
    });
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;

    const decoded = decodeShareHash(encoded.hash);
    expect(decoded).toEqual({
      input: JSON.stringify(DEFAULT_SAMPLE, null, 2),
      context: 'prices in SEK, 20 orders',
      seed: 42,
      count: 5,
      level: 'wild',
      checked: ['empty-lists', 'http-404'],
      overrides: { '$.email': 'email' },
    });
  });

  it('returns too_large when the compressed hash exceeds the limit', () => {
    // High-entropy payload so deflate cannot shrink below the URL limit
    const bytes = new Uint8Array(12_000);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = (Math.imul(i + 1, 1103515245) >>> 0) % 256;
      // Mix in a second stream so the sequence is not purely linear
      bytes[i] = bytes[i]! ^ ((Math.imul(i ^ 0x9e3779b9, 2654435761) >>> 8) & 0xff);
    }
    const huge = JSON.stringify({
      blob: Buffer.from(bytes).toString('base64'),
    });
    const encoded = encodeShareHash({
      input: huge,
      context: '',
      seed: 1,
      count: 1,
      level: 'mild',
      checked: [],
    });
    expect(encoded.ok).toBe(false);
    if (encoded.ok) return;
    expect(encoded.reason).toBe('too_large');
    expect(encoded.approximateLength).toBeGreaterThan(MAX_SHARE_HASH_LENGTH);
  });
});

describe('playground determinism', () => {
  it('same seed + chaos level yields identical variants', () => {
    const a = variants(SAMPLE, { seed: 42, chaosLevel: 'wild' });
    const b = variants(SAMPLE, { seed: 42, chaosLevel: 'wild' });
    expect(a.map((v) => v.name)).toEqual(b.map((v) => v.name));
    expect(a.map((v) => serializeMock(v.mock))).toEqual(b.map((v) => serializeMock(v.mock)));
  });

  it('different chaos levels change the variant set', () => {
    const mild = variants(SAMPLE, { seed: 7, chaosLevel: 'mild' });
    const wild = variants(SAMPLE, { seed: 7, chaosLevel: 'wild' });
    expect(wild.length).toBeGreaterThan(mild.length);
  });
});

describe('playground field-kind dropdown options', () => {
  it('lists every FieldKind enum value (no blank Select for inferred kinds)', () => {
    const optionSet = new Set<string>(FIELD_KIND_OPTIONS);
    for (const kind of Object.values(FieldKind)) {
      expect(optionSet.has(kind)).toBe(true);
    }
    expect(optionSet.has(FieldKind.ProductName)).toBe(true);
  });

  it('includes productName for $.items[*].name from the default sample shape', () => {
    const { fields } = infer(DEFAULT_SAMPLE);
    const nameField = fields.find((f) => f.path === '$.items[*].name');
    expect(nameField).toBeDefined();
    expect(nameField!.kind).toBe(FieldKind.ProductName);
    const options = kindOptionsIncluding(nameField!.kind);
    expect(options).toContain('productName');
    expect(options).toContain(nameField!.kind);
  });

  it('treats $.items as a structural array row, not an editable unknown kind', () => {
    const { fields } = infer(DEFAULT_SAMPLE);
    const { editable, structural } = partitionFieldRows(fields);
    expect(structural.some((f) => f.path === '$.items')).toBe(true);
    expect(editable.some((f) => f.path === '$.items')).toBe(false);
    const items = structural.find((f) => f.path === '$.items')!;
    expect(structuralArrayLabel(items, fields)).toBe('array of objects');
  });
});

describe('playground sample presets', () => {
  it.each(PLAYGROUND_PRESETS.map((p) => [p.id, p] as const))(
    'preset %s generates at least one record',
    async (_id, preset) => {
      const records = await generateAsync(preset.sample, {
        seed: 42,
        count: 2,
        context: preset.context,
      });
      expect(Array.isArray(records)).toBe(true);
      expect(records.length).toBeGreaterThan(0);
      expect(presetSampleJson(preset)).toContain('{');
    }
  );

  it('keeps teaser presets to at most four', () => {
    const teaser = PLAYGROUND_PRESETS.filter((p) => p.teaser);
    expect(teaser.length).toBeGreaterThanOrEqual(3);
    expect(teaser.length).toBeLessThanOrEqual(4);
    expect(teaser.map((p) => p.id)).toEqual(
      expect.arrayContaining(['users', 'orders', 'products', 'jsonplaceholder'])
    );
  });

  it('products preset preserves catalog shape and money/sku kinds', async () => {
    const products = PLAYGROUND_PRESETS.find((p) => p.id === 'products')!;
    const { fields } = infer(products.sample);
    const byPath = Object.fromEntries(fields.map((f) => [f.path, f]));
    expect(byPath['$.products[*].sku']?.kind).toBeDefined();
    expect(byPath['$.products[*].name']?.kind).toBe(FieldKind.ProductName);
    expect(byPath['$.products[*].price']?.kind).toBe(FieldKind.Money);
    expect(byPath['$.products[*].currency']?.kind).toBe(FieldKind.Currency);
    const [record] = (await generateAsync(products.sample, {
      seed: 7,
      count: 1,
      context: products.context,
    })) as Array<{ products: Array<{ sku: string; price: number; currency: string }> }>;
    expect(record.products.length).toBeGreaterThanOrEqual(1);
    expect(typeof record.products[0]!.sku).toBe('string');
    expect(typeof record.products[0]!.price).toBe('number');
    expect(record.products[0]!.currency).toBe('EUR');
  });

  it('blog preset keeps posts + comments arrays non-empty', async () => {
    const blog = PLAYGROUND_PRESETS.find((p) => p.id === 'blog')!;
    const [record] = (await generateAsync(blog.sample, {
      seed: 3,
      count: 1,
      context: blog.context,
    })) as Array<{
      posts: Array<{ title: string; comments: Array<{ body: string }> }>;
    }>;
    expect(record.posts.length).toBeGreaterThanOrEqual(1);
    expect(record.posts[0]!.comments.length).toBeGreaterThanOrEqual(1);
    expect(typeof record.posts[0]!.title).toBe('string');
  });

  it('payments preset steers status via enum mix', async () => {
    const payments = PLAYGROUND_PRESETS.find((p) => p.id === 'payments')!;
    const records = (await generateAsync(payments.sample, {
      seed: 11,
      count: 12,
      context: payments.context,
    })) as Array<{ transactions: Array<{ status: string; amount: number }> }>;
    const statuses = new Set(
      records.flatMap((r) => r.transactions.map((t) => t.status))
    );
    for (const status of statuses) {
      expect(['paid', 'refunded', 'failed']).toContain(status);
    }
    expect(records[0]!.transactions.length).toBeGreaterThanOrEqual(1);
  });

  it('flights preset preserves booking keys', async () => {
    const flights = PLAYGROUND_PRESETS.find((p) => p.id === 'flights')!;
    const [record] = (await generateAsync(flights.sample, {
      seed: 5,
      count: 1,
      context: flights.context,
    })) as Array<{
      bookings: Array<{ from: string; to: string; confirmationCode: string }>;
    }>;
    expect(record.bookings[0]).toEqual(
      expect.objectContaining({
        from: expect.any(String),
        to: expect.any(String),
        confirmationCode: expect.any(String),
      })
    );
  });

  it('paginated preset keeps page/total/next alongside items', async () => {
    const paginated = PLAYGROUND_PRESETS.find((p) => p.id === 'paginated')!;
    const { fields } = infer(paginated.sample);
    expect(fields.some((f) => f.path === '$.items')).toBe(true);
    const [record] = (await generateAsync(paginated.sample, {
      seed: 2,
      count: 1,
    })) as Array<{
      items: unknown[];
      page: number;
      total: number;
      next: string;
    }>;
    expect(record.items.length).toBeGreaterThanOrEqual(1);
    expect(typeof record.page).toBe('number');
    expect(typeof record.total).toBe('number');
    expect(typeof record.next).toBe('string');
  });

  it('error preset preserves error envelope keys', async () => {
    const errorPreset = PLAYGROUND_PRESETS.find((p) => p.id === 'error')!;
    const [record] = (await generateAsync(errorPreset.sample, {
      seed: 9,
      count: 1,
    })) as Array<{
      error: { code: string; message: string; status: number };
    }>;
    expect(record.error).toEqual(
      expect.objectContaining({
        code: expect.any(String),
        message: expect.any(String),
        status: expect.any(Number),
      })
    );
  });

  it('jsonplaceholder real-API preset keeps user shape (email/name)', async () => {
    const jp = PLAYGROUND_PRESETS.find((p) => p.id === 'jsonplaceholder')!;
    expect(jp.realApi?.sourceUrl).toContain('jsonplaceholder');
    const { fields } = infer(jp.sample);
    const byPath = Object.fromEntries(fields.map((f) => [f.path, f]));
    expect(byPath['$.email']?.kind).toBe(FieldKind.Email);
    expect(byPath['$.phone']?.kind).toBe(FieldKind.Phone);
    const [record] = (await generateAsync(jp.sample, {
      seed: 42,
      count: 1,
      context: jp.context,
    })) as Array<{ email: string; name: string; address: { city: string } }>;
    expect(record.email).toContain('@');
    expect(typeof record.name).toBe('string');
    expect(typeof record.address.city).toBe('string');
  });

  it('loads into shareable editor state (input + context round-trip)', () => {
    const orders = PLAYGROUND_PRESETS.find((p) => p.id === 'orders')!;
    const encoded = encodeShareHash({
      input: presetSampleJson(orders),
      context: orders.context,
      count: 3,
      seed: 42,
      level: 'wild',
      overrides: {},
      checked: [],
    });
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    const decoded = decodeShareHash(encoded.hash);
    expect(decoded?.context).toBe(orders.context);
    expect(JSON.parse(decoded!.input)).toEqual(JSON.parse(presetSampleJson(orders)));
  });

  it('exposes the try demo command for the CTA', () => {
    expect(TRY_DEMO_COMMAND).toBe('npx -p @sgedda/mockifyer-core mockifyer try');
  });
});

describe('playground CLI command helpers', () => {
  it('emit the real mockifyer-generate bin invocations', () => {
    expect(buildSampleCliCommand({ seed: 42, count: 3, context: "swedish users, 5 items" })).toBe(
      "npx -p @sgedda/mockifyer-generator mockifyer-generate sample sample.json --seed 42 --count 3 --context 'swedish users, 5 items'"
    );
    expect(buildVariantsCliCommand({ seed: 42, level: 'wild' })).toBe(
      'npx -p @sgedda/mockifyer-generator mockifyer-generate variants sample.json --level wild --seed 42 --out ./mock-data'
    );
  });
});

describe('playground CLI / engine parity', () => {
  it('sample CLI stdout matches generateAsync for same input+seed', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-playground-parity-'));
    try {
      const samplePath = path.join(dir, 'sample.json');
      fs.writeFileSync(samplePath, `${JSON.stringify(SAMPLE, null, 2)}\n`, 'utf8');

      let stdout = '';
      const code = await runCli(
        ['sample', samplePath, '--seed', '42', '--count', '3', '--context', 'prices in USD'],
        {
          stdout: {
            write(chunk: string) {
              stdout += chunk;
            },
          },
          stderr: { write() { /* ignore */ } },
        }
      );
      expect(code).toBe(0);

      const fromCli = JSON.parse(stdout) as unknown[];
      const fromEngine = await generateAsync(SAMPLE, {
        seed: 42,
        count: 3,
        context: 'prices in USD',
      });
      expect(fromCli).toEqual(fromEngine);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('variants CLI dry-run matches engine variants for same seed+level', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-playground-var-'));
    try {
      const mockPath = path.join(dir, 'mock.json');
      fs.writeFileSync(mockPath, `${JSON.stringify(SAMPLE_MOCK, null, 2)}\n`, 'utf8');

      let stdout = '';
      const code = await runCli(
        ['variants', mockPath, '--level', 'wild', '--seed', '42', '--dry-run'],
        {
          stdout: {
            write(chunk: string) {
              stdout += chunk;
            },
          },
          stderr: { write() { /* ignore */ } },
        }
      );
      expect(code).toBe(0);

      const jsonStart = stdout.indexOf('[');
      expect(jsonStart).toBeGreaterThanOrEqual(0);
      const fromCli = JSON.parse(stdout.slice(jsonStart)) as unknown[];
      const fromEngine = variants(SAMPLE_MOCK, { seed: 42, chaosLevel: 'wild' });
      expect(fromCli).toEqual(fromEngine);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('playground mock file naming (browser mirror)', () => {
  it('matches the Node writer relative paths', () => {
    const named = variants(SAMPLE_MOCK, { seed: 11, chaosLevel: 'mild' });
    expect(named.length).toBeGreaterThan(0);
    for (const item of named) {
      const mock = { ...item.mock, generated: true as const };
      expect(browserGetMockRelativeFile(mock)).toBe(nodeGetMockRelativeFile(mock));
    }
  });

  it('zip entries use scenario/relative CLI layout', async () => {
    const named = variants(SAMPLE_MOCK, { seed: 3, chaosLevel: 'realistic' });
    const entries = await buildVariantZipEntries(named);
    expect(entries.length).toBe(named.length);
    for (let i = 0; i < named.length; i++) {
      const scenario = named[i]!.mock.scenario ?? `generated-${named[i]!.name}`;
      const relative = nodeGetMockRelativeFile({
        ...named[i]!.mock,
        generated: true,
      });
      expect(entries[i]!.path).toBe(`${scenario}/${relative}`);
      expect(entries[i]!.contents).toBe(serializeMock({ ...named[i]!.mock, generated: true }));
    }
  });
});
