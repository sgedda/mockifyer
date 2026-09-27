import { generateRequestKey, registerHopOwner, resetHopOwnerRegistry } from '@sgedda/mockifyer-core';
import type { MockData } from '@sgedda/mockifyer-core';
import * as crypto from 'crypto';
import {
  resolveInboundParentRequestIdForChild,
  type InboundParentRecordStore,
} from '../packages/mockifyer-dashboard/src/utils/inbound-parent-record-store';

function createMemoryStore(): InboundParentRecordStore & { rows: Map<string, MockData> } {
  const rows = new Map<string, MockData>();
  return {
    rows,
    async getByHashInScenario(hash) {
      return rows.get(hash) ?? null;
    },
    async setByHashInScenario(hash, mockData) {
      rows.set(hash, mockData);
      return true;
    },
  };
}

function requestHash(method: string, url: string, data: unknown = null): string {
  const key = generateRequestKey({ method, url, headers: {}, data, queryParams: {} });
  return crypto.createHash('sha256').update(key).digest('hex');
}

describe('resolveInboundParentRequestIdForChild', () => {
  beforeEach(() => {
    resetHopOwnerRegistry();
  });

  it('keeps the live parent when this dashboard proxied that hop', async () => {
    const store = createMemoryStore();
    registerHopOwner({
      requestId: 'myaccount-hop',
      method: 'GET',
      url: 'https://member.example/v-2/myaccount/',
    });

    const parentId = await resolveInboundParentRequestIdForChild(store, 'default', 'myaccount-hop', {
      method: 'GET',
      url: 'http://member.example/v-2/myaccount/',
    });

    expect(parentId).toBe('myaccount-hop');
    const placeholder = store.rows.get(requestHash('GET', 'https://member.example/v-2/myaccount/'));
    expect(placeholder?.requestId).toBe('myaccount-hop');
    expect(store.rows.has(requestHash('GET', 'http://member.example/v-2/myaccount/'))).toBe(false);
  });

  it('heals a proxied parent onto its re-recorded row after the scenario was cleared', async () => {
    const store = createMemoryStore();
    const url = 'http://localhost:4000/graphql';
    const data = { query: 'query myAccountBookingExtras { id }', variables: {} };
    registerHopOwner({ requestId: 'gql-before-clear', method: 'POST', url });
    store.rows.set(requestHash('POST', url, data), {
      request: { method: 'POST', url, headers: {}, data },
      response: { status: 0, data: null, headers: {} },
      timestamp: '2026-09-27T00:00:00.000Z',
      requestId: 'gql-after-clear',
    } as MockData);

    await expect(
      resolveInboundParentRequestIdForChild(store, 'default', 'gql-before-clear', { method: 'POST', url, data })
    ).resolves.toBe('gql-after-clear');
  });

  it('does not heal a proxied parent onto an older duplicate inbound row', async () => {
    const store = createMemoryStore();
    const inboundUrl = 'http://member.example/v-2/myaccount/';
    store.rows.set(requestHash('GET', inboundUrl), {
      request: { method: 'GET', url: inboundUrl, headers: {} },
      response: { status: 0, data: null, headers: {} },
      timestamp: '2026-09-27T00:00:00.000Z',
      requestId: 'stale-inbound-row',
    } as MockData);
    registerHopOwner({
      requestId: 'myaccount-hop',
      method: 'GET',
      url: 'https://member.example/v-2/myaccount/',
    });

    await expect(
      resolveInboundParentRequestIdForChild(store, 'default', 'myaccount-hop', {
        method: 'GET',
        url: inboundUrl,
      })
    ).resolves.toBe('myaccount-hop');
  });

  it('heals an http inbound parent onto the https row its caller proxied', async () => {
    const store = createMemoryStore();
    const proxiedUrl = 'https://member.example/v-2/myaccount/';
    const inboundUrl = 'http://member.example/v-2/myaccount/';
    const row = (url: string, requestId: string): MockData =>
      ({
        request: { method: 'GET', url, headers: {} },
        response: { status: 0, data: null, headers: {} },
        timestamp: '2026-09-27T00:00:00.000Z',
        requestId,
      }) as MockData;
    store.rows.set(requestHash('GET', proxiedUrl), row(proxiedUrl, 'myaccount-recorded'));
    store.rows.set(requestHash('GET', inboundUrl), row(inboundUrl, 'stale-inbound-row'));

    await expect(
      resolveInboundParentRequestIdForChild(store, 'default', 'other-instance-hop', {
        method: 'GET',
        url: inboundUrl,
      })
    ).resolves.toBe('myaccount-recorded');
  });

  it('still heals an unproxied inbound parent onto its recorded row', async () => {
    const store = createMemoryStore();
    const url = 'http://bff.internal/graphql';
    const data = { query: 'query myAccount { id }', variables: {} };
    store.rows.set(requestHash('POST', url, data), {
      request: { method: 'POST', url, headers: {}, data },
      response: { status: 0, data: null, headers: {} },
      timestamp: '2026-09-27T00:00:00.000Z',
      requestId: 'recorded-graphql',
    } as MockData);

    await expect(
      resolveInboundParentRequestIdForChild(store, 'default', 'live-graphql', {
        method: 'POST',
        url,
        data,
      })
    ).resolves.toBe('recorded-graphql');
  });
});
