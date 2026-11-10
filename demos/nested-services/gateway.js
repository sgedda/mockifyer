import express from 'express';
import { getCurrentDate } from '@sgedda/mockifyer-core';
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

const PORT = 3001;

// Setup Mockifyer with filesystem provider
setupMockifyer({
  recordMode: process.env.RECORD_MODE === 'true',
  mockDataPath: './mock-data',
  provider: 'filesystem',
  dateManipulation: {
    enabled: true,
    mode: 'freeze'
  },
  domainPathRulesMode: 'record_all',
  useGlobalFetch: true
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

// Mock downstream services
const WEATHER_API = 'https://api.openweathermap.org';
const CURRENCY_API = 'https://api.frankfurter.dev';
const PLACES_API = 'https://restcountries.com';

/**
 * Simulates a downstream weather service
 * In a real system, this would call the real API
 */
async function getWeather(city, requestId) {
  const headers = requestId ? { 'x-mockifyer-request-id': requestId } : {};
  
  // For demo purposes, we use mock data from stub
  const response = await fetch(`${WEATHER_API}/data/2.5/weather?q=${city}&appid=demo`, {
    headers
  });
  
  if (!response.ok) {
    throw new Error(`Weather service error: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Simulates a downstream currency service
 */
async function getCurrencyRate(from, to, requestId) {
  const headers = requestId ? { 'x-mockifyer-request-id': requestId } : {};
  
  const response = await fetch(`${CURRENCY_API}/latest?from=${from}&to=${to}`, {
    headers
  });
  
  if (!response.ok) {
    throw new Error(`Currency service error: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Simulates a downstream places/country info service
 */
async function getCountryInfo(countryCode, requestId) {
  const headers = requestId ? { 'x-mockifyer-request-id': requestId } : {};
  
  const response = await fetch(`${PLACES_API}/v3.1/alpha/${countryCode}`, {
    headers
  });
  
  if (!response.ok) {
    throw new Error(`Places service error: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Gateway endpoint: Get comprehensive trip information
 * This endpoint calls multiple downstream services in a chain
 */
app.get('/api/trip/:city', async (req, res) => {
  const { city } = req.params;
  const requestId = req.headers['x-mockifyer-request-id'] || 
                    `trip-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  
  console.log(`[Gateway] Processing trip request for ${city} (request-id: ${requestId})`);
  
  try {
    // Step 1: Get weather info (first-level hop)
    console.log(`[Gateway] → Calling weather service for ${city}`);
    const weather = await getWeather(city, requestId);
    
    // Extract country code from weather response
    const countryCode = weather?.sys?.country || 'US';
    
    // Step 2: Get country info (second-level hop)
    console.log(`[Gateway] → Calling places service for country ${countryCode}`);
    const countryInfo = await getCountryInfo(countryCode, requestId);
    const country = countryInfo[0];
    
    // Step 3: Get currency exchange rate (third-level hop)
    // This creates a nested chain: gateway -> places -> currency
    const currency = country?.currencies ? Object.keys(country.currencies)[0] : 'USD';
    console.log(`[Gateway] → Calling currency service for ${currency}`);
    const exchangeRate = await getCurrencyRate('USD', currency, requestId);
    
    // Assemble response
    const response = {
      requestId,
      timestamp: getCurrentDate().toISOString(),
      city,
      weather: {
        temperature: weather.main?.temp,
        description: weather.weather?.[0]?.description,
        humidity: weather.main?.humidity
      },
      location: {
        country: country?.name?.common,
        region: country?.region,
        capital: country?.capital?.[0],
        population: country?.population
      },
      currency: {
        code: currency,
        name: country?.currencies?.[currency]?.name,
        exchangeRate: exchangeRate?.rates?.[currency]
      },
      _meta: {
        hops: 3,
        services: ['weather', 'places', 'currency'],
        traceId: requestId
      }
    };
    
    console.log(`[Gateway] ✓ Trip request completed (${response._meta.hops} hops)`);
    res.json(response);
    
  } catch (error) {
    console.error(`[Gateway] ✗ Trip request failed:`, error.message);
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
    mockMode: !process.env.RECORD_MODE,
    timestamp: getCurrentDate().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Gateway service running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:3002`);
  console.log(`🎯 Frontend: http://localhost:5173`);
  console.log(`\nTry: curl http://localhost:${PORT}/api/trip/London\n`);
});
