import {
  buildAtlasTree,
  capturePrefetch,
  capturePresentation,
  captureTrackedSurface,
  clearAtlasEvents,
  configureAtlas,
  createCacheRegistry,
  createCmsRenderer,
  endAtlasSession,
  getAtlasDocMap,
  getAtlasEvents,
  getAtlasSessionId,
  getUsagesForRequestId,
  inferValueSchema,
  isAtlasEnabled,
  mergeSchemas,
  mergeUsageOntoNetworkEvents,
  recordUsage,
  resetAtlasDocRuntime,
  resetAtlasRuntime,
  resetAtlasUsageRuntime,
  resolveUsageForNetworkEmit,
  sampleDeep,
  setAtlasUsageContext,
  startAtlasSession,
  upsertAtlasDocFromPresentation,
  upsertAtlasDocFromUsage,
  buildAtlasDocHtmlFiles,
  escapeHtml,
  writeAtlasDocHtml,
  setAtlasDocHtmlOutputPath,
  flushAtlasDocHtmlRewrite,
  resolveAtlasHtmlOutputPath,
  getAtlasDocHtmlOutputPath,
} from '@sgedda/mockifyer-core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
describe('atlas', () => {
  beforeEach(() => {
    resetAtlasRuntime();
    resetAtlasUsageRuntime();
    delete process.env.MOCKIFYER_ATLAS;
  });

  afterEach(() => {
    resetAtlasRuntime();
    resetAtlasUsageRuntime();
    delete process.env.MOCKIFYER_ATLAS;
  });

  it('is off by default and capture is a no-op', () => {
    expect(isAtlasEnabled()).toBe(false);
    expect(capturePrefetch({ datasourceId: 'x', requestId: 'r1' })).toBeNull();
    expect(getAtlasEvents()).toHaveLength(0);
  });

  it('configureAtlas live enables capture and starts a session', () => {
    configureAtlas({ atlas: { enabled: true, mode: 'live' } });
    expect(isAtlasEnabled()).toBe(true);
    expect(getAtlasSessionId()).toBeTruthy();

    const pref = capturePrefetch({
      datasourceId: 'app-bootstrap',
      requestId: 'req-1',
      kind: 'graphql',
      operation: 'AppBootstrap',
      phase: 'login',
    });
    expect(pref?.kind).toBe('prefetch');

    const pres = capturePresentation({
      cms: {
        pageId: 'contact',
        nodeId: 'phone-1',
        type: 'phonedetails',
        path: 'contact/phone-1',
      },
      datasources: [
        { datasourceId: 'app-bootstrap', requestId: 'req-1', dataRoot: 'user.phoneDetails' },
      ],
      shown: { number: '+46' },
    });
    expect(pres?.kind).toBe('presentation');
    expect(getUsagesForRequestId('req-1')[0].component).toBe('phonedetails');
  });

  it('posts atlas events and usage with unpatched fetch when global fetch is patched', async () => {
    const originalFetch = jest.fn(async () => ({ ok: true } as Response));
    const patchedFetch = jest.fn(async () => {
      throw new Error('patched fetch must not handle dashboard atlas POSTs');
    });
    const previousFetch = globalThis.fetch;
    const previousOriginal = (globalThis as { __mockifyer_original_fetch?: typeof fetch })
      .__mockifyer_original_fetch;

    (globalThis as { __mockifyer_original_fetch?: typeof fetch }).__mockifyer_original_fetch =
      originalFetch as unknown as typeof fetch;
    globalThis.fetch = patchedFetch as unknown as typeof fetch;

    try {
      configureAtlas({
        atlas: { enabled: true, mode: 'live', dashboardBaseUrl: 'http://localhost:3002' },
      });
      capturePrefetch({
        datasourceId: 'app-bootstrap',
        requestId: 'req-atlas',
        kind: 'graphql',
        operation: 'AppBootstrap',
      });
      capturePresentation({
        cms: {
          pageId: 'contact',
          nodeId: 'phone-1',
          type: 'phonedetails',
          path: 'contact/phone-1',
        },
        datasources: [{ datasourceId: 'app-bootstrap', requestId: 'req-atlas' }],
      });

      await new Promise((resolve) => setImmediate(resolve));

      expect(patchedFetch).not.toHaveBeenCalled();
      expect(originalFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
      const postedUrls = originalFetch.mock.calls.map(
        (call) => (call as unknown as [string, RequestInit])[0]
      );
      expect(postedUrls).toContain('http://localhost:3002/api/atlas/events');
      expect(postedUrls).toContain('http://localhost:3002/api/atlas/usage');
    } finally {
      globalThis.fetch = previousFetch;
      if (previousOriginal) {
        (globalThis as { __mockifyer_original_fetch?: typeof fetch }).__mockifyer_original_fetch =
          previousOriginal;
      } else {
        delete (globalThis as { __mockifyer_original_fetch?: typeof fetch })
          .__mockifyer_original_fetch;
      }
    }
  });

  it('env MOCKIFYER_ATLAS wins over config', () => {
    process.env.MOCKIFYER_ATLAS = 'off';
    configureAtlas({ atlas: { enabled: true, mode: 'live' } });
    expect(isAtlasEnabled()).toBe(false);
  });

  it('sampleDeep truncates arrays in sample mode', () => {
    configureAtlas({ atlas: { mode: 'live', captureValues: 'sample' } });
    const sampled = sampleDeep({ items: [1, 2, 3, 4, 5, 6] }) as { items: unknown[] };
    expect(sampled.items.length).toBeLessThanOrEqual(4);
  });

  it('buildAtlasTree nests by parentId', () => {
    configureAtlas({ atlas: { mode: 'live' } });
    const sessionId = startAtlasSession('sess-tree');
    capturePresentation({
      sessionId,
      cms: { pageId: 'home', nodeId: 'page', type: 'page', path: 'home' },
      shown: {},
    });
    capturePresentation({
      sessionId,
      cms: {
        pageId: 'home',
        nodeId: 'hero',
        type: 'hero',
        path: 'home/hero',
        parentId: 'page',
      },
      shown: { headline: 'Hi' },
    });
    const tree = buildAtlasTree(getAtlasEvents(), sessionId);
    expect(tree).toHaveLength(1);
    expect(tree[0].children[0].type).toBe('hero');
  });

  it('buildAtlasTree does not duplicate nodes on re-presentation', () => {
    configureAtlas({ atlas: { mode: 'live' } });
    const sessionId = startAtlasSession('sess-dup');
    capturePresentation({
      sessionId,
      cms: { pageId: 'home', nodeId: 'page', type: 'page', path: 'home' },
      shown: {},
    });
    capturePresentation({
      sessionId,
      cms: {
        pageId: 'home',
        nodeId: 'hero',
        type: 'hero',
        path: 'home/hero',
        parentId: 'page',
      },
      shown: { headline: 'Hi' },
    });
    capturePresentation({
      sessionId,
      cms: {
        pageId: 'home',
        nodeId: 'hero',
        type: 'hero',
        path: 'home/hero',
        parentId: 'page',
      },
      shown: { headline: 'Hi again' },
    });
    const tree = buildAtlasTree(getAtlasEvents(), sessionId);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].shown).toEqual({ headline: 'Hi again' });
  });

  it('endAtlasSession returns events and clears session id', () => {
    configureAtlas({ atlas: { mode: 'session' } });
    capturePrefetch({ datasourceId: 'a', requestId: 'r' });
    const { sessionId, events } = endAtlasSession();
    expect(sessionId).toBeTruthy();
    expect(events.length).toBeGreaterThan(0);
    expect(getAtlasSessionId()).toBeNull();
  });

  it('clearAtlasEvents empties the buffer', () => {
    configureAtlas({ atlas: { mode: 'live' } });
    capturePrefetch({ datasourceId: 'a', requestId: 'r' });
    clearAtlasEvents();
    expect(getAtlasEvents()).toHaveLength(0);
  });

  it('captureTrackedSurface marks source hardcoded', () => {
    configureAtlas({ atlas: { mode: 'live' } });
    const ev = captureTrackedSurface({
      id: 'checkout-summary',
      label: 'Checkout',
      shown: { total: 10 },
      datasources: [{ datasourceId: 'pricing', requestId: 'req-9' }],
    });
    expect(ev?.cms.source).toBe('hardcoded');
  });
});

describe('atlas-usage (trace spine)', () => {
  beforeEach(() => {
    resetAtlasUsageRuntime();
  });

  afterEach(() => {
    resetAtlasUsageRuntime();
  });

  it('setAtlasUsageContext stamps resolveUsageForNetworkEmit', () => {
    expect(resolveUsageForNetworkEmit()).toBeUndefined();
    setAtlasUsageContext({ screen: 'contact', component: 'PhoneDetails' });
    expect(resolveUsageForNetworkEmit()?.screen).toBe('contact');
    expect(resolveUsageForNetworkEmit()?.component).toBe('PhoneDetails');
  });

  it('recordUsage indexes by requestId and merges onto network events', () => {
    recordUsage({
      requestId: 'hop-1',
      usage: { screen: 'contact', component: 'phonedetails' },
    });
    expect(getUsagesForRequestId('hop-1')[0].screen).toBe('contact');

    const merged = mergeUsageOntoNetworkEvents(
      [{ requestId: 'hop-1', method: 'GET', url: '/x' }],
      [
        {
          id: 'a',
          timestamp: new Date().toISOString(),
          scenario: 'default',
          requestId: 'hop-1',
          usage: { screen: 'contact', component: 'phonedetails' },
        },
      ]
    );
    expect((merged[0] as { usage?: unknown }).usage).toMatchObject({ screen: 'contact', component: 'phonedetails' });
  });
});

describe('atlas-cache', () => {
  it('trackAccess only returns caches that were read', () => {
    const cache = createCacheRegistry();
    cache.set('app-user', { data: { phone: '1' }, requestId: 'r1', kind: 'graphql' });
    cache.set('products', { data: { items: [] }, requestId: 'r2', kind: 'graphql' });

    const { result, datasources } = cache.trackAccess(() => {
      const user = cache.getCache('app-user');
      return { number: (user?.data as { phone: string }).phone };
    });

    expect(result).toEqual({ number: '1' });
    expect(datasources).toHaveLength(1);
    expect(datasources[0].datasourceId).toBe('app-user');
  });

  it('nested trackAccess keeps outer datasources isolated from inner', () => {
    const cache = createCacheRegistry();
    cache.set('outer-a', { data: 1, requestId: 'r1' });
    cache.set('inner-b', { data: 2, requestId: 'r2' });
    cache.set('outer-c', { data: 3, requestId: 'r3' });

    const { datasources: outer } = cache.trackAccess(() => {
      cache.getCache('outer-a');
      const { datasources: inner } = cache.trackAccess(() => {
        cache.getCache('inner-b');
        return null;
      });
      expect(inner.map((d) => d.datasourceId)).toEqual(['inner-b']);
      cache.getCache('outer-c');
      return null;
    });

    expect(outer.map((d) => d.datasourceId).sort()).toEqual(['outer-a', 'outer-c']);
  });

  it('overlapping trackAccessAsync sessions do not steal each other reads', async () => {
    const cache = createCacheRegistry();
    cache.set('a', { data: 1, requestId: 'ra' });
    cache.set('b', { data: 2, requestId: 'rb' });
    cache.set('c', { data: 3, requestId: 'rc' });
    cache.set('d', { data: 4, requestId: 'rd' });

    const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    const p1 = cache.trackAccessAsync(async () => {
      cache.getCache('a');
      await delay(20);
      cache.getCache('b');
      return 'p1';
    });
    const p2 = cache.trackAccessAsync(async () => {
      cache.getCache('c');
      await delay(20);
      cache.getCache('d');
      return 'p2';
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.result).toBe('p1');
    expect(r2.result).toBe('p2');
    expect(r1.datasources.map((d) => d.datasourceId).sort()).toEqual(['a', 'b']);
    expect(r2.datasources.map((d) => d.datasourceId).sort()).toEqual(['c', 'd']);
  });
});

describe('createCmsRenderer', () => {
  interface Node {
    id: string;
    type: string;
    blocks?: Node[];
  }

  beforeEach(() => {
    resetAtlasRuntime();
    resetAtlasUsageRuntime();
    process.env.MOCKIFYER_ATLAS = 'live';
    configureAtlas({ atlas: { mode: 'live' } });
  });

  afterEach(() => {
    resetAtlasRuntime();
    resetAtlasUsageRuntime();
    delete process.env.MOCKIFYER_ATLAS;
  });

  it('resolveAndCapture records presentation with pageId from context', () => {
    const cache = createCacheRegistry();
    cache.set('app-bootstrap', {
      data: { user: { phoneDetails: { number: '+46' } } },
      requestId: 'req-1',
      kind: 'graphql',
      operation: 'AppBootstrap',
    });

    const renderer = createCmsRenderer<Node>({
      getNodeId: (n) => n.id,
      getNodeType: (n) => n.type,
      getChildren: (n) => n.blocks ?? [],
      buildProps: (node) => {
        const { result, datasources } = cache.trackAccess(() => {
          if (node.type !== 'phonedetails') return {};
          const entry = cache.getCache<{ user: { phoneDetails: { number: string } } }>(
            'app-bootstrap'
          );
          return { number: entry?.data.user.phoneDetails.number };
        });
        return { props: result, datasources };
      },
    });

    const { props, datasources } = renderer.resolveAndCapture(
      { id: 'phone-1', type: 'phonedetails' },
      { pageId: 'contact', path: 'contact/phone-1' }
    );

    expect(props).toEqual({ number: '+46' });
    expect(datasources).toHaveLength(1);
    expect(getAtlasEvents().filter((e) => e.kind === 'presentation')[0].cms.pageId).toBe('contact');
  });
});

describe('atlas-doc (auto map)', () => {
  beforeEach(() => {
    resetAtlasRuntime();
    resetAtlasUsageRuntime();
    resetAtlasDocRuntime();
    delete process.env.MOCKIFYER_ATLAS;
  });

  afterEach(() => {
    resetAtlasRuntime();
    resetAtlasUsageRuntime();
    resetAtlasDocRuntime();
    delete process.env.MOCKIFYER_ATLAS;
  });

  it('upserts the same node instead of duplicating', () => {
    configureAtlas({ atlas: { mode: 'live' } });
    capturePresentation({
      cms: {
        pageId: 'contact',
        nodeId: 'phone-1',
        type: 'phonedetails',
        path: 'contact/phone-1',
      },
      datasources: [
        { datasourceId: 'app-bootstrap', requestId: 'r1', dataRoot: 'user.phoneDetails' },
      ],
      shown: { number: '+46' },
    });
    capturePresentation({
      cms: {
        pageId: 'contact',
        nodeId: 'phone-1',
        type: 'phonedetails',
        path: 'contact/phone-1',
      },
      datasources: [
        { datasourceId: 'app-bootstrap', requestId: 'r2', dataRoot: 'user.phoneDetails' },
      ],
      shown: { number: '+47' },
    });

    const doc = getAtlasDocMap('default');
    expect(Object.keys(doc.pages.contact.nodes)).toEqual(['phone-1']);
    expect(doc.pages.contact.nodes['phone-1'].propsSample).toEqual({ number: '+47' });
    expect(doc.pages.contact.nodes['phone-1'].propsSchema).toEqual({ number: 'string' });
  });

  it('unions structure across visits and merges prop schemas', () => {
    upsertAtlasDocFromPresentation({
      scenario: 'default',
      cms: {
        pageId: 'contact',
        nodeId: 'trip-a',
        type: 'trip',
        path: 'contact/trip-a',
      },
      shown: { city: 'Stockholm' },
    });
    upsertAtlasDocFromPresentation({
      scenario: 'default',
      cms: {
        pageId: 'contact',
        nodeId: 'trip-b',
        type: 'trip',
        path: 'contact/trip-b',
      },
      shown: { city: 'Oslo', nights: 2 },
    });
    upsertAtlasDocFromPresentation({
      scenario: 'default',
      cms: {
        pageId: 'contact',
        nodeId: 'trip-a',
        type: 'trip',
        path: 'contact/trip-a',
      },
      shown: { city: 'Stockholm', hotel: true },
    });

    const page = getAtlasDocMap('default').pages.contact;
    expect(Object.keys(page.nodes).sort()).toEqual(['trip-a', 'trip-b']);
    expect(page.nodes['trip-a'].propsSchema).toEqual({
      city: 'string',
      hotel: 'boolean',
    });
    expect(page.nodes['trip-a'].propsSample).toEqual({ city: 'Stockholm', hotel: true });
  });

  it('infers and merges schemas', () => {
    expect(inferValueSchema({ a: 1, b: 'x' })).toEqual({ a: 'number', b: 'string' });
    expect(mergeSchemas({ a: 'number' }, { b: 'string' })).toEqual({
      a: 'number',
      b: 'string',
    });
  });

  it('preserves presentation label when usage reinforces the same node', () => {
    configureAtlas({ atlas: { mode: 'live' } });
    captureTrackedSurface({
      id: 'checkout-summary',
      label: 'Checkout',
      shown: { total: 10 },
      datasources: [{ datasourceId: 'pricing', requestId: 'req-9' }],
    });
    upsertAtlasDocFromUsage({
      cms: { pageId: '_app', nodeId: 'checkout-summary', type: 'checkout-summary' },
      component: 'checkout-summary',
      datasourceId: 'pricing',
      requestId: 'req-9',
    });
    expect(getAtlasDocMap('default').pages._app.nodes['checkout-summary'].label).toBe('Checkout');
    expect(
      getAtlasDocMap('default').pages._app.nodes['checkout-summary'].datasources[0].lastRequestId
    ).toBe('req-9');
  });

  it('dedupes usage when merging ambient stamp with annotations', () => {
    const merged = mergeUsageOntoNetworkEvents(
      [{ requestId: 'hop-1', usage: { screen: 'contact', component: 'Phone' } }],
      [
        {
          id: 'a',
          timestamp: new Date().toISOString(),
          scenario: 'default',
          requestId: 'hop-1',
          usage: { screen: 'contact', component: 'Phone' },
        },
      ]
    );
    const usage = (merged[0] as { usage?: unknown }).usage;
    expect(Array.isArray(usage) ? usage : [usage]).toHaveLength(1);
  });
});

describe('atlas-doc-html', () => {
  beforeEach(() => {
    resetAtlasRuntime();
    resetAtlasDocRuntime();
    delete process.env.MOCKIFYER_ATLAS;
    delete process.env.MOCKIFYER_ATLAS_HTML_PATH;
  });

  afterEach(() => {
    resetAtlasRuntime();
    resetAtlasDocRuntime();
    delete process.env.MOCKIFYER_ATLAS;
    delete process.env.MOCKIFYER_ATLAS_HTML_PATH;
  });

  it('buildAtlasDocHtmlFiles includes page titles and escapes HTML', () => {
    upsertAtlasDocFromPresentation({
      scenario: 'default',
      cms: {
        pageId: 'contact<script>',
        pageSlug: 'Contact & Home',
        nodeId: 'phone-1',
        type: 'phonedetails',
        path: 'contact/phone-1',
        label: '<b>Phone</b>',
      },
      shown: { number: '<+46>' },
    });

    const files = buildAtlasDocHtmlFiles(getAtlasDocMap('default'));
    expect(files['index.html']).toContain('data-view="waterfall"');
    expect(files['index.html']).toContain('hop-detail');
    expect(files['index.html']).toContain('atlas-data');
    expect(files['index.html']).toContain('Contact & Home');
    expect(files['index.html']).not.toContain('<script>alert');

    const pageHtml = files['pages/contact_script.html'];
    expect(pageHtml).toBeDefined();
    expect(pageHtml).toContain('&lt;b&gt;Phone&lt;/b&gt;');
    expect(pageHtml).toContain('&lt;+46&gt;');
    expect(escapeHtml('<x>')).toBe('&lt;x&gt;');
  });

  it('resolveAtlasHtmlOutputPath prefers env then config then mockDataPath default', () => {
    expect(resolveAtlasHtmlOutputPath({ mockDataPath: './mock-data' }, 'off')).toBeUndefined();
    expect(resolveAtlasHtmlOutputPath({ mockDataPath: './mock-data' }, 'live')).toBe(
      './mock-data/atlas-html'
    );
    expect(
      resolveAtlasHtmlOutputPath(
        { mockDataPath: './mock-data', atlas: { htmlOutputPath: './custom-html' } },
        'live'
      )
    ).toBe('./custom-html');

    process.env.MOCKIFYER_ATLAS_HTML_PATH = '/tmp/atlas-env';
    expect(
      resolveAtlasHtmlOutputPath(
        { mockDataPath: './mock-data', atlas: { htmlOutputPath: './custom-html' } },
        'live'
      )
    ).toBe('/tmp/atlas-env');
  });

  it('configureAtlas stores html path and capture writes files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-html-'));
    try {
      configureAtlas({
        mockDataPath: './mock-data',
        atlas: { mode: 'live', htmlOutputPath: dir },
      });
      expect(getAtlasDocHtmlOutputPath()).toBe(dir);

      capturePresentation({
        cms: {
          pageId: 'home',
          nodeId: 'hero',
          type: 'hero',
          path: 'home/hero',
        },
        shown: { title: 'Welcome' },
      });
      flushAtlasDocHtmlRewrite();

      const indexPath = path.join(dir, 'index.html');
      expect(fs.existsSync(indexPath)).toBe(true);
      const index = fs.readFileSync(indexPath, 'utf8');
      expect(index).toContain('home');
      expect(fs.existsSync(path.join(dir, 'pages', 'home.html'))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writeAtlasDocHtml writes index and page files to a directory', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-html-write-'));
    try {
      setAtlasDocHtmlOutputPath(dir);
      upsertAtlasDocFromPresentation({
        cms: {
          pageId: 'about',
          nodeId: 'bio',
          type: 'text',
          path: 'about/bio',
        },
        shown: { body: 'Hi' },
      });
      const map = getAtlasDocMap('default');
      const n = writeAtlasDocHtml(dir, map);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(fs.readFileSync(path.join(dir, 'index.html'), 'utf8')).toContain('about');
    } finally {
      setAtlasDocHtmlOutputPath(undefined);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
