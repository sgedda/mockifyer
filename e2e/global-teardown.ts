import { chromium, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { scrubNetworkEvent } from './lib/scrub-public-atlas';

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
