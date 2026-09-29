import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  getNetworkBodySpillSnapshot,
  resetNetworkBodySpillRuntime,
} from '../packages/mockifyer-core/src/utils/network-body-spill';
import { bufferAtlasBodySpill } from '../packages/mockifyer-fetch/src/metro-sync-middleware';
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
