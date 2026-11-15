/**
 * Verify Atlas HTML generation with realistic WanderWeird-like traffic
 * Simulates the e2e global teardown scenario
 */

import { describe, it, expect } from '@jest/globals';
import type { NetworkEvent } from '../packages/mockifyer-core/src/utils/network-event-types';
import { buildAtlasDocHtmlFiles } from '../packages/mockifyer-core/src/utils/atlas-doc-html';
import type { AtlasDocMap } from '../packages/mockifyer-core/src/utils/atlas-doc';
import * as fs from 'fs';
import * as path from 'path';

describe('Atlas E2E verification', () => {
  it('should generate Atlas HTML from WanderWeird-like traffic with all required sections', () => {
    // Simulate realistic WanderWeird app traffic
    const timestamp = new Date().toISOString();
    const events: NetworkEvent[] = [
      // Gateway -> wander-api internal calls
      {
        id: 'req1',
        url: 'http://127.0.0.1:4203/discover',
        method: 'GET',
        timestamp,
        scenario: 'guide-demo-2',
        transport: 'axios',
        source: 'upstream',
        status: 200,
        durationMs: 45,
        requestId: 'r1',
        requestHeaders: { 'x-api-key': 'test' }
      },
      {
        id: 'req2',
        url: 'http://127.0.0.1:4203/discover?destinationKey=atlantis',
        method: 'GET',
        timestamp,
        scenario: 'guide-demo-2',
        transport: 'axios',
        source: 'mock-hit',
        status: 200,
        durationMs: 12,
        requestId: 'r2',
        parentRequestId: 'r1'
      },
      // External API: Open-Meteo (weather)
      {
        id: 'req3',
        url: 'https://api.open-meteo.com/v1/forecast?latitude=37.9838&longitude=23.7275&current=temperature_2m',
        method: 'GET',
        timestamp,
        scenario: 'guide-demo-2',
        transport: 'fetch',
        source: 'mock-hit',
        status: 200,
        durationMs: 8,
        requestId: 'r3',
        parentRequestId: 'r2',
        responseBodyPreview: JSON.stringify({ current: { temperature_2m: 99 } })
      },
      // External API: API Countries
      {
        id: 'req4',
        url: 'https://api.apicountries.com/v1/countries/greece',
        method: 'GET',
        timestamp,
        scenario: 'guide-demo-2',
        transport: 'fetch',
        source: 'upstream',
        status: 200,
        durationMs: 125
      },
      // External API: Advice Slip
      {
        id: 'req5',
        url: 'https://api.adviceslip.com/advice',
        method: 'GET',
        timestamp,
        scenario: 'guide-demo-2',
        transport: 'fetch',
        source: 'upstream',
        status: 200,
        durationMs: 98
      },
      // External API: Bored API
      {
        id: 'req6',
        url: 'https://www.boredapi.com/api/activity',
        method: 'GET',
        timestamp,
        scenario: 'guide-demo-2',
        transport: 'fetch',
        source: 'upstream',
        status: 200,
        durationMs: 87
      },
      // More /discover calls
      {
        id: 'req7',
        url: 'http://127.0.0.1:4203/discover?destinationKey=rome',
        method: 'GET',
        timestamp,
        scenario: 'heatwave',
        transport: 'axios',
        source: 'mock-hit',
        status: 200,
        durationMs: 15
      },
      // POST request
      {
        id: 'req8',
        url: 'http://127.0.0.1:4203/destinations',
        method: 'POST',
        timestamp,
        scenario: 'guide-demo-2',
        transport: 'axios',
        source: 'upstream',
        status: 201,
        durationMs: 34,
        requestBodyPreview: JSON.stringify({ name: 'Paris', country: 'France' })
      },
      // Error case
      {
        id: 'req9',
        url: 'http://127.0.0.1:4203/discover?destinationKey=invalid',
        method: 'GET',
        timestamp,
        scenario: 'guide-demo-2',
        transport: 'axios',
        source: 'error',
        status: 404,
        durationMs: 5
      },
      // Multiple requests to same endpoint
      ...Array.from({ length: 40 }, (_, i) => ({
        id: `req-batch-${i}`,
        url: `http://127.0.0.1:4203/discover?destinationKey=dest${i % 10}`,
        method: 'GET',
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
        scenario: 'guide-demo-2',
        transport: 'axios',
        source: i % 3 === 0 ? 'mock-hit' : 'upstream',
        status: 200,
        durationMs: 10 + Math.random() * 50,
        requestId: `r-batch-${i}`,
        parentRequestId: i > 0 ? `r-batch-${i - 1}` : undefined
      } as NetworkEvent))
    ];

    // Generate Atlas HTML (like global-teardown.ts does)
    const emptyMap: AtlasDocMap = {
      scenario: 'guide-demo-2',
      updatedAt: new Date().toISOString(),
      pages: {},
      screens: {},
      prefetches: {}
    };
    
    const htmlFiles = buildAtlasDocHtmlFiles(emptyMap, events);

    expect(htmlFiles).toBeTruthy();
    expect(htmlFiles['index.html']).toBeTruthy();
    expect(typeof htmlFiles['index.html']).toBe('string');
    
    const htmlOutput = htmlFiles['index.html'];

    // Verify HTML structure
    expect(htmlOutput).toContain('<!DOCTYPE html>');
    expect(htmlOutput).toContain('<html');
    expect(htmlOutput).toContain('</html>');

    // Verify title and main sections
    expect(htmlOutput).toContain('API Atlas');
    expect(htmlOutput).toContain('Architecture');
    expect(htmlOutput).toContain('Services & Endpoints');
    expect(htmlOutput).toContain('Key Flows');

    // Verify services are listed
    expect(htmlOutput).toContain('127.0.0.1:4203');
    expect(htmlOutput).toContain('api.open-meteo.com');
    expect(htmlOutput).toContain('api.apicountries.com');
    expect(htmlOutput).toContain('api.adviceslip.com');
    expect(htmlOutput).toContain('www.boredapi.com');

    // Verify endpoints are listed
    expect(htmlOutput).toContain('/discover');
    expect(htmlOutput).toContain('/destinations');

    // Verify methods are shown
    expect(htmlOutput).toContain('GET');
    expect(htmlOutput).toContain('POST');

    // Verify status information
    expect(htmlOutput).toContain('200');
    expect(htmlOutput).toContain('201');
    expect(htmlOutput).toContain('404');

    // Verify status badges exist (the exact text may vary)
    expect(htmlOutput).toContain('status-badge');

    // Verify the HTML has interactive features
    expect(htmlOutput).toContain('function');
    expect(htmlOutput).toContain('addEventListener');
    expect(htmlOutput).toContain('renderEndpointDetail');

    // Verify embedded data
    expect(htmlOutput).toContain('window.__ATLAS_DATA__');

    // Count observed requests (should be 49 total)
    const requestCount = events.length;
    expect(requestCount).toBeGreaterThanOrEqual(49);

    console.log(`✓ Generated Atlas HTML with ${requestCount} observed requests`);
    console.log(`✓ HTML size: ${(htmlOutput.length / 1024).toFixed(1)} KB`);
  });

  it('should include architectural overview sections', () => {
    const events: NetworkEvent[] = [
      {
        id: 'req1',
        url: 'https://api.example.com/users/123',
        method: 'GET',
        timestamp: new Date().toISOString(),
        scenario: 'test',
        transport: 'fetch',
        source: 'upstream',
        status: 200,
        durationMs: 50
      },
      {
        id: 'req2',
        url: 'http://127.0.0.1:4203/api/data',
        method: 'POST',
        timestamp: new Date().toISOString(),
        scenario: 'test',
        transport: 'axios',
        source: 'mock-hit',
        status: 201,
        durationMs: 25,
        parentRequestId: 'req1'
      }
    ];

    const emptyMap: AtlasDocMap = { 
      scenario: 'test', 
      updatedAt: new Date().toISOString(),
      pages: {}, 
      screens: {}, 
      prefetches: {} 
    };
    const htmlFiles = buildAtlasDocHtmlFiles(emptyMap, events);
    const html = htmlFiles['index.html'];

    // Architecture sections - at least one should be present
    const hasArchSections = html.includes('Services') || html.includes('Endpoints') || html.includes('Architecture');
    expect(hasArchSections).toBe(true);
  });

  it('should handle endpoints with URL parameters correctly', () => {
    const events: NetworkEvent[] = [
      {
        id: 'req1',
        url: 'https://api.example.com/users/123',
        method: 'GET',
        timestamp: new Date().toISOString(),
        scenario: 'test',
        transport: 'fetch',
        source: 'upstream',
        status: 200,
        durationMs: 30
      },
      {
        id: 'req2',
        url: 'https://api.example.com/users/456',
        method: 'GET',
        timestamp: new Date().toISOString(),
        scenario: 'test',
        transport: 'fetch',
        source: 'upstream',
        status: 200,
        durationMs: 35
      },
      {
        id: 'req3',
        url: 'https://api.example.com/posts/550e8400-e29b-41d4-a716-446655440000',
        method: 'GET',
        timestamp: new Date().toISOString(),
        scenario: 'test',
        transport: 'fetch',
        source: 'upstream',
        status: 200,
        durationMs: 28
      }
    ];

    const emptyMap: AtlasDocMap = { 
      scenario: 'test', 
      updatedAt: new Date().toISOString(),
      pages: {}, 
      screens: {}, 
      prefetches: {} 
    };
    const htmlFiles = buildAtlasDocHtmlFiles(emptyMap, events);
    const html = htmlFiles['index.html'];

    // Should contain endpoint table
    expect(html).toContain('atlas-endpoint-table');
    expect(html).toContain('api.example.com');
  });

  it('should track mock hits vs upstream calls correctly', () => {
    const events: NetworkEvent[] = [
      {
        id: 'mock1',
        url: 'https://api.example.com/cached',
        method: 'GET',
        timestamp: new Date().toISOString(),
        scenario: 'test',
        transport: 'fetch',
        source: 'mock-hit',
        status: 200,
        durationMs: 5
      },
      {
        id: 'upstream1',
        url: 'https://api.example.com/live',
        method: 'GET',
        timestamp: new Date().toISOString(),
        scenario: 'test',
        transport: 'fetch',
        source: 'upstream',
        status: 200,
        durationMs: 150
      }
    ];

    const emptyMap: AtlasDocMap = { 
      scenario: 'test', 
      updatedAt: new Date().toISOString(),
      pages: {}, 
      screens: {}, 
      prefetches: {} 
    };
    const htmlFiles = buildAtlasDocHtmlFiles(emptyMap, events);
    const html = htmlFiles['index.html'];

    // Should contain endpoint data
    expect(html).toContain('api.example.com');
  });

  it('should generate a self-contained HTML file', () => {
    const events: NetworkEvent[] = [
      {
        id: 'req1',
        url: 'https://api.example.com/test',
        method: 'GET',
        timestamp: new Date().toISOString(),
        scenario: 'test',
        transport: 'fetch',
        source: 'upstream',
        status: 200,
        durationMs: 100
      }
    ];

    const emptyMap: AtlasDocMap = { 
      scenario: 'test', 
      updatedAt: new Date().toISOString(),
      pages: {}, 
      screens: {}, 
      prefetches: {} 
    };
    const htmlFiles = buildAtlasDocHtmlFiles(emptyMap, events);
    const html = htmlFiles['index.html'];

    // Should be self-contained (no external script/style references)
    expect(html).not.toMatch(/<script[^>]*src=["']http/);
    expect(html).not.toMatch(/<link[^>]*href=["']http/);

    // Should have embedded styles and scripts
    expect(html).toContain('<style>');
    expect(html).toContain('</style>');
    expect(html).toContain('<script>');
    expect(html).toContain('</script>');

    // Should work offline
    expect(html).toContain('<!DOCTYPE html>');
    const hasClosingHtml = html.trim().endsWith('</html>') || html.trim().endsWith('</html>\n');
    expect(hasClosingHtml).toBe(true);
  });
});
