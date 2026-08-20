import fs from 'fs';
import path from 'path';
import { setupMockifyer } from '@sgedda/mockifyer-fetch';
import {
  decodeFetchBodyText,
  resolvePatchedFetchRequest,
} from '../packages/mockifyer-fetch/src/utils/resolve-patched-fetch-request';

describe('resolvePatchedFetchRequest', () => {
  it('reads method, headers, and JSON body from a Request argument', async () => {
    const request = new Request('https://api.example.com/graphql', {
      method: 'POST',
      headers: {
        authorization: 'Bearer secret-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ query: '{ user { id } }', variables: { id: 7 } }),
    });

    const resolved = await resolvePatchedFetchRequest(request);

    expect(resolved.method.toUpperCase()).toBe('POST');
    expect(resolved.url).toBe('https://api.example.com/graphql');
    expect(resolved.headers.authorization).toBe('Bearer secret-token');
    expect(resolved.body).toEqual({ query: '{ user { id } }', variables: { id: 7 } });
  });

  it('lets init override Request method and headers (Fetch spec)', async () => {
    const request = new Request('https://api.example.com/users', {
      method: 'POST',
      headers: { authorization: 'Bearer from-request' },
      body: JSON.stringify({ name: 'Ada' }),
    });

    const resolved = await resolvePatchedFetchRequest(request, {
      method: 'PUT',
      headers: { authorization: 'Bearer from-init' },
    });

    expect(resolved.method.toUpperCase()).toBe('PUT');
    expect(resolved.headers.authorization).toBe('Bearer from-init');
    expect(resolved.body).toEqual({ name: 'Ada' });
  });

  it('keeps fetch(url, init) JSON bodies working', async () => {
    const resolved = await resolvePatchedFetchRequest('https://api.example.com/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada' }),
    });

    expect(resolved.method.toUpperCase()).toBe('POST');
    expect(resolved.body).toEqual({ name: 'Ada' });
    expect(resolved.headers['content-type']).toBe('application/json');
  });

  it('does not throw when a JSON-looking body is invalid', async () => {
    const resolved = await resolvePatchedFetchRequest('https://api.example.com/hook', {
      method: 'POST',
      body: '{not-json',
    });

    expect(resolved.body).toBe('{not-json');
  });

  it('leaves relative URL strings unchanged', async () => {
    const resolved = await resolvePatchedFetchRequest('/internal/health', { method: 'GET' });
    expect(resolved.url).toBe('/internal/health');
    expect(resolved.method.toUpperCase()).toBe('GET');
  });

  it('does not consume the original Request body (clone before read)', async () => {
    const request = new Request('https://api.example.com/users', {
      method: 'POST',
      body: JSON.stringify({ name: 'Ada' }),
    });

    await resolvePatchedFetchRequest(request);
    await expect(request.text()).resolves.toBe(JSON.stringify({ name: 'Ada' }));
  });
});

describe('decodeFetchBodyText', () => {
  it('parses objects and arrays and returns invalid JSON as the original string', () => {
    expect(decodeFetchBodyText('{"a":1}')).toEqual({ a: 1 });
    expect(decodeFetchBodyText('[1,2]')).toEqual([1, 2]);
    expect(decodeFetchBodyText('{nope')).toBe('{nope');
    expect(decodeFetchBodyText('plain')).toBe('plain');
  });
});

describe('useGlobalFetch Request argument', () => {
  const testMockDataPath = path.join(__dirname, './test-mock-data-patched-fetch-request');
  const originalFetch = global.fetch;
  let prevDomainPathRulesMode: string | undefined;

  function writeMock(filename: string, method: string, url: string, data: unknown): void {
    const scenarioPath = path.join(testMockDataPath, 'default');
    fs.mkdirSync(scenarioPath, { recursive: true });
    fs.writeFileSync(
      path.join(scenarioPath, filename),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        request: { method, url, headers: {}, data: method === 'GET' ? undefined : { name: 'Ada' } },
        response: {
          status: 200,
          data,
          headers: { 'content-type': 'application/json' },
        },
      }),
      'utf-8'
    );
  }

  beforeEach(() => {
    prevDomainPathRulesMode = process.env.MOCKIFYER_DOMAIN_PATH_RULES_MODE;
    process.env.MOCKIFYER_DOMAIN_PATH_RULES_MODE = 'off';
    delete (global as { __mockifyer_original_fetch?: unknown }).__mockifyer_original_fetch;
    fs.mkdirSync(testMockDataPath, { recursive: true });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete (global as { __mockifyer_original_fetch?: unknown }).__mockifyer_original_fetch;
    if (prevDomainPathRulesMode === undefined) {
      delete process.env.MOCKIFYER_DOMAIN_PATH_RULES_MODE;
    } else {
      process.env.MOCKIFYER_DOMAIN_PATH_RULES_MODE = prevDomainPathRulesMode;
    }
    if (fs.existsSync(testMockDataPath)) {
      fs.rmSync(testMockDataPath, { recursive: true, force: true });
    }
  });

  it('does not serve a GET mock for fetch(new Request(POST))', async () => {
    const url = 'https://api.example.com/users';
    writeMock('get_users.json', 'GET', url, { fromGet: true });
    writeMock('post_users.json', 'POST', url, { fromPost: true });

    setupMockifyer({
      mockDataPath: testMockDataPath,
      recordMode: false,
      useGlobalFetch: true,
      failOnMissingMock: true,
    });

    const response = await fetch(
      new Request(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Ada' }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ fromPost: true });
  });
});
