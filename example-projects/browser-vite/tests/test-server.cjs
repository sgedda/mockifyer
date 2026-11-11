const http = require('http');

const server = http.createServer((req, res) => {
  // CORS headers - allow all origins and headers for testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Content-Type', 'application/json');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  if (req.url === '/test-api') {
    res.writeHead(200);
    res.end(JSON.stringify({ source: 'test-server', timestamp: Date.now() }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

const PORT = 8765;
server.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
});

// Keep alive
process.on('SIGTERM', () => server.close());
