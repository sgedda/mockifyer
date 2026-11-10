import { setupMockifyer } from '@sgedda/mockifyer-fetch';

console.log('📝 Recording mock responses...\n');

// Ensure recorded mocks are immediately replayable
process.env.MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API = 'false';

setupMockifyer({
  recordMode: true,
  mockDataPath: './mock-data',
  defaultScenario: 'default',
  provider: 'filesystem',
  domainPathRulesMode: 'record_all',
  useGlobalFetch: true,
  dateManipulation: {
    fixedDate: '2026-11-10T12:00:00.000Z'
  }
});

async function recordMocks() {
  const requestId = 'demo-record-001';
  const headers = { 'x-mockifyer-request-id': requestId };
  
  try {
    // Record weather API
    console.log('→ Recording Weather API...');
    const weatherRes = await fetch(
      'https://api.weatherapi.com/v1/current.json?key=demo&q=London',
      { headers }
    );
    console.log(`  Status: ${weatherRes.status}`);
    await weatherRes.json();
    console.log('  ✓ Recorded');
    
    // Wait for async file write
    await new Promise(resolve => setImmediate(resolve));
    
    // Record places API
    console.log('\n→ Recording Places API...');
    const placesRes = await fetch(
      'https://api.geoapify.com/v2/places?text=London&format=json&apiKey=demo',
      { headers }
    );
    console.log(`  Status: ${placesRes.status}`);
    await placesRes.json();
    console.log('  ✓ Recorded');
    
    await new Promise(resolve => setImmediate(resolve));
    
    // Record reviews API (second-level hop)
    console.log('\n→ Recording Reviews API...');
    const reviewsRes = await fetch(
      'https://jsonplaceholder.typicode.com/posts/1/comments',
      { headers }
    );
    console.log(`  Status: ${reviewsRes.status}`);
    await reviewsRes.json();
    console.log('  ✓ Recorded');
    
    await new Promise(resolve => setImmediate(resolve));
    
    // Record currency API
    console.log('\n→ Recording Currency API...');
    const currencyRes = await fetch(
      'https://api.frankfurter.dev/latest?from=USD&to=EUR',
      { headers }
    );
    console.log(`  Status: ${currencyRes.status}`);
    await currencyRes.json();
    console.log('  ✓ Recorded');
    
    // Wait for all async writes
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n✅ All mocks recorded!');
    console.log('Mock files saved to: mock-data/default/\n');
    
  } catch (error) {
    console.error('\n❌ Recording failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

recordMocks();
