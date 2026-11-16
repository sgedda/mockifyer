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
      } else if (lowerName.includes('token') || lowerName.includes('api-key') || lowerName.includes('apikey')) {
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
      // Not JSON - scrub potential secrets in raw text
      scrubbed.requestBodyPreview = scrubTextSecrets(scrubbed.requestBodyPreview as string);
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
      // Not JSON - scrub potential secrets in raw text
      scrubbed.responseBodyPreview = scrubTextSecrets(scrubbed.responseBodyPreview as string);
    }
  }
  
  // Scrub sensitive query parameters from URLs
  if (scrubbed.url) {
    scrubbed.url = scrubUrlSecrets(scrubbed.url);
  }
  if (scrubbed.path) {
    scrubbed.path = scrubUrlSecrets(scrubbed.path);
  }
  if (scrubbed.query) {
    scrubbed.query = scrubUrlSecrets(scrubbed.query);
  }
  
  return scrubbed;
}

/**
 * Redact sensitive query parameters from URLs.
 * Patterns: ?token=..., &apikey=..., &password=..., etc.
 */
function scrubUrlSecrets(url: string): string {
  if (!url || typeof url !== 'string') return url;
  
  let scrubbed = url;
  
  // Redact common secret parameter patterns in query strings
  scrubbed = scrubbed.replace(
    /([?&])(token|apikey|api_key|password|secret|auth|authorization|access_token|key)=[^&#]*/gi,
    '$1$2=<redacted>'
  );
  
  // Redact common secret patterns in hash fragments
  // First pass: handle #param=value at the start of the fragment
  scrubbed = scrubbed.replace(
    /#(token|apikey|api_key|password|secret|auth|authorization|access_token|key)=[^&#]*/gi,
    '#$1=<redacted>'
  );
  
  // Second pass: handle subsequent &param=value or ?param=value within the fragment
  // This regex only matches within hash fragments (after #)
  scrubbed = scrubbed.replace(
    /(#[^?]*[?&])(token|apikey|api_key|password|secret|auth|authorization|access_token|key)=[^&#]*/gi,
    '$1$2=<redacted>'
  );
  
  // Third pass: handle &param=value that comes after other fragment params
  // Match any & within a hash fragment followed by secret params
  const hashIndex = scrubbed.indexOf('#');
  if (hashIndex !== -1) {
    const beforeHash = scrubbed.substring(0, hashIndex + 1);
    let fragment = scrubbed.substring(hashIndex + 1);
    
    // Redact &param=value patterns in the fragment
    fragment = fragment.replace(
      /([&])(token|apikey|api_key|password|secret|auth|authorization|access_token|key)=[^&#]*/gi,
      '$1$2=<redacted>'
    );
    
    scrubbed = beforeHash + fragment;
  }
  
  return scrubbed;
}

/**
 * Redact potential secrets from plain text (non-JSON bodies, etc.).
 */
function scrubTextSecrets(text: string): string {
  if (typeof text !== 'string') return text;
  
  // Redact token-like strings (including JWTs)
  return text.replace(/\b[A-Za-z0-9+/=_.-]{30,}\b/g, '<redacted>');
}

/**
 * Redact potential secrets from an object recursively.
 */
function scrubObjectSecrets(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    // Redact Bearer tokens and similar auth scheme values
    if (/^(Bearer|Basic|OAuth|Digest)\s+/i.test(obj)) {
      return obj.replace(/^(Bearer|Basic|OAuth|Digest)\s+.+$/i, '$1 <redacted>');
    }
    // Redact long strings that look like tokens/keys (including JWTs with dots)
    if (obj.length > 30 && /^[A-Za-z0-9+/=_.-]{30,}$/.test(obj)) {
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
          lowerKey.includes('api_key') ||
          lowerKey.includes('authorization')) {
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
      // Fetch with high limit to capture E2E traffic across all scenarios
      // Note: This still fetches from the current scenario only. A proper fix
      // would iterate all scenarios or use a wildcard, but that requires API changes.
      const response = await fetch(`${dashboardUrl}/api/network-events?limit=10000`);
      if (response.ok) {
        const data = await response.json();
        networkEvents = data.events || data;
        console.log(`  ✓ Fetched ${networkEvents.length} network events`);
        if (networkEvents.length >= 5000) {
          console.warn(`  ⚠ Hit dashboard limit of 5000 events; some traffic may be missing`);
        }
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
