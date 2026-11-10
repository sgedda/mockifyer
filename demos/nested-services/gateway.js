import express from 'express';
import { getCurrentDate } from '@sgedda/mockifyer-core';
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

const PORT = 3001;

// Setup Mockifyer with filesystem provider
setupMockifyer({
  recordMode: process.env.RECORD_MODE === 'true',
  mockDataPath: './mock-data',
  defaultScenario: process.env.MOCKIFYER_SCENARIO || 'default',
  provider: 'filesystem',
  dateManipulation: {
    fixedDate: '2026-11-10T12:00:00.000Z'
  },
  domainPathRulesMode: 'record_all',
  useGlobalFetch: true,
  failOnMissingMock: process.env.RECORD_MODE !== 'true'
});

const app = express();
app.use(express.json());

// CORS for local development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', '*');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Mock service endpoints (these would be real services in production)
const WEATHER_API = 'https://api.weatherapi.com';
const PLACES_API = 'https://api.geoapify.com';
const REVIEWS_API = 'https://jsonplaceholder.typicode.com';

/**
 * Weather service - first-level service
 */
async function getWeather(city, requestId) {
  const headers = { 'x-mockifyer-request-id': requestId };
  console.log(`  [Gateway] → Weather API: ${city}`);
  
  const response = await fetch(
    `${WEATHER_API}/v1/current.json?key=demo&q=${city}`,
    { headers }
  );
  
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Reviews service - calls another service (second-level hop)
 */
async function getLocationReviews(city, requestId) {
  const headers = { 'x-mockifyer-request-id': requestId };
  console.log(`  [Gateway] → Places API: ${city}`);
  
  // First call: get place details
  const placesResponse = await fetch(
    `${PLACES_API}/v2/places?text=${city}&format=json&apiKey=demo`,
    { headers }
  );
  
  if (!placesResponse.ok) {
    throw new Error(`Places API error: ${placesResponse.status}`);
  }
  
  const places = await placesResponse.json();
  const placeId = places?.features?.[0]?.properties?.place_id || 1;
  
  // Second call: get reviews for that place (second-level hop!)
  console.log(`    [Places] → Reviews API: place ${placeId}`);
  const reviewsResponse = await fetch(
    `${REVIEWS_API}/posts/${placeId}/comments`,
    { headers }
  );
  
  if (!reviewsResponse.ok) {
    throw new Error(`Reviews API error: ${reviewsResponse.status}`);
  }
  
  return reviewsResponse.json();
}

/**
 * Currency service - first-level service
 */
async function getCurrencyRate(from, to, requestId) {
  const headers = { 'x-mockifyer-request-id': requestId };
  console.log(`  [Gateway] → Currency API: ${from} to ${to}`);
  
  const response = await fetch(
    `https://api.frankfurter.dev/latest?from=${from}&to=${to}`,
    { headers }
  );
  
  if (!response.ok) {
    throw new Error(`Currency API error: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Gateway endpoint: Get comprehensive trip information
 * This endpoint fans out to 3 services, with one making a second-level call
 */
app.get('/api/trip/:city', async (req, res) => {
  const { city } = req.params;
  const requestId = req.headers['x-mockifyer-request-id'] || 
                    `trip-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  
  console.log(`\n[Gateway] Processing trip request for ${city} (request-id: ${requestId})`);
  
  try {
    // Fan out to 3 services in parallel
    // One of them (reviews) will make a second-level call
    const [weather, reviews, currency] = await Promise.all([
      getWeather(city, requestId).catch(e => ({ error: e.message })),
      getLocationReviews(city, requestId).catch(e => ({ error: e.message })),
      getCurrencyRate('USD', 'EUR', requestId).catch(e => ({ error: e.message }))
    ]);
    
    // Assemble response
    const response = {
      requestId,
      timestamp: getCurrentDate().toISOString(),
      city,
      weather: weather.error ? { error: weather.error } : {
        temperature: weather.current?.temp_c,
        condition: weather.current?.condition?.text,
        humidity: weather.current?.humidity
      },
      reviews: reviews.error ? { error: reviews.error, count: 0 } : {
        count: reviews.length,
        latest: reviews.slice(0, 3).map(r => ({
          name: r.name,
          body: r.body?.slice(0, 100)
        }))
      },
      currency: currency.error ? { error: currency.error } : {
        from: currency.base,
        to: Object.keys(currency.rates || {})[0],
        rate: Object.values(currency.rates || {})[0]
      },
      _meta: {
        topology: 'fan-out',
        firstLevelHops: 3,
        secondLevelHops: 1,
        totalApiCalls: 4,
        services: ['weather', 'places+reviews', 'currency'],
        traceId: requestId
      }
    };
    
    console.log(`[Gateway] ✓ Request completed (${response._meta.totalApiCalls} total API calls)`);
    res.json(response);
    
  } catch (error) {
    console.error(`[Gateway] ✗ Request failed:`, error.message);
    res.status(500).json({
      error: 'Failed to fetch trip information',
      message: error.message,
      requestId
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'gateway',
    mockMode: process.env.RECORD_MODE !== 'true',
    timestamp: getCurrentDate().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Gateway service running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:3002`);
  console.log(`🎯 Frontend: http://localhost:5173`);
  console.log(`\nTopology: Fan-out with nested call`);
  console.log(`  Gateway → Weather (1st level)`);
  console.log(`  Gateway → Places → Reviews (2nd level)`);
  console.log(`  Gateway → Currency (1st level)`);
  console.log(`\nTry: curl http://localhost:${PORT}/api/trip/London\n`);
});
