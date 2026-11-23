import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  ALL_VARIANT_KINDS,
  collectSensitiveLiterals,
  findSecretLeaks,
  isIdentifierKeyName,
  resolveChaosLevel,
  resolveScrambleIds,
  selectVariantKinds,
  serializeMock,
  toScenarioMap,
  variants,
  type NamedVariant,
  type VariantKind,
} from '@sgedda/mockifyer-generator';
import { writeVariantScenarios } from '@sgedda/mockifyer-generator/node';

const SAMPLE_BODY = {
  id: 1,
  email: 'secret.user@corp-example.com',
  title: 'Ship order',
  description: 'optional notes',
  items: [
    { id: 10, name: 'Widget', qty: 2 },
    { id: 11, name: 'Gadget', qty: 1 },
  ],
  tags: ['a', 'b'],
  nickname: 'ace',
  meta: { note: 'x' },
};

const SAMPLE_MOCK = {
  request: {
    method: 'GET',
    url: 'https://api.example.com/orders/1?apikey=SUPER_SECRET_KEY_VALUE_12345',
    headers: {
      Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.leak.payload',
      'Content-Type': 'application/json',
      'X-Api-Key': 'raw-api-key-should-not-leak-abcdefghij',
    },
  },
  response: {
    status: 200,
    data: SAMPLE_BODY,
    headers: {
      'content-type': 'application/json',
      'set-cookie': 'session=abc123; Path=/',
    },
  },
  timestamp: '2026-01-15T12:00:00.000Z',
  duration: 42,
};

const STREAM_MOCK = {
  request: {
    method: 'GET',
    url: 'https://api.example.com/sse',
    headers: {},
  },
  response: {
    status: 200,
    data: 'event: a\ndata: 1\n\nevent: b\ndata: 2\n\nevent: c\ndata: 3\n\n',
    headers: { 'content-type': 'text/event-stream' },
    stream: {
      kind: 'sse' as const,
      chunks: [
        { offsetMs: 0, data: 'event: a\ndata: 1\n\n' },
        { offsetMs: 50, data: 'event: b\ndata: 2\n\n' },
        { offsetMs: 100, data: 'event: c\ndata: 3\n\n' },
      ],
      firstChunkDelayMs: 5,
    },
  },
  timestamp: '2026-01-15T12:00:00.000Z',
};

function byKind(named: NamedVariant[]): Record<string, NamedVariant> {
  return Object.fromEntries(named.map((v) => [v.kind, v]));
}

describe('generator variants — chaos level', () => {
  it('resolves named levels and clamps numeric', () => {
    expect(resolveChaosLevel('realistic')).toBeCloseTo(0.1);
    expect(resolveChaosLevel('mild')).toBeCloseTo(0.35);
    expect(resolveChaosLevel('wild')).toBeCloseTo(0.7);
    expect(resolveChaosLevel('nightmare')).toBe(1);
    expect(resolveChaosLevel(0.5)).toBe(0.5);
    expect(resolveChaosLevel(-1)).toBe(0);
    expect(resolveChaosLevel(2)).toBe(1);
    expect(resolveChaosLevel(undefined)).toBeCloseTo(0.35);
  });

  it('selects kinds by intensity thresholds', () => {
    expect(selectVariantKinds('realistic')).toEqual(['emptyLists']);
    expect(selectVariantKinds('mild')).toEqual(
      expect.arrayContaining(['emptyLists', 'missingOptional', 'nulls'])
    );
    expect(selectVariantKinds('mild')).not.toContain('http500');
    expect(selectVariantKinds('nightmare').sort()).toEqual([...ALL_VARIANT_KINDS].sort());
  });

  it('same seed + chaosLevel is deterministic', () => {
    const a = variants(SAMPLE_MOCK, { seed: 42, chaosLevel: 'wild' });
    const b = variants(SAMPLE_MOCK, { seed: 42, chaosLevel: 'wild' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('higher chaos includes more kinds', () => {
    const mild = variants(SAMPLE_MOCK, { seed: 1, chaosLevel: 'mild' });
    const wild = variants(SAMPLE_MOCK, { seed: 1, chaosLevel: 'wild' });
    const nightmare = variants(SAMPLE_MOCK, { seed: 1, chaosLevel: 'nightmare' });
    expect(mild.length).toBeLessThan(wild.length);
    expect(wild.length).toBeLessThanOrEqual(nightmare.length);
  });

  it('kinds allowlist intersects chaos selection', () => {
    const out = variants(SAMPLE_MOCK, {
      seed: 3,
      chaosLevel: 'nightmare',
      kinds: ['emptyLists', 'http404'],
    });
    expect(out.map((v) => v.kind).sort()).toEqual(['emptyLists', 'http404']);
  });
});

describe('generator variants — each kind', () => {
  const all = variants(SAMPLE_MOCK, {
    seed: 99,
    chaosLevel: 'nightmare',
    kinds: ALL_VARIANT_KINDS.filter((k) => k !== 'truncatedStream') as VariantKind[],
  });
  const map = byKind(all);

  it('emptyLists clears arrays', () => {
    const data = map.emptyLists!.mock.response.data as typeof SAMPLE_BODY;
    expect(data.items).toEqual([]);
    expect(data.tags).toEqual([]);
    expect(data.id).toBe(1);
  });

  it('missingOptional drops optional-ish fields', () => {
    const data = map.missingOptional!.mock.response.data as Record<string, unknown>;
    expect(data.description).toBeUndefined();
    expect(data.nickname).toBeUndefined();
    // At nightmare, ids may be dropped (scrambleIds); preservation is covered below at wild.
  });

  it('nulls sets some fields to null', () => {
    const json = JSON.stringify(map.nulls!.mock.response.data);
    expect(json).toContain('null');
  });

  it('longStrings produces very long string leaves', () => {
    const data = map.longStrings!.mock.response.data as { title: string };
    expect(typeof data.title).toBe('string');
    expect(data.title.length).toBeGreaterThan(4_000);
    expect(data.title.startsWith('LONG:')).toBe(true);
  });

  it('unicode injects non-ascii / emoji', () => {
    const data = map.unicode!.mock.response.data as { title: string };
    expect(/[^\u0000-\u007f]/.test(data.title)).toBe(true);
  });

  it.each([
    ['http400', 400],
    ['http401', 401],
    ['http404', 404],
    ['http500', 500],
  ] as const)('%s sets status %i and error body', (kind, status) => {
    const mock = map[kind]!.mock;
    expect(mock.response.status).toBe(status);
    expect(mock.statusOverride).toBe(status);
    const body = mock.response.data as { error: string; message: string };
    expect(typeof body.error).toBe('string');
    expect(typeof body.message).toBe('string');
  });

  it('slow sets responseDelayMs', () => {
    const delay = map.slow!.mock.responseDelayMs;
    expect(typeof delay).toBe('number');
    expect(delay!).toBeGreaterThanOrEqual(1_000);
    expect(delay!).toBeLessThanOrEqual(30_000);
  });

  it('truncatedStream truncates stream mocks', () => {
    const out = variants(STREAM_MOCK, {
      seed: 5,
      chaosLevel: 'nightmare',
      kinds: ['truncatedStream'],
    });
    expect(out).toHaveLength(1);
    const stream = out[0]!.mock.response.stream;
    expect(stream?.truncated).toBe(true);
    expect(stream!.chunks.length).toBeGreaterThan(0);
    expect(stream!.chunks.length).toBeLessThan(STREAM_MOCK.response.stream.chunks.length);
    expect(out[0]!.mock.response.data).toBe(stream!.chunks.map((c) => c.data).join(''));
  });

  it('omits truncatedStream when sample has no stream', () => {
    const out = variants(SAMPLE_MOCK, {
      seed: 5,
      chaosLevel: 'nightmare',
      kinds: ['truncatedStream'],
    });
    expect(out).toHaveLength(0);
  });
});

describe('generator variants — preserve identifier fields', () => {
  const tripsSample = {
    request: {
      method: 'GET',
      url: 'http://localhost:4100/api/trips',
      headers: {},
    },
    response: {
      status: 200,
      data: {
        trips: [
          {
            id: 'TRP-001',
            orderId: 'ORD-9',
            user_id: 'u-1',
            slug: 'paris-weekend',
            destination: 'Paris',
            duration: 5,
          },
          {
            id: 'TRP-002',
            orderId: 'ORD-10',
            user_id: 'u-2',
            slug: 'tokyo-sprint',
            destination: 'Tokyo',
            duration: 10,
          },
        ],
        timestamp: '2026-11-10T12:00:00Z',
      },
      headers: { 'content-type': 'application/json' },
    },
    timestamp: '2026-11-10T12:00:00Z',
  };

  it('recognizes id / *Id / *_id / uuid / slug key names', () => {
    expect(isIdentifierKeyName('id')).toBe(true);
    expect(isIdentifierKeyName('orderId')).toBe(true);
    expect(isIdentifierKeyName('user_id')).toBe(true);
    expect(isIdentifierKeyName('uuid')).toBe(true);
    expect(isIdentifierKeyName('slug')).toBe(true);
    expect(isIdentifierKeyName('destination')).toBe(false);
  });

  it('resolveScrambleIds is false below nightmare unless scrambleIds: true', () => {
    expect(resolveScrambleIds({ chaosLevel: 'wild' })).toBe(false);
    expect(resolveScrambleIds({ chaosLevel: 'nightmare' })).toBe(true);
    expect(resolveScrambleIds({ chaosLevel: 'mild', scrambleIds: true })).toBe(true);
    expect(resolveScrambleIds({ chaosLevel: 'nightmare', scrambleIds: false })).toBe(false);
  });

  it('keeps trip ids stable in longStrings and unicode at wild', () => {
    const out = variants(tripsSample, {
      seed: 42,
      chaosLevel: 'wild',
      kinds: ['longStrings', 'unicode', 'nulls', 'missingOptional'],
    });
    const map = byKind(out);

    for (const kind of ['longStrings', 'unicode', 'nulls', 'missingOptional'] as const) {
      const data = map[kind]!.mock.response.data as {
        trips: Array<Record<string, unknown>>;
      };
      expect(data.trips.map((t) => t.id)).toEqual(['TRP-001', 'TRP-002']);
      expect(data.trips.map((t) => t.orderId)).toEqual(['ORD-9', 'ORD-10']);
      expect(data.trips.map((t) => t.user_id)).toEqual(['u-1', 'u-2']);
      expect(data.trips.map((t) => t.slug)).toEqual(['paris-weekend', 'tokyo-sprint']);
    }

    const longDest = (map.longStrings!.mock.response.data as { trips: Array<{ destination: string }> })
      .trips[0]!.destination;
    expect(longDest.startsWith('LONG:')).toBe(true);
    expect(longDest.length).toBeGreaterThan(4_000);

    const uniDest = (map.unicode!.mock.response.data as { trips: Array<{ destination: string }> })
      .trips[0]!.destination;
    expect(/[^\u0000-\u007f]/.test(uniDest)).toBe(true);
  });

  it('may scramble ids at nightmare (or scrambleIds: true)', () => {
    const atNightmare = variants(tripsSample, {
      seed: 42,
      chaosLevel: 'nightmare',
      kinds: ['longStrings'],
    });
    const long = atNightmare[0]!.mock.response.data as {
      trips: Array<{ id: string; destination: string }>;
    };
    expect(long.trips[0]!.id).not.toBe('TRP-001');
    expect(long.trips[0]!.id.startsWith('LONG:')).toBe(true);

    const forced = variants(tripsSample, {
      seed: 42,
      chaosLevel: 'wild',
      scrambleIds: true,
      kinds: ['unicode'],
    });
    const uni = forced[0]!.mock.response.data as {
      trips: Array<{ id: string }>;
    };
    expect(uni.trips[0]!.id).not.toBe('TRP-001');
  });

  it('scrambleIds: false keeps ids even at nightmare', () => {
    const out = variants(tripsSample, {
      seed: 42,
      chaosLevel: 'nightmare',
      scrambleIds: false,
      kinds: ['longStrings', 'unicode'],
    });
    for (const v of out) {
      const data = v.mock.response.data as { trips: Array<{ id: string }> };
      expect(data.trips.map((t) => t.id)).toEqual(['TRP-001', 'TRP-002']);
    }
  });
});

describe('generator variants — generated flag + mock format', () => {
  it('marks every mock generated: true', () => {
    const out = variants(SAMPLE_MOCK, { seed: 2, chaosLevel: 'wild' });
    expect(out.length).toBeGreaterThan(0);
    for (const v of out) {
      expect(v.mock.generated).toBe(true);
      expect(v.mock.request.method).toBe('GET');
      expect(v.mock.request.url).toContain('api.example.com');
      expect(typeof v.mock.response.status).toBe('number');
      expect(v.mock.response.headers).toEqual(expect.any(Object));
      expect(typeof v.mock.timestamp).toBe('string');
    }
  });

  it('wraps bare JSON samples into mock documents', () => {
    const out = variants({ items: [1, 2] }, { seed: 1, chaosLevel: 'realistic' });
    expect(out[0]!.mock.generated).toBe(true);
    expect(out[0]!.mock.request.url).toContain('example.invalid');
    expect(out[0]!.mock.response.status).toBe(200);
  });

  it('serializeMock / toScenarioMap produce scenario-keyed docs', () => {
    const out = variants(SAMPLE_BODY, {
      seed: 8,
      chaosLevel: 'realistic',
      scenario: 'demo',
    });
    const text = serializeMock(out[0]!.mock);
    expect(text).toContain('"generated": true');
    const map = toScenarioMap(out, 'demo');
    expect(Object.keys(map)).toEqual(['demo-empty-lists']);
    expect(map['demo-empty-lists']!.generated).toBe(true);
    expect(map['demo-empty-lists']!.scenario).toBe('demo-empty-lists');
  });
});

describe('generator variants — secret scrub / no leak', () => {
  it('never echoes sample secrets, tokens, or emails', () => {
    const forbidden = collectSensitiveLiterals(SAMPLE_MOCK);
    expect(forbidden.has('secret.user@corp-example.com')).toBe(true);
    expect(
      [...forbidden].some((s) => s.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'))
    ).toBe(true);

    const out = variants(SAMPLE_MOCK, { seed: 11, chaosLevel: 'nightmare' });
    expect(out.length).toBeGreaterThan(0);

    for (const v of out) {
      const leaks = findSecretLeaks(v.mock, forbidden);
      expect(leaks).toEqual([]);
      const json = JSON.stringify(v.mock);
      expect(json).not.toContain('secret.user@corp-example.com');
      expect(json).not.toContain('SUPER_SECRET_KEY_VALUE_12345');
      expect(json).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.leak.payload');
      expect(json).not.toContain('raw-api-key-should-not-leak-abcdefghij');
      expect(json).not.toContain('session=abc123');
    }
  });

  it('redacts Authorization header scheme form', () => {
    const out = variants(SAMPLE_MOCK, {
      seed: 1,
      chaosLevel: 'realistic',
    });
    const auth = out[0]!.mock.request.headers.Authorization
      ?? out[0]!.mock.request.headers.authorization;
    expect(String(auth)).toMatch(/Bearer\s+<redacted>/i);
  });
});

describe('generator variants — node write', () => {
  it('writeVariantScenarios writes JSON under mock-data scenarios', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-gen-variants-'));
    try {
      const named = variants(SAMPLE_MOCK, {
        seed: 4,
        chaosLevel: 'mild',
        scenario: 'edge',
      });
      const written = writeVariantScenarios(named, { mockDataPath: dir });
      expect(written.length).toBe(named.length);
      for (const w of written) {
        expect(fs.existsSync(w.filePath)).toBe(true);
        expect(w.relativeFile.replace(/\\/g, '/')).toMatch(
          /^api\.example\.com\/orders\/1\/GET_/
        );
        expect(w.relativeFile).not.toMatch(/^generated\//);
        const parsed = JSON.parse(fs.readFileSync(w.filePath, 'utf8'));
        expect(parsed.generated).toBe(true);
        expect(parsed.scenario).toBe(w.scenario);
        expect(parsed.request).toBeDefined();
        expect(parsed.response).toBeDefined();
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
