import { setupMockifyer } from '@sgedda/mockifyer-fetch';

console.log('Testing offline replay...\n');

setupMockifyer({
  recordMode: false,
  mockDataPath: './mock-data',
  defaultScenario: 'default',
  provider: 'filesystem',
  useGlobalFetch: true,
  failOnMissingMock: true,
  dateManipulation: {
    fixedDate: '2026-11-10T12:00:00.000Z'
  },
  domainPathRulesMode: 'record_all'
});

async function testOffline() {
  try {
    const requestId = 'test-offline-001';
    const headers = { 'x-mockifyer-request-id': requestId };
    
    console.log('→ Testing Weather API...');
    const weatherRes = await fetch(
      'https://api.weatherapi.com/v1/current.json?key=demo&q=London',
      { headers }
    );
    console.log(`  Status: ${weatherRes.status}`);
    const weather = await weatherRes.json();
    console.log(`  ✓ Got: ${weather.location?.name}, ${weather.current?.temp_c}°C\n`);
    
    console.log('→ Testing Places API...');
    const placesRes = await fetch(
      'https://api.geoapify.com/v2/places?text=London&format=json&apiKey=demo',
      { headers }
    );
    console.log(`  Status: ${placesRes.status}`);
    const places = await placesRes.json();
    console.log(`  ✓ Got: ${places.features?.[0]?.properties?.name}\n`);
    
    console.log('→ Testing Reviews API...');
    const reviewsRes = await fetch(
      'https://jsonplaceholder.typicode.com/posts/1/comments',
      { headers }
    );
    console.log(`  Status: ${reviewsRes.status}`);
    const reviews = await reviewsRes.json();
    console.log(`  ✓ Got: ${reviews.length} reviews\n`);
    
    console.log('→ Testing Currency API...');
    const currencyRes = await fetch(
      'https://api.frankfurter.dev/latest?from=USD&to=EUR',
      { headers }
    );
    console.log(`  Status: ${currencyRes.status}`);
    const currency = await currencyRes.json();
    console.log(`  ✓ Got: 1 ${currency.base} = ${currency.rates?.EUR} EUR\n`);
    
    console.log('✅ All mocks replayed successfully!\n');
    console.log('Testing with network blocking would prove true offline capability.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testOffline();
