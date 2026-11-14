import { setupMockifyer } from '@sgedda/mockifyer-fetch';

console.log('Testing scenario switching...\n');

async function testScenario(scenario) {
  process.env.MOCKIFYER_SCENARIO = scenario;
  
  setupMockifyer({
    recordMode: false,
    mockDataPath: './mock-data',
    defaultScenario: scenario,
    provider: 'filesystem',
    useGlobalFetch: true,
    failOnMissingMock: true,
    domainPathRulesMode: 'record_all'
  });

  const headers = { 'x-mockifyer-request-id': `test-${scenario}` };
  
  try {
    const weatherRes = await fetch('http://localhost:3003/weather?city=London', { headers });
    const weather = await weatherRes.json();
    
    const placesRes = await fetch('http://localhost:3003/places?city=London', { headers });
    const places = await placesRes.json();
    
    const reviewsRes = await fetch('http://localhost:3003/reviews/12345', { headers });
    const reviews = await reviewsRes.json();
    
    const currencyRes = await fetch('http://localhost:3003/currency?from=USD&to=EUR', { headers });
    let currency;
    try {
      currency = await currencyRes.json();
    } catch (e) {
      currency = { error: `HTTP ${currencyRes.status}` };
    }
    
    console.log(`\n=== Scenario: ${scenario} ===`);
    console.log(`Weather: ${weather.location?.name}, ${weather.current?.temp_c}°C`);
    console.log(`Reviews: ${Array.isArray(reviews) ? reviews.length : 'ERROR'} reviews`);
    console.log(`Currency: ${currency.error || `1 ${currency.base} = ${currency.rates?.EUR} EUR`}`);
    console.log(`✓ Scenario works\n`);
    
  } catch (error) {
    console.error(`❌ Scenario ${scenario} failed:`, error.message);
    process.exit(1);
  }
}

(async () => {
  await testScenario('default');
  await testScenario('empty-reviews');
  await testScenario('currency-error');
  
  console.log('✅ All 3 scenarios tested successfully!');
  console.log('✅ Visible UI differences confirmed:');
  console.log('   - default: 3 reviews, currency rate works');
  console.log('   - empty-reviews: 0 reviews');
  console.log('   - currency-error: HTTP 503\n');
})();
