/**
 * Sync mock files via Metro REST API
 * 
 * This is an alternative to the direct file sync script.
 * It calls Metro's REST API endpoint to trigger sync.
 * 
 * Usage:
 *   npm run sync:mocks:api
 *   # or
 *   ts-node scripts/sync-via-api.ts
 */

const fetch = require('node-fetch');

const METRO_PORT = process.env.METRO_PORT || '8081';
const SYNC_URL = `http://localhost:${METRO_PORT}/mockifyer-sync`;
const STATUS_URL = `http://localhost:${METRO_PORT}/mockifyer-sync/status`;

async function triggerSync() {
  try {
    console.log(`🔄 Triggering sync via Metro REST API...`);
    console.log(`   Endpoint: ${SYNC_URL}\n`);
    
    const response = await fetch(SYNC_URL);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Successfully synced ${result.filesSynced} file(s)`);
      if (result.syncedFiles && result.syncedFiles.length > 0) {
        console.log(`   Files: ${result.syncedFiles.join(', ')}`);
      }
      console.log(`📁 Files saved to: ./mock-data/`);
      if (result.timestamp) {
        console.log(`⏰ Sync time: ${new Date(result.timestamp).toLocaleString()}`);
      }
    } else {
      console.log(`⚠️  Sync result:`, result.message || result.error);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }
  } catch (error: any) {
    console.error('❌ Error triggering sync:', error.message);
    console.log('\n💡 Tips:');
    console.log(`   - Make sure Metro is running on port ${METRO_PORT}`);
    console.log(`   - Check Metro logs for [MockSync] messages`);
    console.log(`   - Try: npm start (to start Metro)`);
    process.exit(1);
  }
}

async function checkStatus() {
  try {
    console.log(`📊 Checking sync status...`);
    console.log(`   Endpoint: ${STATUS_URL}\n`);
    
    const response = await fetch(STATUS_URL);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const status = await response.json();
    
    console.log('Sync Status:');
    console.log(`   Auto-sync enabled: ${status.autoSyncEnabled ? '✅ Yes' : '❌ No'}`);
    console.log(`   Sync in progress: ${status.syncInProgress ? '⏳ Yes' : '✅ No'}`);
    console.log(`   Last sync: ${status.lastSyncTime ? new Date(status.lastSyncTime).toLocaleString() : 'Never'}`);
    console.log(`   Project path: ${status.projectMockDataPath}`);
  } catch (error: any) {
    console.error('❌ Error checking status:', error.message);
    console.log('\n💡 Make sure Metro is running on port', METRO_PORT);
  }
}

// Main
const args = process.argv.slice(2);
if (args.includes('--status') || args.includes('-s')) {
  checkStatus();
} else {
  triggerSync();
}

