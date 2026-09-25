import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  getAtlasGeneratedHopBody,
  getAtlasGeneratedStatus,
  listAtlasGeneratedHops,
  resolveAtlasHtmlRelativePath,
  searchAtlasGeneratedBodies,
  summarizeAtlasDoc,
} from '../packages/mockifyer-dashboard/src/utils/atlas-generated';

describe('atlas-generated (dashboard)', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-gen-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('reports missing atlas-html', () => {
    const status = getAtlasGeneratedStatus(tmp);
    expect(status.exists).toBe(false);
    expect(status.message).toMatch(/not generated/i);
  });

  it('status + search + get body from generate artifacts', () => {
    const dir = path.join(tmp, 'atlas-html');
    fs.mkdirSync(path.join(dir, 'bodies'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), '<html></html>');
    fs.writeFileSync(
      path.join(dir, 'atlas-events.json'),
      JSON.stringify([
        {
          id: 'hop-1',
          timestamp: '2026-01-01T00:00:00.000Z',
          method: 'GET',
          url: 'https://api.example.com/trips',
          status: 200,
          source: 'mock-hit',
          requestId: 'req-1',
          responseBodyRef: 'bodies/hop-1-res.json',
          usage: { screen: 'Trips' },
        },
      ])
    );
    fs.writeFileSync(
      path.join(dir, 'bodies-search.json'),
      JSON.stringify({
        'hop-1': '{"trips":[{"id":"t1","status":"CONFIRMED"}]}',
      })
    );
    fs.writeFileSync(
      path.join(dir, 'bodies', 'hop-1-res.json'),
      '{"trips":[{"id":"t1","status":"CONFIRMED"}]}'
    );
    fs.writeFileSync(path.join(dir, 'atlas.har'), '{"log":{"entries":[]}}');

    const status = getAtlasGeneratedStatus(tmp);
    expect(status.exists).toBe(true);
    expect(status.hopCount).toBe(1);
    expect(status.bodySearchEntryCount).toBe(1);
    expect(status.bodySpillFileCount).toBe(1);

    const hops = listAtlasGeneratedHops(tmp, { onlyWithBodies: true });
    expect(hops.hops).toHaveLength(1);
    expect(hops.hops[0].usageScreens).toEqual(['Trips']);

    const search = searchAtlasGeneratedBodies(tmp, 'CONFIRMED');
    expect(search.matchCount).toBe(1);
    expect(search.hits[0].eventId).toBe('hop-1');
    expect(search.hits[0].hop?.method).toBe('GET');

    const body = getAtlasGeneratedHopBody(tmp, 'hop-1');
    expect(body.found).toBe(true);
    expect(body.bodyText).toContain('CONFIRMED');
    expect(body.spill?.response).toContain('t1');
  });

  it('blocks path traversal for spill refs', () => {
    expect(resolveAtlasHtmlRelativePath(tmp, '../secret.json')).toBeNull();
    const ok = resolveAtlasHtmlRelativePath(tmp, 'bodies/x.json');
    expect(ok).toContain(`${path.sep}atlas-html${path.sep}bodies${path.sep}x.json`);
  });

  it('summarizeAtlasDoc keeps datasource lastRequestId', () => {
    const summary = summarizeAtlasDoc({
      scenario: 'default',
      pages: {
        home: {
          pageId: 'home',
          nodes: {
            n1: {
              nodeId: 'n1',
              datasources: [
                { datasourceId: 'trips', lastRequestId: 'req-9', operations: ['Trips'] },
              ],
            },
          },
          placements: [{ treePath: 'home' }],
        },
      },
      screens: {
        Trips: { screen: 'Trips', components: ['List'], datasourceIds: ['trips'] },
      },
      prefetches: {},
    });
    expect(summary.pageCount).toBe(1);
    expect(summary.pages[0].datasources[0].lastRequestId).toBe('req-9');
    expect(summary.screens[0].screen).toBe('Trips');
  });
});
