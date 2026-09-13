#!/usr/bin/env node
/**
 * Minimal Metro stand-in for trying `mockifyer-atlas` without a RN app.
 *
 * Terminal A:
 *   node scripts/demo-atlas-metro-server.cjs
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
const {
  createEmptyAtlasDocMap,
} = require('../packages/mockifyer-core/dist/utils/atlas-doc.js');
const {
  writeAtlasDocHtml,
} = require('../packages/mockifyer-core/dist/utils/atlas-doc-html.js');

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

function ensureBodiesDir() {
  const dir = path.join(mockDataPath, 'atlas-html', 'bodies');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeDemoBody(rel, value) {
  const abs = path.join(mockDataPath, 'atlas-html', rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`);
  return rel;
}

function demoResponseBody(partial) {
  const status = partial.status ?? 200;
  const pth = partial.path ?? '/';
  if (status >= 500) {
    return {
      error: 'Internal Server Error',
      message: `Demo failure for ${pth}`,
      status,
      retryable: true,
    };
  }
  if (pth.includes('/widgets/')) {
    const id = pth.split('/').pop();
    return {
      widget: {
        id,
        title: `Widget ${id}`,
        enabled: true,
        items: [
          { id: `${id}-a`, label: 'Alpha' },
          { id: `${id}-b`, label: 'Beta' },
        ],
      },
    };
  }
  if (pth.includes('/config')) {
    return {
      featureFlags: { atlasDemo: true, darkMode: false },
      apiVersion: '2026-09-13',
      endpoints: ['/v1/home', '/v1/config'],
    };
  }
  return {
    user: { id: 'u-demo', name: 'Demo User' },
    feed: [
      { id: 'post-1', title: 'Hello Atlas' },
      { id: 'post-2', title: 'Mock hop stream' },
    ],
    meta: { path: pth, source: partial.source ?? 'upstream' },
  };
}

function demoRequestBody(partial) {
  if ((partial.method ?? 'GET') === 'POST') {
    return {
      action: 'update',
      payload: { widgetId: String(partial.path || '').split('/').pop(), liked: true },
    };
  }
  return {
    method: partial.method ?? 'GET',
    url: partial.url ?? 'https://api.example.com/',
  };
}

function makeHop(partial) {
  const id = partial.id ?? `hop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const method = partial.method ?? 'GET';
  const status = partial.status ?? 200;
  const pathName = partial.path ?? '/';
  const reqBody = demoRequestBody({ ...partial, method, path: pathName });
  const resBody = demoResponseBody({ ...partial, status, path: pathName });
  const reqRel = `bodies/${id}-req.json`;
  const resRel = `bodies/${id}-res.json`;
  ensureBodiesDir();
  writeDemoBody(reqRel, reqBody);
  writeDemoBody(resRel, resBody);
  const reqPreview = JSON.stringify(reqBody);
  const resPreview = JSON.stringify(resBody);
  return {
    id,
    timestamp: new Date().toISOString(),
    scenario: 'demo',
    transport: 'fetch',
    method,
    url: partial.url ?? 'https://api.example.com/',
    host: partial.host ?? 'api.example.com',
    path: pathName,
    status,
    durationMs: partial.durationMs ?? 42,
    source: partial.source ?? 'upstream',
    requestId: partial.requestId ?? id,
    parentRequestId: partial.parentRequestId,
    usage: partial.usage,
    requestHeaders: { accept: 'application/json', 'content-type': 'application/json' },
    responseHeaders: { 'content-type': 'application/json' },
    requestBodyPreview: reqPreview.slice(0, 240),
    responseBodyPreview: resPreview.slice(0, 240),
    requestBodyTruncated: reqPreview.length > 240,
    responseBodyTruncated: resPreview.length > 240,
    requestBodyRef: reqRel,
    responseBodyRef: resRel,
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
    const outDir = path.join(mockDataPath, 'atlas-html');
    fs.mkdirSync(outDir, { recursive: true });
    const events = [...buffer.list()].reverse();
    // Bodies are written when hops are emitted (makeHop). Re-assert refs for safety.
    for (const ev of events) {
      if (!ev.responseBodyRef && ev.id) ev.responseBodyRef = `bodies/${ev.id}-res.json`;
      if (!ev.requestBodyRef && ev.id) ev.requestBodyRef = `bodies/${ev.id}-req.json`;
    }
    const doc = createEmptyAtlasDocMap(
      events[0]?.scenario?.trim() || 'demo',
    );
    // Same writer as Metro createMockSyncMiddleware / mockifyer-atlas `r`/`o`.
    const written = writeAtlasDocHtml(outDir, doc, events);
    const indexPath = path.join(outDir, 'index.html');
    if (written <= 0 || !fs.existsSync(indexPath)) {
      return sendJson(res, 500, {
        success: false,
        error: 'writeAtlasDocHtml wrote 0 files',
        hopCount: events.length,
        outputDir: path.relative(process.cwd(), outDir).split(path.sep).join('/'),
        indexPath,
      });
    }
    return sendJson(res, 201, {
      success: true,
      hopCount: events.length,
      written,
      outputDir: path.relative(process.cwd(), outDir).split(path.sep).join('/'),
      indexPath,
    });
  }


  if (pathname === '/mockifyer-atlas-open' && req.method === 'GET') {
    const hopId = (url.searchParams.get('id') || '').trim();
    const sideParam = (url.searchParams.get('side') || 'html').trim().toLowerCase();
    const side = sideParam === 'req' || sideParam === 'res' ? sideParam : 'html';
    const events = [...buffer.list()].reverse();
    const outDir = path.join(mockDataPath, 'atlas-html');
    fs.mkdirSync(outDir, { recursive: true });
    // Bodies are written when hops are emitted (makeHop). Re-assert refs for safety.
    for (const ev of events) {
      if (!ev.responseBodyRef && ev.id) ev.responseBodyRef = `bodies/${ev.id}-res.json`;
      if (!ev.requestBodyRef && ev.id) ev.requestBodyRef = `bodies/${ev.id}-req.json`;
    }
    const doc = createEmptyAtlasDocMap(events[0]?.scenario?.trim() || 'demo');
    const written = writeAtlasDocHtml(outDir, doc, events);
    if (written <= 0) {
      return sendJson(res, 500, { success: false, error: 'writeAtlasDocHtml wrote 0 files' });
    }
    if (side === 'html') {
      res.writeHead(302, { Location: '/atlas-html/index.html' });
      res.end();
      return;
    }
    const event = (hopId ? events.find((e) => e.id === hopId || e.requestId === hopId) : undefined) || events[0];
    if (!event) return sendJson(res, 404, { success: false, error: 'hop not found' });
    const rel = side === 'req'
      ? (event.requestBodyRef || `bodies/${event.id}-req.json`)
      : (event.responseBodyRef || `bodies/${event.id}-res.json`);
    const abs = path.join(outDir, rel);
    if (!fs.existsSync(abs)) {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, JSON.stringify({ note: 'no body', id: event.id, side }, null, 2) + '\n');
    }
    res.writeHead(302, { Location: `/atlas-html/${rel.split(path.sep).join('/')}` });
    res.end();
    return;
  }

  if (pathname === '/atlas-html' || pathname === '/atlas-html/' || pathname.startsWith('/atlas-html/')) {
    const rel = pathname === '/atlas-html' || pathname === '/atlas-html/'
      ? 'index.html'
      : pathname.slice('/atlas-html/'.length);
    const abs = path.resolve(path.join(mockDataPath, 'atlas-html', rel));
    const root = path.resolve(path.join(mockDataPath, 'atlas-html'));
    if (!abs.startsWith(root) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
      return sendJson(res, 404, { error: 'not found' });
    }
    const ext = path.extname(abs).toLowerCase();
    const type = ext === '.html' ? 'text/html; charset=utf-8'
      : ext === '.json' ? 'application/json; charset=utf-8'
      : 'text/plain; charset=utf-8';
    res.writeHead(200, { 'content-type': type });
    fs.createReadStream(abs).pipe(res);
    return;
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
