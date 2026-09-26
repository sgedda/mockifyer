import {
  ATLAS_LIVE_STREAM_PATH,
  buildAtlasLiveStreamHtml,
} from '@sgedda/mockifyer-core';

describe('atlas-live-html', () => {
  it('exposes the Metro live path constant', () => {
    expect(ATLAS_LIVE_STREAM_PATH).toBe('/mockifyer-atlas-live');
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
    expect(html).toContain('childrenBlockHtml(requestIdOf(ev), kids, depth + 1)');
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
