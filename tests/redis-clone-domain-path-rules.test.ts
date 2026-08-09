import fs from 'fs';
import os from 'os';
import path from 'path';
import { RedisMockStore } from '../packages/mockifyer-dashboard/src/utils/redis-mock-store';
import type { MockKvBackend, MockKvMulti } from '../packages/mockifyer-dashboard/src/utils/mock-kv-backend';
import { readDomainPathRulesFile } from '../packages/mockifyer-dashboard/src/utils/domain-path-rules-store';

/** Minimal in-memory KV for cloneScenario unit tests (no Redis/SQLite native deps). */
function createMemoryKv(): MockKvBackend {
  const strings = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const hashes = new Map<string, Map<string, string>>();
  const zsets = new Map<string, Map<string, number>>();

  const ensureSet = (key: string) => {
    let s = sets.get(key);
    if (!s) {
      s = new Set();
      sets.set(key, s);
    }
    return s;
  };

  const backend: MockKvBackend = {
    async get(key) {
      return strings.has(key) ? strings.get(key)! : null;
    },
    async set(key, value) {
      strings.set(key, value);
    },
    async del(...keys) {
      for (const key of keys) {
        strings.delete(key);
        sets.delete(key);
        hashes.delete(key);
        zsets.delete(key);
      }
    },
    async mget(...keys) {
      return keys.map((k) => (strings.has(k) ? strings.get(k)! : null));
    },
    async sadd(key, ...members) {
      const s = ensureSet(key);
      for (const m of members) s.add(m);
    },
    async smembers(key) {
      return Array.from(sets.get(key) ?? []);
    },
    async srem(key, ...members) {
      const s = sets.get(key);
      if (!s) return;
      for (const m of members) s.delete(m);
    },
    async hget(key, field) {
      return hashes.get(key)?.get(field) ?? null;
    },
    async hset(key, field, value) {
      let h = hashes.get(key);
      if (!h) {
        h = new Map();
        hashes.set(key, h);
      }
      h.set(field, value);
    },
    async hdel(key, ...fields) {
      const h = hashes.get(key);
      if (!h) return;
      for (const f of fields) h.delete(f);
    },
    async zadd(key, score, member) {
      let z = zsets.get(key);
      if (!z) {
        z = new Map();
        zsets.set(key, z);
      }
      z.set(member, score);
    },
    async zrem(key, ...members) {
      const z = zsets.get(key);
      if (!z) return;
      for (const m of members) z.delete(m);
    },
    async zrevrangebyscore() {
      return [];
    },
    async zremrangebyscore() {
      return;
    },
    async zcount() {
      return 0;
    },
    async scanKeys(pattern) {
      const prefix = pattern.replace(/\*$/, '');
      const out: string[] = [];
      for (const key of strings.keys()) {
        if (key.startsWith(prefix) || pattern === '*') out.push(key);
      }
      for (const key of sets.keys()) {
        if (key.startsWith(prefix) || pattern === '*') out.push(key);
      }
      return out;
    },
    multi(): MockKvMulti {
      const ops: Array<() => Promise<void>> = [];
      const multi: MockKvMulti = {
        set(key, value) {
          ops.push(() => backend.set(key, value));
          return multi;
        },
        sadd(key, ...members) {
          ops.push(() => backend.sadd(key, ...members));
          return multi;
        },
        del(key) {
          ops.push(() => backend.del(key));
          return multi;
        },
        async exec() {
          for (const op of ops) await op();
          return [];
        },
      };
      return multi;
    },
    async ping() {
      return;
    },
    async close() {
      return;
    },
  };

  return backend;
}

describe('RedisMockStore.cloneScenario domain-path rules', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-clone-dpr-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('copies path_rules into the derived scenario store and disk file', async () => {
    const store = new RedisMockStore({
      kv: createMemoryKv(),
      mockDataPath: tmpRoot,
      keyPrefix: 'test',
    });

    const sourceRules = {
      'api.example.com': { recordResponses: true, autoMock: true, updatedAt: '2026-08-09T00:00:00.000Z' },
      'api.example.com/v1/users/:id': {
        recordResponses: true,
        autoMock: true,
        updatedAt: '2026-08-09T00:00:00.000Z',
      },
    };
    await store.replaceDomainPathRules('golden', sourceRules);

    const result = await store.cloneScenario('golden', 'derived');
    expect(result.domainPathRulesCopied).toBe(true);
    expect(await store.getDomainPathRules('derived')).toEqual(sourceRules);
    expect(readDomainPathRulesFile(tmpRoot, 'derived')).toEqual(sourceRules);

    await store.close();
  });
});
