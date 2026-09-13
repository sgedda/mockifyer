#!/usr/bin/env node
/**
 * Minimal Metro stand-in for trying `mockifyer-atlas` without a RN app.
 *
 * Terminal A:
 *   node scripts/demo-atlas-metro-server.mjs
 *
 * Terminal B:
 *   node packages/mockifyer-core/dist/cli/atlas.js --port 8081
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

const {
  getMetroNetworkEventBuffer,
  analyzeMetroNetworkEvents,
} = require('../packages/mockifyer-core/dist/utils/metro-network-stream.js');

const PORT = Number(process.env.METRO_PORT || process.env.PORT || 8081);
const buffer = getMetroNetworkEventBuffer();
const mockDataPath = path.resolve(process.cwd(), 'mock-data');

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function makeHop(partial) {
  const id = partial.id ?? `hop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    timestamp: new Date().toISOString(),
    scenario: 'demo',
    transport: 'fetch',
    method: partial.method ?? 'GET',
    url: partial.url ?? 'https://api.example.com/',
    host: partial.host ?? 'api.example.com',
    path: partial.path ?? '/',
    status: partial.status ?? 200,
    durationMs: partial.durationMs ?? 42,
    source: partial.source ?? 'upstream',
    requestId: partial.requestId ?? id,
    parentRequestId: partial.parentRequestId,
    usage: partial.usage,
  };
}

let seq = 0;
function emitDemoBurst() {
  seq += 1;
  const parentId = `parent-${seq}`;
  buffer.append(
    makeHop({
      id: parentId,
      requestId: parentId,
      method: 'GET',
      path: '/v1/home',
      url: 'https://api.example.com/v1/home',
      status: 200,
      durationMs: 80 + (seq % 5) * 10,
      source: seq % 4 === 0 ? 'mock-hit' : 'upstream',
      usage: { screen: 'Home' },
    })
  );
  for (let i = 0; i < 1 + (seq % 3); i++) {
    buffer.append(
      makeHop({
        id: `${parentId}-c${i}`,
        requestId: `${parentId}-c${i}`,
        parentRequestId: parentId,
        method: i === 1 ? 'POST' : 'GET',
        path: `/v1/home/widgets/${i}`,
        url: `https://api.example.com/v1/home/widgets/${i}`,
        status: i === 2 ? 500 : 200,
        durationMs: i === 2 ? 4200 : 20 + i * 15,
        source: i === 2 ? 'error' : 'upstream',
      })
    );
  }
  if (seq % 2 === 0) {
    buffer.append(
      makeHop({
        method: 'GET',
        path: '/v1/config',
        url: 'https://api.example.com/v1/config',
        status: 200,
        durationMs: 12,
        source: 'mock-hit',
      })
    );
    buffer.append(
      makeHop({
        method: 'GET',
        path: '/v1/config',
        url: 'https://api.example.com/v1/config',
        status: 200,
        durationMs: 11,
        source: 'mock-hit',
      })
    );
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (pathname === '/mockifyer-network-events' && req.method === 'GET') {
    const limit = url.searchParams.get('limit');
    const n = limit != null ? Number.parseInt(limit, 10) : undefined;
    return sendJson(res, 200, {
      success: true,
      size: buffer.size,
      events: buffer.list(Number.isFinite(n) ? n : undefined),
    });
  }

  if (pathname === '/mockifyer-network-events' && req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw || '{}');
      const incoming = [];
      if (parsed.event) incoming.push(parsed.event);
      if (Array.isArray(parsed.events)) incoming.push(...parsed.events);
      for (const e of incoming) buffer.append(e);
      return sendJson(res, 201, { success: true, count: incoming.length, size: buffer.size });
    } catch (e) {
      return sendJson(res, 400, { success: false, error: String(e.message || e) });
    }
  }

  if (pathname === '/mockifyer-network-events/stream' && req.method === 'GET') {
    const backlog = url.searchParams.get('backlog') !== '0';
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    });
    res.write(`event: hello\ndata: ${JSON.stringify({ size: buffer.size })}\n\n`);
    if (backlog) {
      for (const event of [...buffer.list()].reverse()) {
        res.write(`event: hop\ndata: ${JSON.stringify(event)}\n\n`);
      }
    }
    const unsub = buffer.subscribe((event) => {
      try {
        res.write(`event: hop\ndata: ${JSON.stringify(event)}\n\n`);
      } catch {
        unsub();
      }
    });
    const ping = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(ping);
        unsub();
      }
    }, 15000);
    req.on('close', () => {
      clearInterval(ping);
      unsub();
    });
    return;
  }

  if (pathname === '/mockifyer-network-events/analyze' && req.method === 'GET') {
    return sendJson(res, 200, {
      success: true,
      analysis: analyzeMetroNetworkEvents(buffer.list()),
    });
  }

  if (pathname === '/mockifyer-network-events/snapshot' && req.method === 'POST') {
    const dir = path.join(mockDataPath, 'atlas-html');
    fs.mkdirSync(dir, { recursive: true });
    const events = [...buffer.list()].reverse();
    fs.writeFileSync(path.join(dir, 'atlas-events.json'), `${JSON.stringify(events, null, 2)}\n`);
    fs.writeFileSync(
      path.join(dir, 'atlas.ndjson'),
      `${events.map((e) => JSON.stringify(e)).join('\n')}${events.length ? '\n' : ''}`
    );
    return sendJson(res, 201, {
      success: true,
      count: events.length,
      jsonPath: 'mock-data/atlas-html/atlas-events.json',
      ndjsonPath: 'mock-data/atlas-html/atlas.ndjson',
      harPath: 'mock-data/atlas-html/atlas.har',
    });
  }

  if (pathname === '/mockifyer-network-events/render' && req.method === 'POST') {
    return sendJson(res, 201, {
      success: true,
      hopCount: buffer.size,
      browseUrl: '/atlas-html/',
      outputDir: 'mock-data/atlas-html',
    });
  }

  if (pathname === '/mockifyer-network-events/clear' && req.method === 'POST') {
    buffer.clear();
    return sendJson(res, 200, { success: true, size: 0 });
  }

  sendJson(res, 404, { error: `no route ${req.method} ${pathname}` });
});

server.listen(PORT, () => {
  console.log(`[demo-metro] http://localhost:${PORT}`);
  console.log(`[demo-metro] other terminal → node packages/mockifyer-core/dist/cli/atlas.js --port ${PORT}`);
  emitDemoBurst();
  setInterval(emitDemoBurst, 2500);
});
