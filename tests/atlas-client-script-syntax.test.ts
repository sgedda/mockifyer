/**
 * Test that the generated Atlas client script has valid JavaScript syntax.
 * Prevents regression of template literal escaping issues.
 */

import { buildAtlasDocHtmlFiles } from '../packages/mockifyer-core/src/utils/atlas-doc-html';
import type { AtlasDocMap } from '../packages/mockifyer-core/src/utils/atlas-doc';
import type { NetworkEvent } from '../packages/mockifyer-core/src/utils/network-event-types';

describe('Atlas client script syntax', () => {
  it('should generate syntactically valid JavaScript in client script', () => {
    const map: AtlasDocMap = {
      scenario: 'test',
      updatedAt: new Date().toISOString(),
      pages: {},
      screens: {},
      prefetches: {}
    };
    
    const events: NetworkEvent[] = [{
      id: 'e1',
      timestamp: new Date().toISOString(),
      scenario: 'test',
      transport: 'fetch',
      method: 'GET',
      url: 'https://api.example.com/test',
      path: '/test',
      source: 'upstream',
      durationMs: 100,
      status: 200
    }];
    
    const files = buildAtlasDocHtmlFiles(map, events);
    const html = files['index.html'];
    
    expect(html).toBeDefined();
    expect(html).toContain('<script>');
    
    // Extract the script content
    const scriptStart = html.indexOf('<script>') + 8;
    const scriptEnd = html.indexOf('</script>', scriptStart);
    const script = html.slice(scriptStart, scriptEnd);
    
    // Test that it parses as valid JavaScript
    expect(() => {
      new Function(script);
    }).not.toThrow();
  });
});
