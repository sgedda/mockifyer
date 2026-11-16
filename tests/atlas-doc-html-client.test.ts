/**
 * Tests for client-side functionality in generated Atlas HTML documentation.
 * Verifies that helper functions required by endpoint detail rendering are
 * available in the browser-side client script to prevent ReferenceErrors.
 */

import type { NetworkEvent } from '../packages/mockifyer-core/src/utils/network-event-types';
import { buildAtlasDocHtmlFiles } from '../packages/mockifyer-core/src/utils/atlas-doc-html';
import type { AtlasDocMap } from '../packages/mockifyer-core/src/utils/atlas-doc';

describe('Atlas HTML Client-Side Rendering', () => {
  it('should include extractHost and normalizeUrlToTemplate in client script', () => {
    // Generate a simple Atlas HTML document
    const events: NetworkEvent[] = [
      {
        id: '1',
        timestamp: new Date().toISOString(),
        scenario: 'default',
        transport: 'fetch' as const,
        method: 'GET',
        url: 'https://api.example.com/users/123',
        path: '/users/123',
        source: 'upstream' as const,
        status: 200,
        durationMs: 50,
        requestHeaders: {},
        responseHeaders: {},
        usage: []
      },
      {
        id: '2',
        timestamp: new Date().toISOString(),
        scenario: 'default',
        transport: 'fetch' as const,
        method: 'GET',
        url: 'https://api.example.com/users/456',
        path: '/users/456',
        source: 'upstream' as const,
        status: 200,
        durationMs: 45,
        requestHeaders: {},
        responseHeaders: {},
        usage: []
      }
    ];

    const map: AtlasDocMap = {
      scenario: 'default',
      updatedAt: new Date().toISOString(),
      pages: {},
      screens: {},
      prefetches: {}
    };
    const files = buildAtlasDocHtmlFiles(map, events);
    const html = files['index.html'];

    // Verify the helper functions are defined in the client script
    expect(html).toContain('function extractHost(url)');
    expect(html).toContain('function normalizeUrlToTemplate(url)');
    
    // Verify they are defined BEFORE renderEndpointDetail uses them
    const extractHostPos = html.indexOf('function extractHost(url)');
    const normalizePos = html.indexOf('function normalizeUrlToTemplate(url)');
    const renderDetailPos = html.indexOf('function renderEndpointDetail(');
    
    expect(extractHostPos).toBeGreaterThan(0);
    expect(normalizePos).toBeGreaterThan(0);
    expect(renderDetailPos).toBeGreaterThan(0);
    
    // Helpers should be defined before they're used
    expect(extractHostPos).toBeLessThan(renderDetailPos);
    expect(normalizePos).toBeLessThan(renderDetailPos);
  });

  it('should use extractHost and normalizeUrlToTemplate in renderEndpointDetail', () => {
    const events: NetworkEvent[] = [
      {
        id: '1',
        timestamp: new Date().toISOString(),
        scenario: 'default',
        transport: 'fetch' as const,
        method: 'POST',
        url: 'https://api.example.com/products/abc-123',
        path: '/products/abc-123',
        source: 'upstream' as const,
        status: 201,
        durationMs: 120,
        requestHeaders: {},
        responseHeaders: {},
        responseBodyPreview: '{"success": true}',
        usage: []
      }
    ];

    const map: AtlasDocMap = {
      scenario: 'default',
      updatedAt: new Date().toISOString(),
      pages: {},
      screens: {},
      prefetches: {}
    };
    const files = buildAtlasDocHtmlFiles(map, events);
    const html = files['index.html'];

    // Verify renderEndpointDetail calls these functions
    const renderFnStart = html.indexOf('function renderEndpointDetail(');
    const renderFnEnd = html.indexOf('function renderDetail(', renderFnStart);
    
    expect(renderFnStart).toBeGreaterThan(0);
    expect(renderFnEnd).toBeGreaterThan(renderFnStart);
    
    const renderFnBody = html.substring(renderFnStart, renderFnEnd);
    
    // Check that the function body calls extractHost and normalizeUrlToTemplate
    expect(renderFnBody).toContain('extractHost(e.url)');
    expect(renderFnBody).toContain('normalizeUrlToTemplate(e.url)');
  });
});
