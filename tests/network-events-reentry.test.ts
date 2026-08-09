import fs from 'fs';
import os from 'os';
import path from 'path';
import { setupMockifyer } from '../packages/mockifyer-fetch/src/index';
import {
  isMockifyerDashboardNetworkEventsApiUrl,
  isMockifyerDashboardPlumbingApiUrl,
  shouldBypassMockifyerForUrl,
} from '@sgedda/mockifyer-core';

describe('dashboard /api/network-events plumbing', () => {
  it('detects network-events URLs including subpaths and prefixes', () => {
    expect(isMockifyerDashboardNetworkEventsApiUrl('http://localhost:3002/api/network-events')).toBe(
      true
    );
    expect(
      isMockifyerDashboardNetworkEventsApiUrl('https://host/mockifyer/api/network-events/trace')
    ).toBe(true);
    expect(
      isMockifyerDashboardNetworkEventsApiUrl('https://host/mockifyer/api/network-events/config')
    ).toBe(true);
    expect(isMockifyerDashboardNetworkEventsApiUrl('https://host/api/health')).toBe(false);
    expect(isMockifyerDashboardNetworkEventsApiUrl('https://host/api/network-events-backup')).toBe(
      false
    );
  });

  it('always bypasses network-events even when custom excludedUrls replace defaults', () => {
    expect(
      shouldBypassMockifyerForUrl('https://host/mockifyer/api/network-events', ['only.example.com'])
    ).toBe(true);
    expect(isMockifyerDashboardPlumbingApiUrl('https://host/api/proxy')).toBe(true);
    expect(isMockifyerDashboardPlumbingApiUrl('https://host/api/network-events')).toBe(true);
  });
});

describe('useGlobalFetch + SDK network log re-entry', () => {
  let mockDataPath: string;
  let originalFetch: typeof fetch;
  let posts: string[];
  const prevDashboardUrl = process.env.MOCKIFYER_DASHBOARD_URL;

  beforeEach(() => {
    mockDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-netlog-'));
    originalFetch = global.fetch;
    posts = [];
    let networkEventPosts = 0;
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method || 'GET').toUpperCase();
      posts.push(`${method}:${url}`);
      if (url.includes('/api/network-events')) {
        networkEventPosts += 1;
        // Hard stop so a regression cannot OOM the Jest worker.
        if (networkEventPosts > 5) {
          throw new Error('network-events re-entry storm detected');
        }
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    fs.rmSync(mockDataPath, { recursive: true, force: true });
    if (prevDashboardUrl === undefined) {
      delete process.env.MOCKIFYER_DASHBOARD_URL;
    } else {
      process.env.MOCKIFYER_DASHBOARD_URL = prevDashboardUrl;
    }
  });

  it('posts exactly one /api/network-events event without re-entering patched fetch', async () => {
    process.env.MOCKIFYER_DASHBOARD_URL = 'http://dashboard.test:3002';
    setupMockifyer({
      mockDataPath,
      useGlobalFetch: true,
      recordMode: false,
      networkLog: { enabled: true, dashboardBaseUrl: 'http://dashboard.test:3002' },
      databaseProvider: { type: 'memory' },
    });

    await fetch('https://api.example.com/items/1');
    await new Promise((r) => setTimeout(r, 100));

    const networkEventPosts = posts.filter((p) => p.includes('/api/network-events'));
    const upstreamPosts = posts.filter((p) => p.includes('api.example.com'));

    expect(upstreamPosts).toHaveLength(1);
    expect(networkEventPosts).toHaveLength(1);
    expect(networkEventPosts[0]).toBe('POST:http://dashboard.test:3002/api/network-events');
  });
});
