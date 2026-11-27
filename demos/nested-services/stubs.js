/**
 * Local stub services for recording
 * These simulate external APIs but run locally (no API keys needed)
 */
import express from 'express';

const app = express();
app.use(express.json());

// Weather service stub
app.get('/weather', (req, res) => {
  res.json({
    location: {
      name: req.query.city || 'London',
      country: 'United Kingdom'
    },
    current: {
      temp_c: 13.0,
      condition: { text: 'Partly cloudy' },
      humidity: 76
    }
  });
});

// Places service stub
app.get('/places', (req, res) => {
  res.json({
    name: req.query.city || 'London',
    place_id: '12345'
  });
});

// Reviews service stub (called by gateway after places)
app.get('/reviews/:placeId', (req, res) => {
  const reviews = [
    { id: 1, name: 'Amazing place!', body: 'London is absolutely wonderful.' },
    { id: 2, name: 'Great experience', body: 'Had a fantastic time exploring.' },
    { id: 3, name: 'Loved it', body: 'The blend of old and new is remarkable.' }
  ];
  
  // Empty scenario
  if (req.query.scenario === 'empty') {
    return res.json([]);
  }
  
  res.json(reviews);
});

// Currency service stub
app.get('/currency', (req, res) => {
  // Error scenario
  if (req.query.scenario === 'error') {
    return res.status(503).json({ error: 'Service temporarily unavailable' });
  }
  
  res.json({
    base: req.query.from || 'USD',
    rates: {
      [req.query.to || 'EUR']: 0.92345
    },
    date: '2026-11-10'
  });
});

const PORT = 3003;
app.listen(PORT, () => {
  console.log(`\n🎭 Stub services running on http://localhost:${PORT}`);
  console.log('  GET /weather?city=London');
  console.log('  GET /places?city=London');
  console.log('  GET /reviews/:placeId');
  console.log('  GET /currency?from=USD&to=EUR\n');
});
