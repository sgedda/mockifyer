import { chromium, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

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
    
    // Save events to temporary file
    const eventsFile = path.join(atlasOutputDir, 'network-events.json');
    fs.writeFileSync(eventsFile, JSON.stringify(networkEvents, null, 2));
    
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
      
      const files = buildAtlasDocHtmlFiles(map, networkEvents, {
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
