/**
 * Drift Simulator for Mockifyer Showcase
 * 
 * A controllable drift endpoint for demonstrating drift detection on GitHub Pages.
 * Runs on localhost:4290 (configurable via PORT env var) and provides a /api/weather 
 * endpoint with v1 (stable) and v2 (with drift) modes.
 * 
 * Usage:
 *   node drift-simulator.js              # v1 mode (stable)
 *   DRIFT_MODE=v2 node drift-simulator.js  # v2 mode (with drift)
 */

const express = require('express');
const app = express();

const DRIFT_MODE = process.env.DRIFT_MODE || 'v1';
const PORT = process.env.PORT || 4290;

console.log(`\n🎭 Drift Simulator starting in ${DRIFT_MODE} mode on port ${PORT}\n`);

app.get('/api/weather/:city', (req, res) => {
  const { city } = req.params;
  
  const baseWeather = {
    city: city,
    country: 'Demo',
    temperature: 22,
    conditions: 'Sunny',
  };

  let weather;
  if (DRIFT_MODE === 'v2') {
    // v2: Simulated drift for showcase
    weather = {
      ...baseWeather,
      // Breaking: field renamed
      temp_celsius: baseWeather.temperature,  // renamed from temperature
      // Breaking: type changed
      conditions: ['Sunny', 'Clear'],  // changed from string to array
      // Warning: new field added
      humidity: 65,
      // Breaking: field removed (temperature is gone)
    };
    delete weather.temperature;
  } else {
    // v1: Original stable schema
    weather = {
      ...baseWeather,
      timestamp: new Date().toISOString(),
    };
  }

  res.json(weather);
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    mode: DRIFT_MODE,
    endpoints: {
      weather: '/api/weather/:city'
    }
  });
});

app.listen(PORT, () => {
  console.log(`✓ Drift Simulator (${DRIFT_MODE}) listening on http://localhost:${PORT}`);
  console.log(`  Test: curl http://localhost:${PORT}/api/weather/London`);
  console.log(`  Switch mode: DRIFT_MODE=v2 node drift-simulator.js\n`);
});
