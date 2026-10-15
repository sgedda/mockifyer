import { ENV_VARS, type MockData } from '@sgedda/mockifyer-core';
import type { MockKvBackend } from '../packages/mockifyer-dashboard/src/utils/mock-kv-backend';
import { RedisMockStore } from '../packages/mockifyer-dashboard/src/utils/redis-mock-store';

const STORED_HASH = 'existing-hash';
const SCENARIO = 'default';
const KEY_PREFIX = 'mockifyer:v1';

function sampleMock(): MockData {
  return {
    request: {
      method: 'POST',
      url: 'https://api.example.com/items',
      headers: {},
      data: { n: 2 },
    },
    response: { status: 200, data: { ok: true }, headers: {} },
    timestamp: '2026-01-01T00:00:00.000Z',
  };
}

describe('Redis write-limit liveness check', () => {
  const prevScenario = process.env[ENV_VARS.MOCK_MAX_REQUESTS_PER_SCENARIO];
  const prevPath = process.env[ENV_VARS.MOCK_MAX_MOCKS_PER_PATH];

  afterEach(() => {
    if (prevScenario !== undefined) {
      process.env[ENV_VARS.MOCK_MAX_REQUESTS_PER_SCENARIO] = prevScenario;
    } else {
      delete process.env[ENV_VARS.MOCK_MAX_REQUESTS_PER_SCENARIO];
    }
    if (prevPath !== undefined) {
      process.env[ENV_VARS.MOCK_MAX_MOCKS_PER_PATH] = prevPath;
    } else {
      delete process.env[ENV_VARS.MOCK_MAX_MOCKS_PER_PATH];
    }
  });

  it('passes index hashes to mget as one array and keeps live mocks indexed', async () => {
    process.env[ENV_VARS.MOCK_MAX_REQUESTS_PER_SCENARIO] = '1';
    process.env[ENV_VARS.MOCK_MAX_MOCKS_PER_PATH] = 'off';

    const mgetCalls: string[][] = [];
    const removed: string[][] = [];
    const kv = {
      async get() {
        return null;
      },
      async scard() {
        return 1;
      },
      async smembers() {
        return [STORED_HASH];
      },
      async mget(keys: string[]) {
        mgetCalls.push(keys);
        return keys.map(() => '{"request":{"method":"GET","url":"https://api.example.com/old"}}');
      },
      async srem(_key: string, ...members: string[]) {
        removed.push(members);
      },
    } as unknown as MockKvBackend;

    const store = new RedisMockStore({
      kv,
      mockDataPath: '/tmp/mockifyer-mget-test',
      keyPrefix: KEY_PREFIX,
    });

    const wrote = await store.setByHashInScenario('new-hash', sampleMock(), SCENARIO);

    expect(wrote).toBe(false);
    expect(mgetCalls).toEqual([[`${KEY_PREFIX}:mock:${SCENARIO}:${STORED_HASH}`]]);
    expect(removed).toEqual([]);
  });
});
