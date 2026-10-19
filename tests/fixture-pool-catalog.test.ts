import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  ensurePoolLayout,
  POOL_FORMAT_VERSION,
  savePoolIndex,
  type FixturePoolFsAdapter,
  type FixturePoolWriteFileOptions,
} from '@sgedda/mockifyer-core';
import { loadFixturePoolCatalog } from '../packages/mockifyer-dashboard/src/utils/fixture-pool-catalog';
import { attachDashboardContext, getDashboardContext } from '../packages/mockifyer-dashboard/src/utils/dashboard-context';

function nodePoolFs(): FixturePoolFsAdapter {
  return {
    joinPath: (...parts) => path.join(...parts),
    existsSync: (p) => fs.existsSync(p),
    readFileSync: (p, encoding) => fs.readFileSync(p, encoding),
    writeFileSync: (p, data, encodingOrOptions: 'utf8' | FixturePoolWriteFileOptions) => {
      fs.writeFileSync(p, data, encodingOrOptions);
    },
    mkdirSync: (p, options) => {
      fs.mkdirSync(p, options);
    },
    unlinkSync: (p) => fs.unlinkSync(p),
    readdirSync: (p) => fs.readdirSync(p),
  };
}

describe('loadFixturePoolCatalog', () => {
  let root: string;
  const adapter = nodePoolFs();

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'pool-catalog-'));
  });

  afterEach(() => {
    try {
      fs.chmodSync(root, 0o700);
    } catch {
      // ignore
    }
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('returns an empty catalog without creating pool/ (GET must not write)', () => {
    const { index, warning } = loadFixturePoolCatalog(root, adapter);
    expect(warning).toBeUndefined();
    expect(index.entities).toEqual([]);
    expect(index.responses).toEqual([]);
    expect(fs.existsSync(path.join(root, 'pool'))).toBe(false);
  });

  it('returns empty + warning when pool-index.json is not a valid catalog', () => {
    fs.mkdirSync(path.join(root, 'pool'), { recursive: true });
    fs.writeFileSync(path.join(root, 'pool', 'pool-index.json'), '{not json', 'utf8');
    const { index, warning } = loadFixturePoolCatalog(root, adapter);
    expect(index.entities).toEqual([]);
    expect(warning).toMatch(/pool index/i);
  });

  it('lists entities from a valid index', () => {
    savePoolIndex(
      root,
      {
        formatVersion: POOL_FORMAT_VERSION,
        updatedAt: '2026-09-08T00:00:00.000Z',
        entities: [
          {
            id: 'trip-rome',
            label: 'Rome',
            entityType: 'trip',
            storageRef: 'pool/entities/trip-rome.json',
            createdAt: '2026-09-08T00:00:00.000Z',
            updatedAt: '2026-09-08T00:00:00.000Z',
          },
        ],
        responses: [],
      },
      adapter
    );
    const { index, warning } = loadFixturePoolCatalog(root, adapter);
    expect(warning).toBeUndefined();
    expect(index.entities.map((e) => e.id)).toEqual(['trip-rome']);
  });

  it('does not throw when mock-data is not writable', () => {
    fs.chmodSync(root, 0o555);
    const { index, warning } = loadFixturePoolCatalog(root, adapter);
    expect(warning).toBeUndefined();
    expect(index.entities).toEqual([]);
  });

  it('ensurePoolLayout throws on a read-only mock-data path', () => {
    if (typeof process.getuid === 'function' && process.getuid() === 0) {
      return;
    }
    fs.chmodSync(root, 0o555);
    expect(() => ensurePoolLayout(root, adapter)).toThrow();
  });
});

describe('getDashboardContext', () => {
  it('prefers request-bound context over parent app.locals (embedded /mockifyer mount)', () => {
    const req = {
      app: { locals: { mockDataPath: '/host-cwd' } },
    } as unknown as Parameters<typeof getDashboardContext>[0];
    expect(getDashboardContext(req).mockDataPath).toBe('/host-cwd');
    attachDashboardContext(req, {
      mockDataPath: '/app/mock-data',
      config: { provider: 'filesystem', mockDataPath: '/app/mock-data' },
    });
    expect(getDashboardContext(req).mockDataPath).toBe('/app/mock-data');
  });
});
