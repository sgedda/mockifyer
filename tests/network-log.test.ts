import {
  buildNetworkEvent,
  clearFlightRecorder,
  configureFlightRecorder,
  emitMockifyerNetworkEvent,
  redactHeaders,
  sanitizeQueryString,
  sanitizeNetworkEvent,
  sanitizeUrlString,
  toNetworkLogBodyPreview,
  __flightRecorderBuffersForTests,
} from '@sgedda/mockifyer-core';

describe('network-log', () => {
  it('redactHeaders masks sensitive names', () => {
    const out = redactHeaders({
      Authorization: 'secret',
      'Content-Type': 'application/json',
      Cookie: 'a=b',
    });
    expect(out?.Authorization).toBe('[REDACTED]');
    expect(out?.['Content-Type']).toBe('application/json');
    expect(out?.Cookie).toBe('[REDACTED]');
  });

  it('sanitizeQueryString redacts token-like params', () => {
    const redacted = sanitizeQueryString('?api_key=abc&page=1') ?? '';
    expect(decodeURIComponent(redacted)).toContain('[REDACTED]');
    expect(sanitizeQueryString('?page=1')).toContain('page=1');
  });

  it('sanitizeUrlString redacts token-like params in the full URL', () => {
    const redacted = sanitizeUrlString(
      'https://api.example.com/users?access_token=secret&page=1#details'
    );
    expect(redacted).toContain('https://api.example.com/users?');
    expect(decodeURIComponent(redacted)).toContain('access_token=[REDACTED]');
    expect(redacted).toContain('page=1');
    expect(redacted).toContain('#details');
    expect(redacted).not.toContain('secret');
  });

  it('sanitizeUrlString redacts query params in relative URLs', () => {
    const redacted = sanitizeUrlString('/users?token=secret&page=1#details');
    expect(decodeURIComponent(redacted)).toContain('token=[REDACTED]');
    expect(redacted).toContain('page=1');
    expect(redacted).toContain('#details');
    expect(redacted).not.toContain('secret');
  });

  it('sanitizeNetworkEvent strips body previews by default', () => {
    const event = buildNetworkEvent({
      scenario: 'default',
      transport: 'proxy',
      method: 'GET',
      url: 'https://api.example.com/users?token=secret',
      query: '?access_token=also-secret',
      source: 'upstream',
      requestBodyPreview: '{"x":1}',
      responseBodyPreview: '{"y":2}',
    });
    expect(event.requestBodyPreview).toBeUndefined();
    expect(event.responseBodyPreview).toBeUndefined();
    expect(decodeURIComponent(event.query ?? '')).toContain('[REDACTED]');
    expect(event.query).not.toContain('also-secret');
    expect(decodeURIComponent(event.url)).toContain('token=[REDACTED]');
    expect(event.url).not.toContain('secret');
  });

  it('toNetworkLogBodyPreview stringifies objects', () => {
    expect(toNetworkLogBodyPreview({ ok: true })).toContain('ok');
  });

  it('emitMockifyerNetworkEvent keeps body previews for the Metro Atlas stream when dashboard capture is off', async () => {
    const prev = process.env.MOCKIFYER_METRO_STREAM;
    process.env.MOCKIFYER_METRO_STREAM = 'on';
    configureFlightRecorder({ enabled: true, maxEvents: 20 });
    clearFlightRecorder();
    try {
      emitMockifyerNetworkEvent({
        config: { networkLog: { enabled: true, captureBodies: false } },
        scenario: 'default',
        responseBody: { users: [{ id: 1 }] },
        event: {
          method: 'GET',
          url: 'https://api.example.com/users',
          source: 'mock-hit',
          status: 200,
          transport: 'fetch',
        },
      });
      await new Promise((resolve) => setImmediate(resolve));
      const [event] = __flightRecorderBuffersForTests().network;
      expect(event?.responseBodyPreview).toContain('users');
    } finally {
      if (prev === undefined) delete process.env.MOCKIFYER_METRO_STREAM;
      else process.env.MOCKIFYER_METRO_STREAM = prev;
    }
  });

  it('emitMockifyerNetworkEvent captures a short preview after the response turn', async () => {
    configureFlightRecorder({ enabled: true, maxEvents: 20 });
    clearFlightRecorder();
    const payload = { data: 'x'.repeat(20_000) };
    emitMockifyerNetworkEvent({
      config: { networkLog: { enabled: true, captureBodies: true } },
      scenario: 'default',
      requestBody: payload,
      responseBody: payload,
      event: {
        method: 'POST',
        url: 'https://api.example.com/big',
        source: 'upstream',
        status: 200,
        transport: 'fetch',
      },
    });
    expect(__flightRecorderBuffersForTests().network).toHaveLength(0);
    await new Promise((resolve) => setImmediate(resolve));
    const [event] = __flightRecorderBuffersForTests().network;
    expect(event?.responseBodyPreview).toContain('data');
    expect((event?.responseBodyPreview ?? '').length).toBeLessThan(4_000);
    expect(event?.responseBodyTruncated).toBe(true);
    expect(event?.responseBodyRef).toContain('bodies/');
  });

  it('emitMockifyerNetworkEvent keeps a short preview and does not spill bodies over 2MB', async () => {
    const { resetNetworkBodySpillRuntime, NETWORK_BODY_SPILL_MAX_BYTES } =
      require('../packages/mockifyer-core/src/utils/network-body-spill') as typeof import('../packages/mockifyer-core/src/utils/network-body-spill');
    resetNetworkBodySpillRuntime();
    configureFlightRecorder({ enabled: true, maxEvents: 20 });
    clearFlightRecorder();
    const payload = { data: 'x'.repeat(NETWORK_BODY_SPILL_MAX_BYTES + 50) };
    emitMockifyerNetworkEvent({
      config: { networkLog: { enabled: true, captureBodies: true } },
      scenario: 'default',
      responseBody: payload,
      event: {
        method: 'GET',
        url: 'https://api.example.com/oversize',
        source: 'upstream',
        status: 200,
        transport: 'fetch',
      },
    });
    await new Promise((resolve) => setImmediate(resolve));
    const [event] = __flightRecorderBuffersForTests().network;
    expect(event?.responseBodyPreview).toContain('data');
    expect(event?.responseBodyPreview).toContain('[truncated]');
    expect((event?.responseBodyPreview ?? '').length).toBeLessThan(4_000);
    expect(event?.responseBodyRef).toBeUndefined();
    expect(event?.responseBodyTruncated).toBeUndefined();
  });

  it('sanitizeNetworkEvent keeps truncated bodies when captureBodies is on', () => {
    const event = sanitizeNetworkEvent(
      {
        id: '1',
        timestamp: new Date().toISOString(),
        scenario: 'default',
        transport: 'fetch',
        method: 'POST',
        url: 'https://api.example.com/x',
        source: 'mock-hit',
        requestBodyPreview: '{"ok":true}',
      },
      { captureBodies: true, maxEventBytes: 4096 }
    );
    expect(event.requestBodyPreview).toContain('ok');
  });

  it('sanitizeNetworkEvent keeps short preview + bodyRef when event would exceed max bytes', () => {
    const big = JSON.stringify({ data: 'x'.repeat(20_000) });
    const event = sanitizeNetworkEvent(
      {
        id: '1',
        timestamp: new Date().toISOString(),
        scenario: 'default',
        transport: 'fetch',
        method: 'GET',
        url: 'https://api.example.com/big',
        source: 'upstream',
        responseBodyPreview: big,
        responseBodyRef: 'bodies/req-1-res.json',
        responseBodyTruncated: true,
        requestHeaders: { 'x-a': '1'.repeat(5000) },
      },
      { captureBodies: true, maxEventBytes: 3000 }
    );
    expect(event.responseBodyRef).toBe('bodies/req-1-res.json');
    expect(event.responseBodyTruncated).toBe(true);
    expect(event.responseBodyPreview).toBeTruthy();
    expect((event.responseBodyPreview as string).length).toBeLessThan(big.length);
    expect(event.requestHeaders).toBeUndefined();
  });
});

describe('network-body-spill', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const os = require('os') as typeof import('os');

  it('scheduleNetworkBodySpill spills small bodies without truncated flag', () => {
    const {
      scheduleNetworkBodySpill,
      resetNetworkBodySpillRuntime,
      flushNetworkBodySpillsToDir,
      setNetworkBodySpillEnabled,
    } = require('../packages/mockifyer-core/src/utils/network-body-spill') as typeof import('../packages/mockifyer-core/src/utils/network-body-spill');

    resetNetworkBodySpillRuntime();
    setNetworkBodySpillEnabled(true);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-body-small-'));
    try {
      const small = JSON.stringify({ ok: true, id: 'trip-1' });
      const refs = scheduleNetworkBodySpill({
        eventId: 'e-small',
        requestId: 'req-small',
        responseBodyText: small,
      });
      expect(refs.responseBodyRef).toBe('bodies/req-small-res.json');
      expect(refs.responseBodyTruncated).toBeUndefined();
      flushNetworkBodySpillsToDir(dir);
      const onDisk = fs.readFileSync(path.join(dir, refs.responseBodyRef!), 'utf8');
      expect(JSON.parse(onDisk)).toEqual({ ok: true, id: 'trip-1' });
    } finally {
      resetNetworkBodySpillRuntime();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('scheduleNetworkBodySpill writes oversized bodies and returns refs', async () => {
    const {
      scheduleNetworkBodySpill,
      resetNetworkBodySpillRuntime,
      NETWORK_LOG_INLINE_BODY_PREVIEW_BYTES,
      setNetworkBodySpillEnabled,
    } = require('../packages/mockifyer-core/src/utils/network-body-spill') as typeof import('../packages/mockifyer-core/src/utils/network-body-spill');

    resetNetworkBodySpillRuntime();
    setNetworkBodySpillEnabled(true);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-body-spill-'));
    try {
      const big = 'y'.repeat(NETWORK_LOG_INLINE_BODY_PREVIEW_BYTES + 500);
      const refs = scheduleNetworkBodySpill({
        eventId: 'e1',
        requestId: 'req-spill-1',
        responseBodyText: big,
        outputDir: dir,
      });
      expect(refs.responseBodyRef).toBe('bodies/req-spill-1-res.json');
      expect(refs.responseBodyTruncated).toBe(true);
      // Allow async write to finish
      await new Promise((r) => setTimeout(r, 50));
      const spilled = fs.readFileSync(path.join(dir, refs.responseBodyRef!), 'utf8');
      expect(spilled).toBe(big);
      const {
        getNetworkBodySpillSnapshot,
      } = require('../packages/mockifyer-core/src/utils/network-body-spill') as typeof import('../packages/mockifyer-core/src/utils/network-body-spill');
      expect(getNetworkBodySpillSnapshot()['bodies/req-spill-1-res.json']).toBe(big);
    } finally {
      resetNetworkBodySpillRuntime();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('flushNetworkBodySpillsToDir writes buffered bodies even if async write was skipped', () => {
    const {
      scheduleNetworkBodySpill,
      flushNetworkBodySpillsToDir,
      resetNetworkBodySpillRuntime,
      NETWORK_LOG_INLINE_BODY_PREVIEW_BYTES,
      setNetworkBodySpillEnabled,
    } = require('../packages/mockifyer-core/src/utils/network-body-spill') as typeof import('../packages/mockifyer-core/src/utils/network-body-spill');

    resetNetworkBodySpillRuntime();
    setNetworkBodySpillEnabled(true);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-body-flush-'));
    try {
      const big = 'z'.repeat(NETWORK_LOG_INLINE_BODY_PREVIEW_BYTES + 100);
      const refs = scheduleNetworkBodySpill({
        eventId: 'e2',
        requestId: 'req-flush-1',
        responseBodyText: big,
      });
      expect(refs.responseBodyRef).toBe('bodies/req-flush-1-res.json');
      expect(fs.existsSync(path.join(dir, 'bodies'))).toBe(false);
      const n = flushNetworkBodySpillsToDir(dir);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(fs.readFileSync(path.join(dir, refs.responseBodyRef!), 'utf8')).toBe(big);
    } finally {
      resetNetworkBodySpillRuntime();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('prettyPrintJsonText indents compact and soft-pretties truncated JSON', () => {
    const { prettyPrintJsonText } =
      require('../packages/mockifyer-core/src/utils/json-pretty') as typeof import('../packages/mockifyer-core/src/utils/json-pretty');
    const pretty = prettyPrintJsonText('{"success":true,"data":{"name":"Service"}}');
    expect(pretty).toContain('\n');
    expect(pretty).toContain('"success": true');
    const soft = prettyPrintJsonText('{"success":true,"data":{"name":"Ser');
    expect(soft).toContain('\n');
    expect(soft).toContain('"success"');
  });

  it('prettyPrintJsonText formats GraphQL request bodies for readable copy', () => {
    const { prettyPrintJsonText } =
      require('../packages/mockifyer-core/src/utils/json-pretty') as typeof import('../packages/mockifyer-core/src/utils/json-pretty');
    const raw = JSON.stringify({
      query: 'query Q { a { b } }',
      variables: { id: 1 },
    });
    const pretty = prettyPrintJsonText(raw);
    expect(pretty.startsWith('query Q')).toBe(true);
    expect(pretty).toContain('# Variables');
  });

  it('buildAtlasBodiesSearchCorpus prefers spilled full bodies over previews', () => {
    const { buildAtlasBodiesSearchCorpus } =
      require('../packages/mockifyer-core/src/utils/atlas-doc-html') as typeof import('../packages/mockifyer-core/src/utils/atlas-doc-html');

    const corpus = buildAtlasBodiesSearchCorpus(
      [
        {
          id: 'e1',
          timestamp: '2026-09-06T10:00:00.000Z',
          scenario: 'default',
          transport: 'fetch',
          method: 'GET',
          url: 'https://example.com/a',
          source: 'upstream',
          responseBodyPreview: '{"preview":true}',
          responseBodyRef: 'bodies/e1-res.json',
        },
      ],
      {
        readSpillText: (rel) =>
          rel === 'bodies/e1-res.json' ? '{"full":"unique-search-token-xyz"}' : undefined,
      }
    );
    expect(corpus.e1).toContain('unique-search-token-xyz');
    expect(corpus.e1).not.toContain('preview');
  });
});
