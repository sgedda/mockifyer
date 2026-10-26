/**
 * Local mock server for Open-Meteo API
 * Serves committed fixture data so E2E seeding doesn't depend on external APIs
 */

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'node:url';

const PORT = 9999;
const fixturePath = join(__dirname, 'fixtures', 'athens-forecast.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8'));

const server = createServer((req, res) => {
  const parsedUrl = parse(req.url || '', true);
  
  // Only respond to forecast endpoint
  if (parsedUrl.pathname === '/v1/forecast') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(fixture));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Mock Open-Meteo server listening on http://localhost:${PORT}`);
  console.log('Ready to serve fixture data for E2E seeding');
});

// Handle shutdown
process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
