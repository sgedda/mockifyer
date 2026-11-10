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
    // Record weather API (localhost stub)
    console.log('→ Recording Weather API...');
    const weatherRes = await fetch(
      'http://localhost:3003/weather?city=London',
      { headers }
    );
    console.log(`  Status: ${weatherRes.status}`);
    await weatherRes.json();
    console.log('  ✓ Recorded');
    
    // Wait for async file write (response body triggers the update)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Record places API (localhost stub)
    console.log('\n→ Recording Places API...');
    const placesRes = await fetch(
      'http://localhost:3003/places?city=London',
      { headers }
    );
    console.log(`  Status: ${placesRes.status}`);
    const places = await placesRes.json();
    console.log('  ✓ Recorded');
    
    await new Promise(resolve => setImmediate(resolve));
    
    // Record reviews API (second-level hop, using actual place_id)
    console.log('\n→ Recording Reviews API...');
    const reviewsRes = await fetch(
      `http://localhost:3003/reviews/${places.place_id}`,
      { headers }
    );
    console.log(`  Status: ${reviewsRes.status}`);
    await reviewsRes.json();
    console.log('  ✓ Recorded');
    
    await new Promise(resolve => setImmediate(resolve));
    
    // Record currency API (localhost stub)
    console.log('\n→ Recording Currency API...');
    const currencyRes = await fetch(
      'http://localhost:3003/currency?from=USD&to=EUR',
      { headers }
    );
    console.log(`  Status: ${currencyRes.status}`);
    await currencyRes.json();
    console.log('  ✓ Recorded');
    
    // Wait for all async writes to complete
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n✅ All mocks recorded!');
    console.log('Mock files saved to: mock-data/default/\n');
    
  } catch (error) {
    console.error('\n❌ Recording failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

recordMocks();
