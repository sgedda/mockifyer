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
} from '@sgedda/mockifyer-core';

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
});
