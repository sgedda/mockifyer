import { describe, it, expect, beforeAll } from 'vitest';
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

describe('Nested Services Demo', () => {
  beforeAll(() => {
    // Setup Mockifyer in replay mode
    setupMockifyer({
      recordMode: false,
      mockDataPath: './mock-data',
      provider: 'filesystem',
      dateManipulation: {
        enabled: true,
        mode: 'freeze',
        fixedDate: '2026-11-10T12:00:00.000Z'
      },
      domainPathRulesMode: 'record_all',
      useGlobalFetch: true
    });
  });
  
  it('replays weather API call from mock', async () => {
    const response = await fetch(
      'https://api.openweathermap.org/data/2.5/weather?q=London&appid=demo',
      {
        headers: {
          'x-mockifyer-request-id': 'demo-london-001'
        }
      }
    );
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.name).toBe('London');
    expect(data.sys.country).toBe('GB');
    expect(data.main.temp).toBeDefined();
    expect(data.weather[0].description).toBe('broken clouds');
  });
  
  it('replays places API call from mock', async () => {
    const response = await fetch(
      'https://restcountries.com/v3.1/alpha/GB',
      {
        headers: {
          'x-mockifyer-request-id': 'demo-london-001'
        }
      }
    );
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].name.common).toBe('United Kingdom');
    expect(data[0].capital[0]).toBe('London');
    expect(data[0].currencies.GBP).toBeDefined();
    expect(data[0].population).toBe(67215293);
  });
  
  it('replays currency API call from mock', async () => {
    const response = await fetch(
      'https://api.frankfurter.dev/latest?from=USD&to=GBP',
      {
        headers: {
          'x-mockifyer-request-id': 'demo-london-001'
        }
      }
    );
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.base).toBe('USD');
    expect(data.rates.GBP).toBeDefined();
    expect(typeof data.rates.GBP).toBe('number');
  });
  
  it('demonstrates nested service call pattern', async () => {
    // Simulate what the gateway does: call all 3 services in sequence
    const requestId = 'test-nested-001';
    
    // Step 1: Get weather
    const weatherRes = await fetch(
      'https://api.openweathermap.org/data/2.5/weather?q=London&appid=demo',
      { headers: { 'x-mockifyer-request-id': requestId } }
    );
    expect(weatherRes.status).toBe(200);
    const weather = await weatherRes.json();
    
    // Step 2: Get country info using country code from weather
    const countryCode = weather.sys.country;
    expect(countryCode).toBe('GB');
    
    const countryRes = await fetch(
      `https://restcountries.com/v3.1/alpha/${countryCode}`,
      { headers: { 'x-mockifyer-request-id': requestId } }
    );
    expect(countryRes.status).toBe(200);
    const country = await countryRes.json();
    
    // Step 3: Get currency rate using currency from country
    const currency = Object.keys(country[0].currencies)[0];
    expect(currency).toBe('GBP');
    
    const currencyRes = await fetch(
      `https://api.frankfurter.dev/latest?from=USD&to=${currency}`,
      { headers: { 'x-mockifyer-request-id': requestId } }
    );
    expect(currencyRes.status).toBe(200);
    const exchangeRate = await currencyRes.json();
    
    // Verify we got complete data through the chain
    expect(weather.name).toBe('London');
    expect(country[0].name.common).toBe('United Kingdom');
    expect(exchangeRate.rates.GBP).toBeDefined();
  });
});
