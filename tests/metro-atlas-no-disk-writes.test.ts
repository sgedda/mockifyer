import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  getNetworkBodySpillSnapshot,
  resetNetworkBodySpillRuntime,
} from '../packages/mockifyer-core/src/utils/network-body-spill';
import {
  bufferAtlasBodySpill,
  persistAtlasRenderBodySpills,
} from '../packages/mockifyer-fetch/src/metro-sync-middleware';
import {
  atlasHtmlBlockListPattern,
  configureMetroForMockifyer,
} from '../packages/mockifyer-fetch/src/metro-config';

describe('Metro Atlas body uploads stay in memory', () => {
  afterEach(() => {
    resetNetworkBodySpillRuntime();
  });

  it('buffers a device body without writing under the project', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-no-disk-'));
    try {
      const result = bufferAtlasBodySpill('bodies/req-1-res.json', '{"ok":true}');
      expect(result).toEqual({ success: true, relativePath: 'bodies/req-1-res.json' });
      expect(getNetworkBodySpillSnapshot()['bodies/req-1-res.json']).toBe('{"ok":true}');
      expect(fs.readdirSync(projectRoot)).toEqual([]);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('rejects paths outside bodies/<id>-req|res', () => {
    expect(bufferAtlasBodySpill('bodies/../x-res.json', '{}').success).toBe(false);
    expect(bufferAtlasBodySpill('bodies/x.json', '{}').success).toBe(false);
    expect(bufferAtlasBodySpill('bodies/x-res.json', '').success).toBe(false);
  });
});

describe('Metro ignores atlas-html writes', () => {
  const projectRoot = path.resolve('/tmp/app');

  it('matches files under mock-data/atlas-html only', () => {
    const pattern = atlasHtmlBlockListPattern(projectRoot, './mock-data');
    expect(pattern.test(path.join(projectRoot, 'mock-data/atlas-html/bodies/a-res.json'))).toBe(true);
    expect(pattern.test(path.join(projectRoot, 'mock-data/atlas-html/atlas.ndjson'))).toBe(true);
    expect(pattern.test(path.join(projectRoot, 'mock-data/default/mock.json'))).toBe(false);
    expect(pattern.test(path.join(projectRoot, 'src/atlas-html/index.ts'))).toBe(false);
  });

  it('appends to an existing blockList when sync middleware is configured', () => {
    const existing = /node_modules[\\/]ignored[\\/].*/;
    const config = configureMetroForMockifyer(
      { resolver: { blockList: existing } },
      { syncMiddleware: { projectRoot, mockDataPath: './mock-data' } }
    );
    const blockList = config.resolver?.blockList as RegExp[];
    expect(blockList).toHaveLength(2);
    expect(blockList[0]).toBe(existing);
    expect(blockList[1].test(path.join(projectRoot, 'mock-data/atlas-html/index.html'))).toBe(true);
  });

  it('leaves blockList alone without sync middleware', () => {
    const config = configureMetroForMockifyer({ resolver: {} });
    expect(config.resolver?.blockList).toBeUndefined();
  });
});

describe('Atlas render persists Metro-buffered spills', () => {
  afterEach(() => {
    resetNetworkBodySpillRuntime();
  });

  it('writes buffered bodies that the 2MB render payload omitted', () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-render-spills-'));
    try {
      const omitted = bufferAtlasBodySpill('bodies/big-1-res.json', 'x'.repeat(2_000_000));
      expect(omitted.success).toBe(true);
      const kept = bufferAtlasBodySpill('bodies/small-2-res.json', '{"ok":true}');
      expect(kept.success).toBe(true);

      // Render POST cap is 2MB including the key, so a max-size body is dropped
      // and nothing after it is sent. Metro already holds both from the spill POSTs.
      const written = persistAtlasRenderBodySpills(outDir, {
        'bodies/small-2-res.json': '{"ok":true}',
      });

      expect(written).toBeGreaterThanOrEqual(2);
      expect(fs.readFileSync(path.join(outDir, 'bodies/big-1-res.json'), 'utf8')).toBe(
        'x'.repeat(2_000_000)
      );
      expect(fs.readFileSync(path.join(outDir, 'bodies/small-2-res.json'), 'utf8')).toBe(
        '{"ok":true}'
      );
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('keeps the oldest buffered body when the payload would evict it', () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-render-evict-'));
    try {
      // Matches MAX_BUFFER_ENTRIES in network-body-spill.ts.
      const oldest = 'bodies/hop-0-res.json';
      bufferAtlasBodySpill(oldest, '{"i":0}');
      for (let i = 1; i < 200; i++) {
        bufferAtlasBodySpill(`bodies/hop-${i}-res.json`, `{"i":${i}}`);
      }
      const extra = 'bodies/hop-extra-res.json';
      const written = persistAtlasRenderBodySpills(outDir, {
        [extra]: '{"extra":true}',
      });

      expect(written).toBeGreaterThanOrEqual(201);
      expect(fs.readFileSync(path.join(outDir, oldest), 'utf8')).toBe('{"i":0}');
      expect(fs.readFileSync(path.join(outDir, extra), 'utf8')).toBe('{"extra":true}');
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  });
});
