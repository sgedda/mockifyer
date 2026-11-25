import * as fs from 'fs';
import * as path from 'path';
import {
  FieldKind,
  createMulberry32,
  createSeededFaker,
  generate,
  infer,
  inferFieldKind,
} from '@sgedda/mockifyer-generator';

const GENERATOR_SRC = path.resolve(
  __dirname,
  '../packages/mockifyer-generator/src'
);

describe('generator engine — field-kind inference', () => {
  const cases: Array<{ key: string; value: unknown; kind: FieldKind }> = [
    { key: 'email', value: 'a@b.com', kind: FieldKind.Email },
    { key: 'userEmail', value: 'x@y.z', kind: FieldKind.Email },
    { key: 'firstName', value: 'Ada', kind: FieldKind.FirstName },
    { key: 'last_name', value: 'Lovelace', kind: FieldKind.LastName },
    { key: 'fullName', value: 'Ada Lovelace', kind: FieldKind.FullName },
    { key: 'customerName', value: 'Ada Lovelace', kind: FieldKind.FullName },
    {
      key: 'id',
      value: '550e8400-e29b-41d4-a716-446655440000',
      kind: FieldKind.Uuid,
    },
    { key: 'uuid', value: '550e8400-e29b-41d4-a716-446655440000', kind: FieldKind.Uuid },
    { key: 'orderId', value: 42, kind: FieldKind.IntegerId },
    { key: 'id', value: 7, kind: FieldKind.IntegerId },
    { key: 'price', value: 19.99, kind: FieldKind.Money },
    { key: 'amount', value: 100, kind: FieldKind.Money },
    { key: 'currency', value: 'USD', kind: FieldKind.Currency },
    { key: 'birthDate', value: '1990-05-01', kind: FieldKind.Date },
    { key: 'createdAt', value: '2024-01-02T03:04:05.000Z', kind: FieldKind.IsoTimestamp },
    { key: 'status', value: 'shipped', kind: FieldKind.Enum },
    { key: 'type', value: 'premium', kind: FieldKind.Enum },
    { key: 'website', value: 'https://example.com/x', kind: FieldKind.Url },
    { key: 'phone', value: '+14155552671', kind: FieldKind.Phone },
    { key: 'street', value: '1 Main St', kind: FieldKind.Street },
    { key: 'city', value: 'Austin', kind: FieldKind.City },
    { key: 'zipCode', value: '78701', kind: FieldKind.Zip },
    { key: 'country', value: 'US', kind: FieldKind.Country },
    { key: 'active', value: true, kind: FieldKind.Boolean },
    { key: 'notes', value: 'a fairly long free-form note about the order', kind: FieldKind.FreeText },
  ];

  it.each(cases)('infers $kind for key=$key', ({ key, value, kind }) => {
    expect(inferFieldKind(key, [value]).kind).toBe(kind);
  });

  it('handles tricky names without over-matching', () => {
    expect(inferFieldKind('format', ['json']).kind).not.toBe(FieldKind.IsoTimestamp);
    expect(inferFieldKind('username', ['ada_l']).kind).toBe(FieldKind.FullName);
    expect(inferFieldKind('email_verified', [true]).kind).toBe(FieldKind.Boolean);
  });

  it('does not treat ZIP+4 or decimal coordinates as phones', () => {
    expect(inferFieldKind('zipcode', ['92998-3874']).kind).toBe(FieldKind.Zip);
    expect(inferFieldKind('lat', ['-37.3159'], '$.address.geo.lat').kind).toBe(
      FieldKind.Latitude
    );
    expect(inferFieldKind('lng', ['81.1496'], '$.address.geo.lng').kind).toBe(
      FieldKind.Longitude
    );
    expect(inferFieldKind('phone', ['1-770-736-8031 x56442']).kind).toBe(FieldKind.Phone);
  });

  it('returns path descriptors with confidence for a nested sample', () => {
    const sample = {
      user: {
        email: 'a@b.com',
        profile: { firstName: 'Ada', lastName: 'Lovelace' },
      },
      orders: [{ status: 'shipped', total: 12.5 }],
    };
    const { fields } = infer(sample);
    const byPath = Object.fromEntries(fields.map((f) => [f.path, f]));
    expect(byPath['$.user.email']?.kind).toBe(FieldKind.Email);
    expect(byPath['$.user.profile.firstName']?.kind).toBe(FieldKind.FirstName);
    expect(byPath['$.orders[*].status']?.kind).toBe(FieldKind.Enum);
    expect(byPath['$.orders[*].total']?.kind).toBe(FieldKind.Money);
    expect(byPath['$.user.email']!.confidence).toBeGreaterThan(0.7);
  });
});

describe('generator engine — overrides', () => {
  it('lets path overrides take precedence over inference', () => {
    const sample = { status: 'shipped', weird: 'not-an-email' };
    const { fields } = infer(sample, {
      '$.weird': FieldKind.Email,
      status: FieldKind.FreeText,
    });
    const byPath = Object.fromEntries(fields.map((f) => [f.path, f]));
    expect(byPath['$.weird']?.kind).toBe(FieldKind.Email);
    expect(byPath['$.weird']?.confidence).toBe(1);
    expect(byPath['$.status']?.kind).toBe(FieldKind.FreeText);
    expect(byPath['$.status']?.confidence).toBe(1);
  });
});

describe('generator engine — determinism', () => {
  const sample = {
    id: 1,
    email: 'a@b.com',
    status: 'shipped',
    total: 19.99,
    tags: ['a', 'b'],
    address: { city: 'Austin', zip: '78701' },
  };

  it('same seed produces byte-identical output', () => {
    const a = generate(sample, { count: 3, seed: 42 });
    const b = generate(sample, { count: 3, seed: 42 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('fixed-seed snapshot of generated records', () => {
    const records = generate(sample, { count: 2, seed: 7 });
    expect(records).toMatchInlineSnapshot(`
[
  {
    "address": {
      "city": "Haleystead",
      "zip": "73888",
    },
    "email": "Rick15@gmail.com",
    "id": 1,
    "status": "shipped",
    "tags": [
      "b",
      "b",
      "a",
    ],
    "total": 27.77,
  },
  {
    "address": {
      "city": "East Britney",
      "zip": "45166",
    },
    "email": "Kobe_Lockman@gmail.com",
    "id": 1,
    "status": "shipped",
    "tags": [
      "b",
      "a",
    ],
    "total": 24.59,
  },
]
`);
  });

  it('different seeds differ', () => {
    const a = JSON.stringify(generate(sample, { count: 2, seed: 1 }));
    const b = JSON.stringify(generate(sample, { count: 2, seed: 2 }));
    expect(a).not.toBe(b);
  });

  it('string seeds are stable', () => {
    const a = generate(sample, { count: 1, seed: 'demo' });
    const b = generate(sample, { count: 1, seed: 'demo' });
    expect(a).toEqual(b);
  });
});

describe('generator engine — shape preservation', () => {
  it('preserves nested object keys and types', () => {
    const sample = {
      meta: { ok: true, count: 2 },
      items: [
        { sku: 'A1', qty: 1, price: 9.5 },
        { sku: 'B2', qty: 3, price: 4.25 },
      ],
    };
    const [record] = generate(sample, { count: 1, seed: 99 }) as Array<
      typeof sample
    >;
    expect(record).toEqual(
      expect.objectContaining({
        meta: expect.objectContaining({
          ok: expect.any(Boolean),
          count: expect.any(Number),
        }),
      })
    );
    expect(Array.isArray(record.items)).toBe(true);
    expect(record.items.length).toBeGreaterThanOrEqual(1);
    for (const item of record.items) {
      expect(typeof item.sku).toBe('string');
      expect(typeof item.qty).toBe('number');
      expect(typeof item.price).toBe('number');
    }
  });

  it('varies array lengths around the sample length', () => {
    const sample = { ids: [1, 2, 3, 4] };
    const lengths = new Set<number>();
    for (let seed = 0; seed < 40; seed++) {
      const [record] = generate(sample, { count: 1, seed }) as Array<{
        ids: number[];
      }>;
      lengths.add(record.ids.length);
      expect(record.ids.length).toBeGreaterThanOrEqual(1);
      expect(record.ids.length).toBeLessThanOrEqual(6);
    }
    expect(lengths.size).toBeGreaterThan(1);
  });

  it('never emits empty nested arrays in normal generate (emptyLists is variants-only)', () => {
    const sample = {
      users: [
        {
          id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
          email: 'ada@example.com',
          country: 'SE',
        },
      ],
    };
    for (let seed = 0; seed < 80; seed++) {
      const [record] = generate(sample, { count: 1, seed }) as Array<{
        users: unknown[];
      }>;
      expect(record.users.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('generator engine — array-of-records inference', () => {
  it('merges kinds and collects enum values across items', () => {
    const sample = [
      { status: 'shipped', email: 'a@b.com' },
      { status: 'pending', email: 'c@d.com' },
      { status: 'shipped', email: 'e@f.com' },
    ];
    const { fields, rootIsArray } = infer(sample);
    expect(rootIsArray).toBe(true);
    const status = fields.find((f) => f.path === '$[*].status');
    expect(status?.kind).toBe(FieldKind.Enum);
    expect(status?.enumValues?.sort()).toEqual(['pending', 'shipped']);
    const email = fields.find((f) => f.path === '$[*].email');
    expect(email?.kind).toBe(FieldKind.Email);

    const records = generate(sample, { count: 4, seed: 3 });
    expect(records).toHaveLength(4);
    for (const r of records as Array<{ status: string; email: string }>) {
      expect(['pending', 'shipped']).toContain(r.status);
      expect(r.email).toContain('@');
    }
  });
});

describe('generator engine — PRNG / faker helpers', () => {
  it('mulberry32 is deterministic and faker uuid is shaped', () => {
    const a = createMulberry32(123);
    const b = createMulberry32(123);
    expect([a.next(), a.next(), a.int(1, 10)]).toEqual([
      b.next(),
      b.next(),
      b.int(1, 10),
    ]);
    const faker = createSeededFaker(5);
    const uuid = faker.string.uuid();
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(createSeededFaker(5).internet.email()).toBe(
      createSeededFaker(5).internet.email()
    );
  });
});

describe('generator engine — browser-safe / no Node globals', () => {
  it('browser entry source files do not import Node-only modules', () => {
    // `src/node/**` and `src/cli/**` are Node-only entries — excluded from this check.
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node' || entry.name === 'cli') continue;
          walk(full);
        } else if (entry.name.endsWith('.ts')) {
          files.push(full);
        }
      }
    };
    walk(GENERATOR_SRC);
    expect(files.length).toBeGreaterThan(0);

    const forbiddenImport =
      /\bfrom\s+['"](?:node:)?(?:fs|path|crypto|buffer|os|child_process|net|http|https|stream|util)['"]|\brequire\(\s*['"](?:node:)?(?:fs|path|crypto|buffer)/;
    const forbiddenApi = /\b(?:Buffer\.|new Buffer\b|process\.env\b)/;

    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      expect(src).not.toMatch(forbiddenImport);
      expect(src).not.toMatch(forbiddenApi);
    }
  });

  it('generate runs without touching Node fs/path/crypto', () => {
    const sample = { email: 'a@b.com', id: 1 };
    const out = generate(sample, { count: 2, seed: 11 });
    expect(out).toHaveLength(2);
    expect(typeof (out[0] as { email: string }).email).toBe('string');
  });

  it('esbuild-bundles for browser without Node builtins (en main + lazy locale chunks)', () => {
    const esbuild = require('esbuild') as typeof import('esbuild');
    const { gzipSync } = require('zlib') as typeof import('zlib');
    const os = require('os') as typeof import('os');
    const outdir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-generator-bundle-'));

    try {
      const result = esbuild.buildSync({
        entryPoints: [path.join(GENERATOR_SRC, 'index.ts')],
        bundle: true,
        write: true,
        splitting: true,
        outdir,
        platform: 'browser',
        format: 'esm',
        target: ['es2020'],
        minify: true,
        logLevel: 'silent',
      });
      expect(result.errors).toHaveLength(0);

      const jsFiles = fs.readdirSync(outdir).filter((f) => f.endsWith('.js'));
      expect(jsFiles.length).toBeGreaterThan(1);

      let mainMin = 0;
      let mainGz = 0;
      const localeGz: Record<string, number> = {};

      for (const file of jsFiles) {
        const code = fs.readFileSync(path.join(outdir, file), 'utf8');
        expect(code).not.toMatch(/require\(['"](?:fs|path|crypto|buffer)['"]\)/);
        expect(code).not.toMatch(/from\s+['"]node:/);

        const gz = gzipSync(Buffer.from(code, 'utf8')).length;
        const base = file.replace(/\.js$/, '');
        // Entry is index.js; shared en runtime is a chunk-*.js; lazy locales are sv-/de-/fr-/es-*.js
        if (base === 'index' || base.startsWith('index-')) {
          mainMin += code.length;
          mainGz += gz;
        } else if (/^(sv|de|fr|es)(-|$)/.test(base)) {
          const loc = base.slice(0, 2);
          localeGz[loc] = (localeGz[loc] ?? 0) + gz;
        } else if (base.startsWith('chunk-')) {
          // Shared en + Faker runtime — count toward main (en) entry cost
          mainMin += code.length;
          mainGz += gz;
        }
      }

      expect(mainGz).toBeGreaterThan(10_000);
      // Lazy locale chunks should exist and be smaller than the en main+shared payload
      expect(Object.keys(localeGz).sort()).toEqual(['de', 'es', 'fr', 'sv']);
      for (const [loc, gz] of Object.entries(localeGz)) {
        expect(gz).toBeGreaterThan(100);
        expect(gz).toBeLessThan(mainGz);
        // eslint-disable-next-line no-console
        console.log(`[generator bundle] locale=${loc} gzipped=${gz}B`);
      }
      // eslint-disable-next-line no-console
      console.log(
        `[generator bundle] main(en) minified=${mainMin}B gzipped=${mainGz}B`
      );
    } finally {
      fs.rmSync(outdir, { recursive: true, force: true });
    }
  });
});

describe('generator package — core isolation', () => {
  it('core package.json has no generator export and no faker dependency', () => {
    const corePkg = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, '../packages/mockifyer-core/package.json'),
        'utf8'
      )
    );
    expect(corePkg.exports?.['./generator']).toBeUndefined();
    expect(corePkg.dependencies?.['@faker-js/faker']).toBeUndefined();
    expect(corePkg.devDependencies?.['@faker-js/faker']).toBeUndefined();
    expect(
      fs.existsSync(
        path.resolve(__dirname, '../packages/mockifyer-core/src/generator')
      )
    ).toBe(false);
  });
});
