import { setupMockifyer } from '@sgedda/mockifyer-fetch';
import express from 'express';

// Start stub server
const app = express();
app.use(express.json());

app.get('/weather', (req, res) => {
  res.json({
    location: { name: req.query.city || 'London', country: 'United Kingdom' },
    current: { temp_c: 13.0, condition: { text: 'Partly cloudy' }, humidity: 76 }
  });
});

app.get('/places', (req, res) => {
  res.json({ name: req.query.city || 'London', place_id: '12345' });
});

app.get('/reviews/:placeId', (req, res) => {
  if (req.query.scenario === 'empty') return res.json([]);
  res.json([
    { id: 1, name: 'Amazing place!', body: 'London is absolutely wonderful.' },
    { id: 2, name: 'Great experience', body: 'Had a fantastic time exploring.' },
    { id: 3, name: 'Loved it', body: 'The blend of old and new is remarkable.' }
  ]);
});

app.get('/currency', (req, res) => {
  if (req.query.scenario === 'error') {
    return res.status(503).json({ error: 'Service temporarily unavailable' });
  }
  res.json({
    base: req.query.from || 'USD',
    rates: { [req.query.to || 'EUR']: 0.92345 },
    date: '2026-11-10'
  });
});

const server = app.listen(3003, () => console.log('Stubs on :3003'));

process.env.MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API = 'false';
process.env.MOCKIFYER_RECORD_RESPONSES = 'true';

async function recordScenario(scenario) {
  console.log(`\n=== Recording ${scenario} ===`);
  
  setupMockifyer({
    recordMode: true,
    recordResponses: true,
    mockDataPath: './mock-data',
    defaultScenario: scenario,
    provider: 'filesystem',
    domainPathRulesMode: 'record_all',
    useGlobalFetch: true,
    dateManipulation: { fixedDate: '2026-11-10T12:00:00.000Z' }
  });

  const headers = { 'x-mockifyer-request-id': `record-${scenario}` };
  
  await fetch('http://localhost:3003/weather?city=London', { headers });
  await new Promise(r => setTimeout(r, 200));
  
  await fetch('http://localhost:3003/places?city=London', { headers });
  await new Promise(r => setTimeout(r, 200));
  
  const reviewsUrl = scenario === 'empty-reviews' 
    ? 'http://localhost:3003/reviews/12345?scenario=empty'
    : 'http://localhost:3003/reviews/12345';
  await fetch(reviewsUrl, { headers });
  await new Promise(r => setTimeout(r, 200));
  
  const currencyUrl = scenario === 'currency-error'
    ? 'http://localhost:3003/currency?from=USD&to=EUR&scenario=error'
    : 'http://localhost:3003/currency?from=USD&to=EUR';
  await fetch(currencyUrl, { headers }).catch(() => {});
  
  await new Promise(r => setTimeout(r, 500));
  console.log(`✓ ${scenario} recorded`);
}

(async () => {
  await recordScenario('default');
  await recordScenario('empty-reviews');
  await recordScenario('currency-error');
  
  server.close();
  console.log('\n✅ All scenarios recorded!');
})();
