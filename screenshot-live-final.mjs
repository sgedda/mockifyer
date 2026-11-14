#!/usr/bin/env node
import { chromium } from 'playwright';

const now = Date.now();
const sampleEvents = [
  { id: 'root-1', requestId: 'root-1', method: 'GET', url: 'https://api.mockifyer.dev/v1/users', path: '/v1/users', status: 200, timestamp: new Date(now).toISOString(), durationMs: 145, source: 'mock', host: 'api.mockifyer.dev' },
  { id: 'child-1-1', requestId: 'child-1-1', parentRequestId: 'root-1', method: 'POST', url: 'https://api.mockifyer.dev/v1/audit/log', path: '/v1/audit/log', status: 201, timestamp: new Date(now + 50).toISOString(), durationMs: 23, source: 'live', host: 'api.mockifyer.dev' },
  { id: 'root-2', requestId: 'root-2', method: 'POST', url: 'https://api.mockifyer.dev/v1/users', path: '/v1/users', status: 201, timestamp: new Date(now + 1000).toISOString(), durationMs: 89, source: 'live', host: 'api.mockifyer.dev' },
  { id: 'child-2-1', requestId: 'child-2-1', parentRequestId: 'root-2', method: 'GET', url: 'https://api.mockifyer.dev/v1/profiles/defaults', path: '/v1/profiles/defaults', status: 200, timestamp: new Date(now + 1050).toISOString(), durationMs: 12, source: 'mock', host: 'api.mockifyer.dev' },
  { id: 'child-2-2', requestId: 'child-2-2', parentRequestId: 'root-2', method: 'POST', url: 'https://webhooks.example.com/new-user', path: '/new-user', status: 503, timestamp: new Date(now + 1060).toISOString(), durationMs: 5032, source: 'live', host: 'webhooks.example.com', anomalyFlags: ['http_error_status', 'slow_response'] },
  { id: 'root-3', requestId: 'root-3', method: 'POST', url: 'https://api.mockifyer.dev/graphql', path: '/graphql', status: 200, timestamp: new Date(now + 2000).toISOString(), durationMs: 198, source: 'mock', host: 'api.mockifyer.dev' },
  { id: 'child-3-1', requestId: 'child-3-1', parentRequestId: 'root-3', method: 'GET', url: 'https://api.mockifyer.dev/v1/posts/1', path: '/v1/posts/1', status: 200, timestamp: new Date(now + 2100).toISOString(), durationMs: 45, source: 'mock', host: 'api.mockifyer.dev' },
  { id: 'root-4', requestId: 'root-4', method: 'DELETE', url: 'https://api.mockifyer.dev/v1/users/999', path: '/v1/users/999', status: 404, timestamp: new Date(now + 3000).toISOString(), durationMs: 45, source: 'live', host: 'api.mockifyer.dev', anomalyFlags: ['http_error_status'] },
  { id: 'root-5', requestId: 'root-5', method: 'GET', url: 'https://analytics.mockifyer.dev/api/stats', path: '/api/stats', status: 200, timestamp: new Date(now + 4000).toISOString(), durationMs: 3245, source: 'live', host: 'analytics.mockifyer.dev', anomalyFlags: ['slow_response'] },
];

async function screenshotLiveView(colorScheme, viewport) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport, colorScheme });
  
  const htmlPath = `/tmp/atlas-comparison/after/live.html`;
  await page.goto(`file://${htmlPath}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  
  // For dark mode, click the Dark mode button
  if (colorScheme === 'dark') {
    const darkBtn = await page.$('button:has-text("Dark mode")');
    if (darkBtn) {
      await darkBtn.click();
      await page.waitForTimeout(300);
    }
  }
  
  // Inject ingest temporarily via evaluate (not exposed globally in production)
  console.log(`Injecting ${sampleEvents.length} hops into ${colorScheme} view...`);
  const ingestCode = `
    (function() {
      var script = document.querySelector('script');
      if (!script) return;
      var code = script.textContent;
      
      // Extract the ingest function from the IIFE
      var fnMatch = code.match(/function ingest\\([^)]*\\)[\\s\\S]*?(?=\\n  function [a-z]|\\n  var [a-z]|\\n  if \\(!document\\.hidden\\))/);
      if (!fnMatch) {
        console.error('Could not find ingest function');
        return;
      }
      
      // Evaluate it in the page's IIFE scope by monkey-patching
      var origCode = code;
      var patchedCode = origCode.replace(
        /(function ingest\\([^)]*\\)[\\s\\S]*?\\n  \\})/,
        '$1\\nwindow.__tempIngest = ingest;'
      );
      
      if (patchedCode !== origCode) {
        eval(patchedCode.match(/\\(function \\(\\) \\{[\\s\\S]*\\}\\)\\(\\);/)[0]);
      }
    })();
  `;
  
  await page.evaluate(ingestCode);
  
  // Call the temporarily exposed ingest
  await page.evaluate((events) => {
    if (typeof window.__tempIngest === 'function') {
      events.forEach(evt => window.__tempIngest(evt));
      delete window.__tempIngest; // Clean up
    } else {
      console.error('__tempIngest not available');
    }
  }, sampleEvents);
  
  await page.waitForTimeout(1000);
  
  const hopCount = await page.evaluate(() => document.querySelectorAll('#hops .row').length);
  if (hopCount === 0) {
    throw new Error(`No hops rendered in ${colorScheme} view`);
  }
  console.log(`${hopCount} hops rendered in ${colorScheme} view`);
  
  // Expand all trees
  await page.keyboard.press('e');
  await page.waitForTimeout(500);
  
  const viewportName = viewport.width === 390 ? 'mobile' : 'desktop';
  const outputPath = `/opt/cursor/artifacts/atlas-screenshots/after/live-${colorScheme}-${viewportName}.png`;
  
  await page.screenshot({ 
    path: outputPath,
    fullPage: viewportName === 'mobile'
  });
  
  console.log(`Saved ${outputPath}`);
  await browser.close();
}

// Take AFTER screenshots only
console.log('Taking final live view screenshots...\n');

await screenshotLiveView('light', { width: 1280, height: 800 });
await screenshotLiveView('dark', { width: 1280, height: 800 });
await screenshotLiveView('light', { width: 390, height: 844 });

console.log('\n✅ All screenshots complete!');
