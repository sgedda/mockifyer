import { chromium, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * Scrub sensitive data from network events before public publishing.
 * Redacts auth headers, cookies, and token-like values.
 */
function scrubNetworkEvent(event: any): any {
  const scrubbed = { ...event };
  
  // Scrub request headers
  if (scrubbed.requestHeaders) {
    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries(scrubbed.requestHeaders as Record<string, string>)) {
      const lowerName = name.toLowerCase();
      if (lowerName === 'authorization') {
        headers[name] = value.toLowerCase().startsWith('bearer ') ? 'Bearer <redacted>' : '<redacted>';
      } else if (lowerName === 'cookie' || lowerName === 'set-cookie') {
        headers[name] = '<redacted>';
      } else if (lowerName.includes('token') || lowerName.includes('api-key') || lowerName.includes('apikey')) {
        headers[name] = '<redacted>';
      } else {
        headers[name] = value;
      }
    }
    scrubbed.requestHeaders = headers;
  }
  
  // Scrub response headers
  if (scrubbed.responseHeaders) {
    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries(scrubbed.responseHeaders as Record<string, string>)) {
      const lowerName = name.toLowerCase();
      if (lowerName === 'set-cookie' || lowerName === 'cookie') {
        headers[name] = '<redacted>';
      } else if (lowerName.includes('token') || lowerName.includes('api-key')) {
        headers[name] = '<redacted>';
      } else {
        headers[name] = value;
      }
    }
    scrubbed.responseHeaders = headers;
  }
  
  // Scrub request body (redact token-like fields)
  if (scrubbed.requestBodyPreview) {
    try {
      const body = typeof scrubbed.requestBodyPreview === 'string' 
        ? JSON.parse(scrubbed.requestBodyPreview) 
        : scrubbed.requestBodyPreview;
      scrubbed.requestBodyPreview = JSON.stringify(scrubObjectSecrets(body));
    } catch {
      // Not JSON, leave as-is
    }
  }
  
  // Scrub response body (redact token-like fields)
  if (scrubbed.responseBodyPreview) {
    try {
      const body = typeof scrubbed.responseBodyPreview === 'string'
        ? JSON.parse(scrubbed.responseBodyPreview)
        : scrubbed.responseBodyPreview;
      scrubbed.responseBodyPreview = JSON.stringify(scrubObjectSecrets(body));
    } catch {
      // Not JSON, leave as-is
    }
  }
  
  return scrubbed;
}

/**
 * Redact potential secrets from an object recursively.
 */
function scrubObjectSecrets(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    // Redact long strings that look like tokens/keys
    if (obj.length > 30 && /^[A-Za-z0-9+/=_-]{30,}$/.test(obj)) {
      return '<redacted>';
    }
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => scrubObjectSecrets(item));
  }
  
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      // Redact keys that look like secrets
      if (lowerKey.includes('token') || 
          lowerKey.includes('secret') || 
          lowerKey.includes('password') ||
          lowerKey.includes('apikey') ||
          lowerKey.includes('api_key')) {
        result[key] = '<redacted>';
      } else {
        result[key] = scrubObjectSecrets(value);
      }
    }
    return result;
  }
  
  return obj;
}

/**
 * Global teardown: Generate Atlas documentation from captured network events
 */
async function globalTeardown(config: FullConfig) {
  console.log('\n=== E2E Global Teardown ===\n');
  
  const atlasOutputDir = path.join(__dirname, 'atlas-report');
  
  try {
    // Ensure output directory exists
    if (!fs.existsSync(atlasOutputDir)) {
      fs.mkdirSync(atlasOutputDir, { recursive: true });
    }
    
    console.log('Generating Atlas documentation from e2e network events...');
    
    // Pull network events from dashboard
    const dashboardUrl = process.env.MOCKIFYER_DASHBOARD_URL || 'http://127.0.0.1:3002';
    console.log(`  Dashboard: ${dashboardUrl}`);
    
    let networkEvents: any[] = [];
    try {
      const response = await fetch(`${dashboardUrl}/api/network-events`);
      if (response.ok) {
        const data = await response.json();
        networkEvents = data.events || data;
        console.log(`  ✓ Fetched ${networkEvents.length} network events`);
      } else {
        console.warn(`  ⚠ Dashboard API returned ${response.status}`);
      }
    } catch (err: any) {
      console.warn(`  ⚠ Could not fetch network events: ${err.message}`);
    }
    
    // Scrub sensitive data from events before generating public documentation
    console.log('  Scrubbing sensitive data (auth headers, tokens, cookies)...');
    const scrubbedEvents = networkEvents.map(scrubNetworkEvent);
    console.log(`  ✓ Scrubbed ${scrubbedEvents.length} events`);
    
    // Generate Atlas using direct API calls
    const wwPath = path.resolve(__dirname, '../example-projects/wanderweird-travel');
    
    console.log(`  Scanning: ${wwPath}`);
    console.log(`  Output: ${atlasOutputDir}`);
    
    try {
      // Use Node to generate Atlas directly
      const { scanCodeForEndpoints } = require(path.resolve(__dirname, '../packages/mockifyer-core/dist/utils/atlas-code-scanner.js'));
      const { buildAtlasDocHtmlFiles } = require(path.resolve(__dirname, '../packages/mockifyer-core/dist/utils/atlas-doc-html.js'));
      
      // Scan code
      const mobileScan = scanCodeForEndpoints(path.join(wwPath, 'apps/mobile/src'));
      const servicesScan = scanCodeForEndpoints(path.join(wwPath, 'services'));
      const allEndpoints = [...mobileScan.endpoints, ...servicesScan.endpoints];
      
      console.log(`  ✓ Scanned ${allEndpoints.length} endpoints`);
      
      // Generate HTML
      const map = {
        scenario: 'WanderWeird E2E Run',
        updatedAt: new Date().toISOString(),
        pages: {},
        screens: {},
        prefetches: {}
      };
      
      // Use scrubbed events for public documentation
      const files = buildAtlasDocHtmlFiles(map, scrubbedEvents, {
        scannedEndpoints: allEndpoints
      });
      
      // Write files
      for (const [filename, content] of Object.entries(files)) {
        const filePath = path.join(atlasOutputDir, filename);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, content, 'utf8');
      }
      
      console.log('  ✓ Atlas HTML generated\n');
      
      const indexPath = path.join(atlasOutputDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        const size = fs.statSync(indexPath).size;
        console.log(`  📄 ${indexPath} (${Math.round(size / 1024)}KB)`);
      }
      
    } catch (err: any) {
      console.warn(`  ⚠ Atlas generation warning: ${err.message}`);
      // Don't fail the tests - just warn
    }
    
  } catch (err: any) {
    console.warn(`\n⚠ Atlas teardown warning: ${err.message}`);
    console.warn('Continuing without Atlas report (tests are not affected)\n');
    // Never fail tests due to Atlas generation
  }
  
  console.log('=== Teardown Complete ===\n');
}

export default globalTeardown;
