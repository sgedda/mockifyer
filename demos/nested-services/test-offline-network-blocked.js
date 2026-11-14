import { setupMockifyer } from '@sgedda/mockifyer-fetch';

console.log('Testing TRUE OFFLINE replay (network failures allowed)...\n');

// Override fetch to prove network is blocked
const originalFetch = global.fetch;
const networkCallAttempts = [];

global.fetch = async function(url, options) {
  networkCallAttempts.push(url.toString());
  
  // If Mockifyer intercepts, it won't reach here
  // If it reaches here, throw to simulate network failure
  throw new Error(`Network blocked! Attempted to reach: ${url}`);
};

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
    const requestId = 'test-blocked-001';
    const headers = { 'x-mockifyer-request-id': requestId };
    
    console.log('→ Weather API...');
    const weatherRes = await fetch('http://localhost:3003/weather?city=London', { headers });
    const weather = await weatherRes.json();
    console.log(`  ✓ ${weather.location?.name}, ${weather.current?.temp_c}°C\n`);
    
    console.log('→ Places API...');
    const placesRes = await fetch('http://localhost:3003/places?city=London', { headers });
    const places = await placesRes.json();
    console.log(`  ✓ place_id: ${places.place_id}\n`);
    
    console.log('→ Reviews API...');
    const reviewsRes = await fetch('http://localhost:3003/reviews/12345', { headers });
    const reviews = await reviewsRes.json();
    console.log(`  ✓ ${reviews.length} reviews\n`);
    
    console.log('→ Currency API...');
    const currencyRes = await fetch('http://localhost:3003/currency?from=USD&to=EUR', { headers });
    const currency = await currencyRes.json();
    console.log(`  ✓ 1 ${currency.base} = ${currency.rates?.EUR} EUR\n`);
    
    console.log('✅ All requests served from disk!');
    console.log(`✅ Network attempts: ${networkCallAttempts.length}`);
    console.log('✅ PROOF: Mockifyer intercepted all calls before reaching network guard\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\nNetwork attempts that reached guard:', networkCallAttempts);
    process.exit(1);
  }
}

testOffline();
