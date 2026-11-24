/**
 * Playground helpers: shareable URL round-trip, determinism, CLI parity,
 * and browser mock-path naming vs the Node writer (SGE-76 / SGE-77).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  generateAsync,
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
} from '../mockifyer-web/frontend/src/lib/mock-data-generator/defaults';

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
