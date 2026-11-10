/**
 * Minimal test: record one fetch, read the body, check if file is complete
 */
import { setupMockifyer } from '@sgedda/mockifyer-fetch';
import express from 'express';
import fs from 'fs';
import path from 'path';

const TEST_PORT = 3099;
const MOCK_PATH = './test-recording-output';

// Start test server
const app = express();
app.get('/test', (req, res) => {
  res.json({ message: 'Test response', timestamp: new Date().toISOString() });
});
const server = app.listen(TEST_PORT);

console.log(`Test server on :${TEST_PORT}\n`);

// Setup Mockifyer
process.env.MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API = 'false';

setupMockifyer({
  recordMode: true,
  mockDataPath: MOCK_PATH,
  defaultScenario: 'default',
  provider: 'filesystem',
  useGlobalFetch: true,
  domainPathRulesMode: 'record_all',
});

// Make request
console.log('→ Making request...');
const response = await fetch(`http://localhost:${TEST_PORT}/test?param=value`);
console.log(`  Status: ${response.status}`);

// READ THE BODY (this should trigger response capture)
const data = await response.json();
console.log(`  Data: ${JSON.stringify(data)}`);

// Wait for async file writes
console.log('\n→ Waiting 500ms for setImmediate...');
await new Promise(resolve => setImmediate(resolve));

console.log('→ Waiting another 2s...');
await new Promise(resolve => setTimeout(resolve, 2000));

console.log('→ Waiting another 5s...');
await new Promise(resolve => setTimeout(resolve, 5000));

// Check the file
const mockDir = path.join(MOCK_PATH, 'default', 'localhost', 'test');
if (!fs.existsSync(mockDir)) {
  console.error('\n❌ Mock directory does not exist!');
  server.close();
  process.exit(1);
}

const files = fs.readdirSync(mockDir);
console.log(`\n→ Found ${files.length} mock file(s)`);

if (files.length === 0) {
  console.error('❌ No mock files written!');
  server.close();
  process.exit(1);
}

const mockFile = path.join(mockDir, files[0]);
const mockContent = JSON.parse(fs.readFileSync(mockFile, 'utf-8'));

console.log('\n=== Mock File Content ===');
console.log(JSON.stringify(mockContent, null, 2));

console.log('\n=== Validation ===');
console.log(`response.status: ${mockContent.response.status} (expected: 200)`);
console.log(`response.data: ${mockContent.response.data ? 'present' : 'NULL'}`);
console.log(`responsePending: ${mockContent.responsePending}`);
console.log(`alwaysUseRealApi: ${mockContent.alwaysUseRealApi}`);

if (mockContent.response.status === 200 && mockContent.response.data && !mockContent.responsePending) {
  console.log('\n✅ SUCCESS: Response was fully captured!');
} else {
  console.log('\n❌ FAIL: Response incomplete (responsePending: true or data: null)');
  console.log('\nThis is a Mockifyer recording bug.');
}

server.close();
