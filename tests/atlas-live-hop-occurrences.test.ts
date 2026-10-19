import { buildAtlasLiveStreamHtml } from '../packages/mockifyer-core/src/utils/atlas-live-html';
import { pickHopOccurrenceIndex } from '../packages/mockifyer-core/src/utils/hop-occurrences';

type Listener = (event: Record<string, unknown>) => void;

interface StubElement {
  innerHTML: string;
  [key: string]: unknown;
}

interface LivePageHarness {
  emitHop(hop: Record<string, unknown>): void;
  pressKey(key: string): void;
  hopsHtml(): string;
}

/** Element stub: known fields are real, anything else is a no-op method. */
function stubElement(): StubElement {
  const target: StubElement = {
    innerHTML: '',
    textContent: '',
    value: '',
    scrollTop: 0,
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  };
  return new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop as string];
      return () => undefined;
    },
  });
}

/** Run the live page script against stub DOM + EventSource so hops can be streamed in. */
function loadLivePage(): LivePageHarness {
  const html = buildAtlasLiveStreamHtml();
  const script = html.slice(html.indexOf('<script>') + '<script>'.length, html.lastIndexOf('</script>'));

  const elements = new Map<string, StubElement>();
  const documentListeners: Record<string, Listener[]> = {};
  const streamListeners: Record<string, Listener[]> = {};

  const documentStub = {
    hidden: false,
    documentElement: stubElement(),
    body: stubElement(),
    getElementById(id: string) {
      if (!elements.has(id)) elements.set(id, stubElement());
      return elements.get(id);
    },
    querySelector: () => stubElement(),
    querySelectorAll: () => [],
    addEventListener(type: string, fn: Listener) {
      (documentListeners[type] ??= []).push(fn);
    },
  };
  class EventSourceStub {
    constructor(public url: string) {}
    addEventListener(type: string, fn: Listener) {
      (streamListeners[type] ??= []).push(fn);
    }
    close() {}
  }
  const localStorageStub = { getItem: () => null, setItem() {} };

  new Function('document', 'window', 'EventSource', 'localStorage', 'navigator', script)(
    documentStub,
    { confirm: () => false, open: () => null, localStorage: localStorageStub },
    EventSourceStub,
    localStorageStub,
    {}
  );

  return {
    emitHop(hop) {
      for (const fn of streamListeners.hop ?? []) fn({ data: JSON.stringify(hop) });
    },
    pressKey(key) {
      for (const fn of documentListeners.keydown ?? []) {
        fn({ key, target: { tagName: 'BODY' }, preventDefault() {} });
      }
    },
    hopsHtml: () => elements.get('hops')?.innerHTML ?? '',
  };
}

/** Hop ids in render order, each with its tree depth (0 = root). */
function renderedTree(html: string): Array<{ id: string; depth: number }> {
  const rows: Array<{ id: string; depth: number }> = [];
  const rowPattern = /data-hop-id="([^"]+)"><div class="main">(<span class="tree">([^<]*)<\/span>)?/g;
  for (const match of html.matchAll(rowPattern)) {
    const indent = match[3] ?? '';
    rows.push({ id: match[1], depth: indent ? indent.length / 3 : 0 });
  }
  return rows;
}

function hop(id: string, timestamp: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    timestamp,
    method: 'GET',
    url: `https://api.example/${id}`,
    path: `/${id}`,
    status: 200,
    source: 'upstream',
    ...extra,
  };
}

describe('pickHopOccurrenceIndex', () => {
  it('returns -1 without parent calls', () => {
    expect(pickHopOccurrenceIndex([], 10)).toBe(-1);
  });

  it('picks the latest parent call that started at or before the child', () => {
    expect(pickHopOccurrenceIndex([100, 200, 300], 250)).toBe(1);
    expect(pickHopOccurrenceIndex([100, 200, 300], 300)).toBe(2);
  });

  it('falls back to the earliest parent call when the child started first', () => {
    expect(pickHopOccurrenceIndex([100, 200], 50)).toBe(0);
  });

  it('uses the newest parent call when the child has no usable start', () => {
    expect(pickHopOccurrenceIndex([100, 200], NaN)).toBe(1);
  });
});

describe('Atlas live page with a reused hop requestId', () => {
  const run1 = '2026-09-28T15:35:32.990Z';
  const run2 = '2026-09-28T15:37:44.020Z';
  const graphql = { method: 'POST', url: 'http://localhost:4000/graphql', path: '/graphql' };

  it('shows each call as its own root with only its own children', () => {
    const page = loadLivePage();
    page.emitHop(hop('gql-a', run1, { ...graphql, requestId: 'gql-stored' }));
    page.emitHop(hop('acct-a', '2026-09-28T15:35:32.991Z', { requestId: 'acct-a', parentRequestId: 'gql-stored' }));
    page.emitHop(hop('gql-b', run2, { ...graphql, requestId: 'gql-stored' }));
    page.emitHop(hop('acct-b', '2026-09-28T15:37:44.044Z', { requestId: 'acct-b', parentRequestId: 'gql-stored' }));
    page.pressKey('e');

    expect(renderedTree(page.hopsHtml())).toEqual([
      { id: 'gql-b', depth: 0 },
      { id: 'acct-b', depth: 1 },
      { id: 'gql-a', depth: 0 },
      { id: 'acct-a', depth: 1 },
    ]);
  });

  it('moves children to their own call when that call is logged after them', () => {
    const page = loadLivePage();
    page.emitHop(hop('gql-a', run1, { ...graphql, requestId: 'gql-stored' }));
    page.emitHop(hop('acct-a', '2026-09-28T15:35:32.991Z', { requestId: 'acct-a', parentRequestId: 'gql-stored' }));
    // Second run: children finish (and are logged) before their GraphQL parent.
    page.emitHop(hop('acct-b', '2026-09-28T15:37:44.044Z', { requestId: 'acct-b', parentRequestId: 'gql-stored' }));
    page.emitHop(hop('gql-b', run2, { ...graphql, requestId: 'gql-stored' }));
    page.pressKey('e');

    expect(renderedTree(page.hopsHtml())).toEqual([
      { id: 'gql-b', depth: 0 },
      { id: 'acct-b', depth: 1 },
      { id: 'gql-a', depth: 0 },
      { id: 'acct-a', depth: 1 },
    ]);
  });

  it('still folds the client and proxy records of one call into a single row', () => {
    const page = loadLivePage();
    page.emitHop(hop('gql-a', run1, { ...graphql, requestId: 'gql-stored' }));
    page.emitHop(
      hop('acct-client', '2026-09-28T15:35:32.991Z', {
        requestId: 'acct-a',
        parentRequestId: 'gql-stored',
        transport: 'axios',
      })
    );
    page.emitHop(
      hop('acct-proxy', '2026-09-28T15:35:32.993Z', {
        requestId: 'acct-a',
        parentRequestId: 'gql-stored',
        transport: 'proxy',
      })
    );
    page.pressKey('e');

    expect(renderedTree(page.hopsHtml())).toEqual([
      { id: 'gql-a', depth: 0 },
      { id: 'acct-proxy', depth: 1 },
    ]);
  });
});
