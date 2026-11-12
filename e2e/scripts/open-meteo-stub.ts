#!/usr/bin/env tsx
/**
 * Minimal Open-Meteo API stub for e2e tests.
 * Responds to /v1/forecast with realistic fixture data based on latitude.
 * Usage: tsx open-meteo-stub.ts [port]
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';

const PORT = parseInt(process.env.OPEN_METEO_STUB_PORT || process.argv[2] || '9100', 10);

// Fixture responses for known test locations
const FIXTURES: Record<string, any> = {
  // Athens (latitude=37.9838, longitude=23.7275) - used in scratch test
  '37.9838': {
    latitude: 37.9838,
    longitude: 23.7275,
    generationtime_ms: 0.123,
    utc_offset_seconds: 7200,
    timezone: 'Europe/Athens',
    timezone_abbreviation: 'EET',
    elevation: 126.0,
    current_units: {
      time: 'iso8601',
      interval: 'seconds',
      temperature_2m: '°C',
      weather_code: 'wmo code',
      wind_speed_10m: 'km/h',
    },
    current: {
      time: new Date().toISOString().split('T')[0] + 'T12:00',
      interval: 900,
      temperature_2m: 22.5,
      weather_code: 1,
      wind_speed_10m: 12.3,
    },
    daily_units: {
      time: 'iso8601',
      temperature_2m_max: '°C',
      temperature_2m_min: '°C',
      precipitation_probability_max: '%',
    },
    daily: {
      time: [
        new Date().toISOString().split('T')[0],
        new Date(Date.now() + 86400000).toISOString().split('T')[0],
        new Date(Date.now() + 172800000).toISOString().split('T')[0],
      ],
      temperature_2m_max: [25.2, 26.1, 24.8],
      temperature_2m_min: [18.3, 19.1, 18.7],
      precipitation_probability_max: [10, 20, 15],
    },
  },
  // Bermuda (latitude=32.2942, longitude=-64.7839)
  '32.2942': {
    latitude: 32.2942,
    longitude: -64.7839,
    generationtime_ms: 0.098,
    utc_offset_seconds: -14400,
    timezone: 'America/Bermuda',
    timezone_abbreviation: 'AST',
    elevation: 5.0,
    current_units: {
      time: 'iso8601',
      interval: 'seconds',
      temperature_2m: '°C',
      weather_code: 'wmo code',
      wind_speed_10m: 'km/h',
    },
    current: {
      time: new Date().toISOString().split('T')[0] + 'T14:00',
      interval: 900,
      temperature_2m: 26.8,
      weather_code: 2,
      wind_speed_10m: 15.7,
    },
    daily_units: {
      time: 'iso8601',
      temperature_2m_max: '°C',
      temperature_2m_min: '°C',
      precipitation_probability_max: '%',
    },
    daily: {
      time: [
        new Date().toISOString().split('T')[0],
        new Date(Date.now() + 86400000).toISOString().split('T')[0],
        new Date(Date.now() + 172800000).toISOString().split('T')[0],
      ],
      temperature_2m_max: [28.3, 27.9, 28.5],
      temperature_2m_min: [23.1, 22.8, 23.4],
      precipitation_probability_max: [30, 40, 35],
    },
  },
};

function findFixture(lat: string | null): any {
  if (!lat) return null;
  const latNum = parseFloat(lat);
  // Find closest fixture by latitude
  let closest = null;
  let minDiff = Infinity;
  for (const [fixtureLat, data] of Object.entries(FIXTURES)) {
    const diff = Math.abs(parseFloat(fixtureLat) - latNum);
    if (diff < minDiff) {
      minDiff = diff;
      closest = data;
    }
  }
  return minDiff < 1.0 ? closest : null; // Within 1 degree
}

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  
  if (url.pathname === '/v1/forecast') {
    const lat = url.searchParams.get('latitude');
    const fixture = findFixture(lat);
    
    if (fixture) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(fixture));
      console.log(`[stub] → 200 ${req.url} (lat=${lat})`);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No fixture for this latitude' }));
      console.log(`[stub] → 404 ${req.url} (lat=${lat}, no fixture)`);
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    console.log(`[stub] → 404 ${req.url}`);
  }
}

const server = createServer(handleRequest);

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[stub] Open-Meteo stub listening on http://127.0.0.1:${PORT}`);
  console.log(`[stub] Known fixtures: ${Object.keys(FIXTURES).join(', ')}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[stub] SIGTERM received, closing');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('[stub] SIGINT received, closing');
  server.close(() => process.exit(0));
});
