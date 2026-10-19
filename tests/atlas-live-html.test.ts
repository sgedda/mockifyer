import {
  ATLAS_LIVE_STREAM_PATH,
  buildAtlasLiveStreamHtml,
} from '@sgedda/mockifyer-core';

interface FakeElement {
  innerHTML: string;
  textContent: string;
  value: string;
  hidden: boolean;
  scrollTop: number;
  classList: { add(): void; remove(): void; toggle(): void; contains(): boolean };
  addEventListener(type: string, fn: (e: unknown) => void): void;
  setAttribute(): void;
  removeAttribute(): void;
  getAttribute(): null;
  focus(): void;
  click(): void;
  listeners: Record<string, (e: unknown) => void>;
}

function fakeElement(): FakeElement {
  const listeners: Record<string, (e: unknown) => void> = {};
  return {
    innerHTML: '',
    textContent: '',
    value: '',
    hidden: false,
    scrollTop: 0,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener(type, fn) {
      listeners[type] = fn;
    },
    setAttribute() {},
    removeAttribute() {},
    getAttribute: () => null,
    focus() {},
    click() {
      listeners.click?.({ preventDefault() {} });
    },
    listeners,
  };
}

/** Run the live page script against stub DOM + EventSource; returns hooks. */
function runLivePageScript() {
  const html = buildAtlasLiveStreamHtml();
  const script = html.slice(html.indexOf('<script>') + '<script>'.length, html.lastIndexOf('</script>'));
  const elements = new Map<string, FakeElement>();
  const byId = (id: string) => {
    if (!elements.has(id)) elements.set(id, fakeElement());
    return elements.get(id)!;
  };
  const sources: Array<{ listeners: Record<string, (msg: { data: string }) => void> }> = [];
  class FakeEventSource {
    listeners: Record<string, (msg: { data: string }) => void> = {};
    constructor() {
      sources.push(this);
    }
    addEventListener(type: string, fn: (msg: { data: string }) => void) {
      this.listeners[type] = fn;
    }
    close() {}
  }
  const documentStub = {
    hidden: false,
    documentElement: fakeElement(),
    body: fakeElement(),
    getElementById: byId,
    addEventListener() {},
    createElement: fakeElement,
  };
  const windowStub = { open: () => ({}), confirm: () => true, matchMedia: () => ({ matches: false }) };
  const storage = { getItem: () => null, setItem() {} };
  new Function('document', 'window', 'EventSource', 'localStorage', 'navigator', 'fetch', script)(
    documentStub,
    windowStub,
    FakeEventSource,
    storage,
    {},
    () => new Promise(() => {}),
  );
  const source = sources[0];
  source.listeners.hello?.({ data: '{}' });
  return {
    emit(type: string, payload: unknown) {
      source.listeners[type]?.({ data: JSON.stringify(payload) });
    },
    expandAll() {
      byId('btn-expand').click();
    },
    hopsHtml: () => byId('hops').innerHTML,
  };
}

describe('atlas-live-html', () => {
  it('exposes the Metro live path constant', () => {
    expect(ATLAS_LIVE_STREAM_PATH).toBe('/mockifyer-atlas-live');
  });

  it('releases the SSE connection while the tab is hidden', () => {
    const html = buildAtlasLiveStreamHtml();

    expect(html).toContain('addEventListener("visibilitychange"');
    expect(html).toContain('function disconnect()');
    expect(html).toContain('if (!document.hidden) {\n    connect();');
  });

  it('builds a self-contained page that streams hops with expand/collapse', () => {
    const html = buildAtlasLiveStreamHtml();

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Mockifyer Atlas');
    expect(html).toContain('EventSource');
    expect(html).toContain('/mockifyer-network-events/stream');
    expect(html).toContain('data-parent');
    expect(html).toContain('click expand');
    expect(html).toContain('click collapse');
    expect(html).toContain('Expand all');
    expect(html).toContain('toggleAllExpanded');
    expect(html).toContain('parentRequestId');
    expect(html).toContain('/mockifyer-network-events/clear');
    expect(html).toContain('/mockifyer-atlas-trace');
    expect(html).toContain('data-trace-id');
    expect(html).toContain('X-Mockifyer-Include-Trace');
    expect(html).toContain('function pathWithQuery');
    expect(html).toContain('function hopUrl');
    expect(html).toContain('rootOrder.unshift');
    expect(html).toContain('stickToTop');
    expect(html).toContain('newest first');
    expect(html).toContain('setAnalyzeContent');
    expect(html).toContain('highlightAtlasCode');
    expect(html).toContain('--code-key');
    expect(html).toContain('json-k');
    expect(html).toContain('d.getHours()');
    expect(html).toContain('Browser local timezone');
  });

  it('groups duplicates and nests every level, without a per-hop html link', () => {
    const html = buildAtlasLiveStreamHtml();

    // Recursion: children render through the same list renderer at depth + 1.
    expect(html).toContain('function renderHopList');
    expect(html).toContain('childrenBlockHtml(nodeKeyOf(ev), kids, depth + 1)');
    // Dedupe is no longer limited to root hops.
    expect(html).toContain('collapseDuplicates && kids.length === 0');
    // Collapsed summaries count the whole subtree, not just direct children.
    expect(html).toContain('function countDescendants');
    expect(html).toContain('unique');
    // trace opens include-trace result in a new browser tab.
    expect(html).toContain('format=html');
    expect(html).toContain('window.open');
    expect(html).toContain('window.confirm');
    expect(html).toContain('target="_blank"');
    // req / res only when the hop has a body preview or spill ref.
    expect(html).toContain('function hopHasBody');
    expect(html).toContain('hopHasBody(ev, "req")');
    expect(html).toContain('hopHasBody(ev, "res")');
    expect(html).toContain('>req</a>');
    expect(html).toContain('>res</a>');
    expect(html).not.toContain('>html</a>');
  });

  it('offers a curl copy link that rebuilds the request from the hop', () => {
    const html = buildAtlasLiveStreamHtml();

    expect(html).toContain('>curl</a>');
    expect(html).toContain('class="curl-link"');
    expect(html).toContain('function curlCommandFor');
    expect(html).toContain('function hopShowsCurl');
    expect(html).toContain('!parentIdOf(ev)');
    expect(html).toContain('curl -i -X ');
    // Captured hop headers plus include-trace stamps.
    expect(html).toContain('ev.requestHeaders || {}');
    expect(html).toContain('INCLUDE_TRACE_HEADER');
    expect(html).toContain('x-mockifyer-include-trace');
    expect(html).toContain('x-mockifyer-include-trace-bodies');
    expect(html).toContain('--data-raw ');
    // Truncated GraphQL / large bodies: fetch spill via atlas-open before copy.
    expect(html).toContain('function resolveCurlRequestBody');
    expect(html).toContain('requestBodyNeedsFullFetch');
    expect(html).toContain('hopOpenUrl(ev, "req")');
    expect(html).toContain('resolving full request body for curl');
    // POSIX single-quote escaping without literal backslashes in the template.
    expect(html).toContain('String.fromCharCode(92)');
    // Clipboard with a manual-copy fallback for non-secure contexts.
    expect(html).toContain('navigator.clipboard');
    expect(html).toContain('execCommand');
  });

  it('shows the hop domain and keeps hosts apart when grouping duplicates', () => {
    const html = buildAtlasLiveStreamHtml();

    expect(html).toContain('function hostOf');
    expect(html).toContain('class="host"');
    // Same path on two hosts must not collapse into one group.
    expect(html).toContain('hostOf(ev),');
  });

  it('offers a dark mode toggle persisted in localStorage', () => {
    const html = buildAtlasLiveStreamHtml();

    expect(html).toContain('id="btn-dark"');
    expect(html).toContain('>Dark mode</button>');
    expect(html).toContain('Dark mode');
    expect(html).toContain('function toggleDarkTheme');
    expect(html).toContain('k === "n" || k === "N"');
  });

  it('links to the Mockifyer dashboard from the toolbar menu', () => {
    const html = buildAtlasLiveStreamHtml({
      dashboardUrl: 'http://localhost:3002/mockifyer',
    });

    expect(html).toContain('aria-label="Mockifyer links"');
    expect(html).toContain('href="http://localhost:3002/mockifyer"');
    expect(html).toContain('>Dashboard</a>');
    expect(html).toContain('target="_blank"');
  });

  it('places Render docs in the top-right header actions', () => {
    const html = buildAtlasLiveStreamHtml();

    expect(html).toContain('class="header-top"');
    expect(html).toContain('class="header-actions"');
    expect(html).toMatch(
      /header-actions[\s\S]*id="btn-render"[\s\S]*<\/div>\s*<div class="toolbar"/,
    );
    expect(html).not.toMatch(
      /class="toolbar"[\s\S]*id="btn-render"/,
    );
  });

  it('offers Render docs from the live page (no auto-generate on Metro stop)', () => {
    const html = buildAtlasLiveStreamHtml();

    expect(html).toContain('id="btn-render"');
    expect(html).toContain('>Render docs</button>');
    expect(html).toContain('id="render-modal"');
    expect(html).toContain('Generate &amp; open');
    expect(html).toContain('function openRenderModal');
    expect(html).toContain('function runRenderDocs');
    expect(html).toContain('function openAtlasHtmlWindow');
    expect(html).toContain('resultWin.location.href');
    expect(html).toContain('/mockifyer-network-events/render');
    expect(html).toContain('/atlas-html/index.html');
    expect(html).toContain('>Atlas HTML</a>');
    expect(html).toContain('Does <strong>not</strong> stop capture');
  });

  it('clears the hop buffer with Backspace (not c)', () => {
    const html = buildAtlasLiveStreamHtml();

    expect(html).toContain('k === "Backspace"');
    expect(html).toContain('Clear Metro hop buffer (Backspace)');
    expect(html).not.toContain('k === "c" || k === "C"');
    expect(html).toContain('Live Metro hop stream — newest first');
  });

  it('filters hops with exact contiguous search like Atlas HTML (no f shortcut)', () => {
    const html = buildAtlasLiveStreamHtml();

    expect(html).toContain('id="search"');
    expect(html).toContain('function hopSearchHaystack');
    expect(html).toContain('function hopMatchesSearchQuery');
    expect(html).toContain('function hasSearchMatchInTree');
    expect(html).toContain('Exact contiguous match');
    expect(html).toContain('searchQuery');
    // Errors keep f; search has no keyboard shortcut.
    expect(html).toContain('k === "f" || k === "F"');
    expect(html).toContain('errorsOnly = !errorsOnly');
    expect(html).not.toContain('searchInput.focus');
    expect(html).not.toContain('k === "/"');
  });

  /**
   * The page script lives in a TS template literal, so an unescaped `\n` (or any
   * escape TS consumes) emits a literal newline inside a JS string and the whole
   * inline script fails to parse — the page then renders blank with no hops.
   */
  it('emits an inline script that parses as valid JavaScript', () => {
    const html = buildAtlasLiveStreamHtml();
    const start = html.indexOf('<script>');
    const end = html.lastIndexOf('</script>');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);

    const script = html.slice(start + '<script>'.length, end);
    expect(script.length).toBeGreaterThan(1000);
    // Compiles without executing — throws SyntaxError on a malformed script.
    expect(() => new Function(script)).not.toThrow();
  });

  it('shows the GraphQL operation name and keeps different operations apart', () => {
    const page = runLivePageScript();
    const gql = (id: string, operationName: string) => ({
      id,
      requestId: id,
      method: 'POST',
      url: 'http://localhost:4000/graphql',
      path: '/graphql',
      source: 'upstream',
      requestBodyPreview: JSON.stringify({ operationName, query: `query ${operationName} { a }` }),
    });

    page.emit('hop', gql('g1', 'myAccountDeferredBookings'));
    page.emit('hop', gql('g2', 'homePage'));

    const html = page.hopsHtml();
    expect(html).toContain('<span class="gql-op" title="GraphQL operation">myAccountDeferredBookings</span>');
    expect(html).toContain('<span class="gql-op" title="GraphQL operation">homePage</span>');
    expect(html).not.toContain('×2');
  });

  it('honors custom stream/clear paths', () => {
    const html = buildAtlasLiveStreamHtml({
      title: 'Custom Atlas',
      streamPath: '/custom/stream',
      clearPath: '/custom/clear',
      backlog: false,
    });
    expect(html).toContain('Custom Atlas');
    expect(html).toContain('/custom/stream');
    expect(html).toContain('/custom/clear');
    expect(html).toContain('var BACKLOG = false');
  });
});
