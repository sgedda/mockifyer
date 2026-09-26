import {
  highlightAtlasCode,
  highlightCurlHtml,
  highlightJsonHtml,
} from '@sgedda/mockifyer-core';

describe('atlas-syntax-highlight', () => {
  it('colors JSON keys, strings, numbers, and literals', () => {
    const html = highlightJsonHtml('{\n  "alias": "home",\n  "n": 1,\n  "ok": true\n}');
    expect(html).toContain('<span class="json-k">&quot;alias&quot;</span>');
    expect(html).toContain('<span class="json-s">&quot;home&quot;</span>');
    expect(html).toContain('<span class="json-n">1</span>');
    expect(html).toContain('<span class="json-b">true</span>');
  });

  it('colors curl command, flags, and quoted URL', () => {
    const html = highlightCurlHtml(
      "curl -i -X GET 'http://localhost:4000/items?alias=x'",
    );
    expect(html).toContain('<span class="curl-cmd">curl</span>');
    expect(html).toContain('<span class="curl-flag">-i</span>');
    expect(html).toContain('<span class="curl-flag">-X</span>');
    expect(html).toContain('curl-url');
    expect(html).toContain('http://localhost:4000/items?alias=x');
  });

  it('auto-detects curl vs json vs plain', () => {
    expect(highlightAtlasCode('curl -i http://x', 'auto')).toContain('curl-cmd');
    expect(highlightAtlasCode('{"a":1}', 'auto')).toContain('json-k');
    expect(highlightAtlasCode('hello <world>', 'plain')).toBe('hello &lt;world&gt;');
  });
});
