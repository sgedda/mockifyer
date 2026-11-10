import { setupMockifyer } from '@sgedda/mockifyer-fetch';

console.log('📝 Recording mock responses...\n');

// Set env var so recorded mocks are immediately replayable
process.env.MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API = 'false';

setupMockifyer({
  recordMode: true,
  mockDataPath: './mock-data',
  provider: 'filesystem',
  domainPathRulesMode: 'record_all',
  useGlobalFetch: true,
  dateManipulation: {
    enabled: true,
    mode: 'freeze',
    fixedDate: '2026-11-10T12:00:00.000Z'
  }
});

async function recordMocks() {
  try {
    // Record weather API call
    console.log('→ Recording weather API (London)...');
    const weatherResponse = await fetch(
      'https://api.openweathermap.org/data/2.5/weather?q=London&appid=demo',
      {
        headers: {
          'x-mockifyer-request-id': 'demo-london-001'
        }
      }
    );
    console.log(`  Status: ${weatherResponse.status}`);
    const weather = await weatherResponse.json();
    console.log(`  ✓ Recorded weather data`);
    
    // Record country API call
    console.log('\n→ Recording places API (GB)...');
    const countryResponse = await fetch(
      'https://restcountries.com/v3.1/alpha/GB',
      {
        headers: {
          'x-mockifyer-request-id': 'demo-london-001'
        }
      }
    );
    console.log(`  Status: ${countryResponse.status}`);
    const country = await countryResponse.json();
    console.log(`  ✓ Recorded country data`);
    
    // Record currency API call
    console.log('\n→ Recording currency API (USD to GBP)...');
    const currencyResponse = await fetch(
      'https://api.frankfurter.dev/latest?from=USD&to=GBP',
      {
        headers: {
          'x-mockifyer-request-id': 'demo-london-001'
        }
      }
    );
    console.log(`  Status: ${currencyResponse.status}`);
    const currency = await currencyResponse.json();
    console.log(`  ✓ Recorded currency data`);
    
    console.log('\n✅ All mocks recorded successfully!');
    console.log('\nMock files saved to: mock-data/default/\n');
    
  } catch (error) {
    console.error('\n❌ Recording failed:', error.message);
    process.exit(1);
  }
}

recordMocks();
