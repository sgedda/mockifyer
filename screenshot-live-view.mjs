#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'fs';

const now = Date.now();
const sampleEvents = [
  // Root request 1 - Mock GET with children
  { id: 'root-1', requestId: 'root-1', method: 'GET', url: 'https://api.mockifyer.dev/v1/users', path: '/v1/users', status: 200, timestamp: new Date(now).toISOString(), durationMs: 145, source: 'mock', host: 'api.mockifyer.dev' },
  // Child of root-1 - Live POST
  { id: 'child-1-1', requestId: 'child-1-1', parentRequestId: 'root-1', method: 'POST', url: 'https://api.mockifyer.dev/v1/audit/log', path: '/v1/audit/log', status: 201, timestamp: new Date(now + 50).toISOString(), durationMs: 23, source: 'live', host: 'api.mockifyer.dev' },
  // Root request 2 - Live POST with error child
  { id: 'root-2', requestId: 'root-2', method: 'POST', url: 'https://api.mockifyer.dev/v1/users', path: '/v1/users', status: 201, timestamp: new Date(now + 1000).toISOString(), durationMs: 89, source: 'live', host: 'api.mockifyer.dev' },
  // Child of root-2 - Mock GET (profile enrichment)
  { id: 'child-2-1', requestId: 'child-2-1', parentRequestId: 'root-2', method: 'GET', url: 'https://api.mockifyer.dev/v1/profiles/defaults', path: '/v1/profiles/defaults', status: 200, timestamp: new Date(now + 1050).toISOString(), durationMs: 12, source: 'mock', host: 'api.mockifyer.dev' },
  // Child of root-2 - Live POST (webhook) - ERROR
  { id: 'child-2-2', requestId: 'child-2-2', parentRequestId: 'root-2', method: 'POST', url: 'https://webhooks.example.com/new-user', path: '/new-user', status: 503, timestamp: new Date(now + 1060).toISOString(), durationMs: 5032, source: 'live', host: 'webhooks.example.com', anomalyFlags: ['http_error_status', 'slow_response'] },
  // Root request 3 - Mock GraphQL
  { id: 'root-3', requestId: 'root-3', method: 'POST', url: 'https://api.mockifyer.dev/graphql', path: '/graphql', status: 200, timestamp: new Date(now + 2000).toISOString(), durationMs: 198, source: 'mock', host: 'api.mockifyer.dev' },
  // Child of root-3 - Mock GET (posts detail)
  { id: 'child-3-1', requestId: 'child-3-1', parentRequestId: 'root-3', method: 'GET', url: 'https://api.mockifyer.dev/v1/posts/1', path: '/v1/posts/1', status: 200, timestamp: new Date(now + 2100).toISOString(), durationMs: 45, source: 'mock', host: 'api.mockifyer.dev' },
  // Root request 4 - Live DELETE with 404
  { id: 'root-4', requestId: 'root-4', method: 'DELETE', url: 'https://api.mockifyer.dev/v1/users/999', path: '/v1/users/999', status: 404, timestamp: new Date(now + 3000).toISOString(), durationMs: 45, source: 'live', host: 'api.mockifyer.dev', anomalyFlags: ['http_error_status'] },
  // Root request 5 - Live GET analytics (slow)
  { id: 'root-5', requestId: 'root-5', method: 'GET', url: 'https://analytics.mockifyer.dev/api/stats', path: '/api/stats', status: 200, timestamp: new Date(now + 4000).toISOString(), durationMs: 3245, source: 'live', host: 'analytics.mockifyer.dev', anomalyFlags: ['slow_response'] },
];

async function screenshotLiveView(version, colorScheme, viewport) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport, colorScheme });
  
  const htmlPath = `/tmp/atlas-comparison/${version}/live.html`;
  await page.goto(`file://${htmlPath}`);
  
  // Wait for page to be ready
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  
  // Inject hops via the ingest function
  console.log(`Injecting ${sampleEvents.length} hops into ${version} ${colorScheme} view...`);
  await page.evaluate((events) => {
    if (typeof ingest !== 'function') {
      throw new Error('ingest function not found');
    }
    events.forEach(evt => {
      ingest(evt);
    });
  }, sampleEvents);
  
  // Wait for hops to render
  await page.waitForTimeout(1000);
  
  // Verify hops are visible
  const hopCount = await page.evaluate(() => {
    const rows = document.querySelectorAll('#hops .row');
    return rows.length;
  });
  
  if (hopCount === 0) {
    throw new Error(`No hops rendered in ${version} ${colorScheme} view`);
  }
  
  console.log(`${hopCount} hops rendered in ${version} ${colorScheme} view`);
  
  // Expand all trees (press 'e' key or click expand buttons)
  await page.keyboard.press('e');
  await page.waitForTimeout(500);
  
  // Verify trees are expanded
  const expandedCount = await page.evaluate(() => {
    const expanded = document.querySelectorAll('.row.expanded, .row .children');
    return expanded.length;
  });
  
  console.log(`${expandedCount} expanded/nested elements visible`);
  
  const viewportName = viewport.width === 390 ? 'mobile' : 'desktop';
  const outputPath = `/opt/cursor/artifacts/atlas-screenshots/${version}/live-${colorScheme}-${viewportName}.png`;
  
  await page.screenshot({ 
    path: outputPath,
    fullPage: viewportName === 'mobile'
  });
  
  console.log(`Saved ${outputPath}`);
  
  await browser.close();
}

async function screenshotDocTraceExpanded(version, colorScheme) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ 
    viewport: { width: 1280, height: 800 },
    colorScheme 
  });
  
  const htmlPath = `/tmp/atlas-comparison/${version}/index.html`;
  await page.goto(`file://${htmlPath}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  
  // Click Trace tab
  await page.click('button[data-view="trace"]');
  await page.waitForTimeout(300);
  
  // Click "Expand trees" button
  const expandBtn = await page.$('button:has-text("Expand trees")');
  if (expandBtn) {
    await expandBtn.click();
    await page.waitForTimeout(500);
  } else {
    console.log('No "Expand trees" button found, trying keyboard shortcut');
    await page.keyboard.press('e');
    await page.waitForTimeout(500);
  }
  
  const outputPath = `/opt/cursor/artifacts/atlas-screenshots/${version}/doc-trace-expanded-${colorScheme}.png`;
  
  await page.screenshot({ 
    path: outputPath,
    fullPage: true
  });
  
  console.log(`Saved ${outputPath}`);
  
  await browser.close();
}

// Screenshot all live views and doc trace tabs
console.log('Starting live view and expanded trace screenshots...\n');

// Live views - AFTER
await screenshotLiveView('after', 'light', { width: 1280, height: 800 });
await screenshotLiveView('after', 'dark', { width: 1280, height: 800 });
await screenshotLiveView('after', 'light', { width: 390, height: 844 });

// Live views - BEFORE
await screenshotLiveView('before', 'light', { width: 1280, height: 800 });
await screenshotLiveView('before', 'dark', { width: 1280, height: 800 });
await screenshotLiveView('before', 'light', { width: 390, height: 844 });

// Doc trace expanded - AFTER
await screenshotDocTraceExpanded('after', 'light');
await screenshotDocTraceExpanded('after', 'dark');

// Doc trace expanded - BEFORE
await screenshotDocTraceExpanded('before', 'light');
await screenshotDocTraceExpanded('before', 'dark');

console.log('\n✅ All screenshots complete!');
