import { generateRequestKey, type MockData } from '@sgedda/mockifyer-core';
import * as crypto from 'crypto';
import {
  resolveInboundParentRequestIdForChild,
  type InboundParentRecordStore,
} from '../packages/mockifyer-dashboard/src/utils/inbound-parent-record-store';

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function memoryStore(seed?: Map<string, MockData>): InboundParentRecordStore & {
  writes: Array<{ hash: string; mock: MockData }>;
  data: Map<string, MockData>;
} {
  const data = seed ?? new Map<string, MockData>();
  const writes: Array<{ hash: string; mock: MockData }> = [];
  return {
    data,
    writes,
    async getByHashInScenario(hash: string) {
      return data.get(hash) ?? null;
    },
    async setByHashInScenario(hash: string, mockData: MockData) {
      writes.push({ hash, mock: mockData });
      data.set(hash, mockData);
      return true;
    },
  };
}

const GRAPHQL_URL = 'http://localhost:4000/graphql';
const GRAPHQL_BODY = {
  query: 'query myAccount { id }',
  variables: {},
};

describe('resolveInboundParentRequestIdForChild', () => {
  it('does not overwrite a captured GraphQL mock that has no requestId', async () => {
    const captured: MockData = {
      request: {
        method: 'POST',
        url: GRAPHQL_URL,
        headers: {},
        data: GRAPHQL_BODY,
        queryParams: {},
      },
      response: { status: 200, data: { data: { myAccount: { id: 'acct-1' } } }, headers: {} },
      timestamp: '2024-01-01T00:00:00.000Z',
    };
    const hash = sha256Hex(generateRequestKey(captured.request));
    const store = memoryStore(new Map([[hash, captured]]));

    const parentId = await resolveInboundParentRequestIdForChild(
      store,
      'default',
      'als-inbound-1',
      { method: 'POST', url: GRAPHQL_URL, data: GRAPHQL_BODY }
    );

    expect(parentId).toBe('als-inbound-1');
    expect(store.writes).toEqual([]);
    expect(store.data.get(hash)?.response.data).toEqual({
      data: { myAccount: { id: 'acct-1' } },
    });
    expect(store.data.get(hash)?.alwaysUseRealApi).toBeUndefined();
    expect(store.data.get(hash)?.responsePending).toBeUndefined();
  });

  it('heals children onto an existing recording requestId without writing', async () => {
    const captured: MockData = {
      request: {
        method: 'POST',
        url: GRAPHQL_URL,
        headers: {},
        data: GRAPHQL_BODY,
        queryParams: {},
      },
      response: { status: 200, data: { data: { myAccount: { id: 'acct-1' } } }, headers: {} },
      timestamp: '2024-01-01T00:00:00.000Z',
      requestId: 'recorded-gql-1',
    };
    const hash = sha256Hex(generateRequestKey(captured.request));
    const store = memoryStore(new Map([[hash, captured]]));

    const parentId = await resolveInboundParentRequestIdForChild(
      store,
      'default',
      'als-inbound-1',
      { method: 'POST', url: GRAPHQL_URL, data: GRAPHQL_BODY }
    );

    expect(parentId).toBe('recorded-gql-1');
    expect(store.writes).toEqual([]);
  });

  it('inserts a request-only stub only when the hash is missing', async () => {
    const store = memoryStore();
    const parentId = await resolveInboundParentRequestIdForChild(
      store,
      'default',
      'als-inbound-1',
      { method: 'POST', url: GRAPHQL_URL, data: GRAPHQL_BODY }
    );

    expect(parentId).toBe('als-inbound-1');
    expect(store.writes).toHaveLength(1);
    expect(store.writes[0].mock.requestId).toBe('als-inbound-1');
    expect(store.writes[0].mock.alwaysUseRealApi).toBe(true);
    expect(store.writes[0].mock.responsePending).toBe(true);
    expect(store.writes[0].mock.response.data).toBeNull();
  });
});
