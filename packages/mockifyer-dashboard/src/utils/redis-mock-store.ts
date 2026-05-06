import * as crypto from 'crypto';
import type { MockData } from '@sgedda/mockifyer-core';
import { generateRequestKey, getCurrentScenario } from '@sgedda/mockifyer-core';

export interface RedisMockStoreConfig {
  redisUrl: string;
  keyPrefix?: string;
  mockDataPath: string;
  /** ioredis options passthrough */
  redisOptions?: Record<string, unknown>;
}

export interface RedisMockListItem {
  hash: string;
  mockData: MockData;
  redisKey: string;
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function requireIoRedis(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('ioredis');
  } catch {
    throw new Error(
      "Redis mock store requires optional dependency 'ioredis'. Install it in the dashboard package: npm install ioredis"
    );
  }
}

export class RedisMockStore {
  private readonly redis: any;
  private readonly mockDataPath: string;
  private readonly keyPrefix: string;
  private readonly activeScenarioKey: string;
  private readonly useCentralizedScenario: boolean;
  private readonly laneNoteHashKey: string;
  private readonly laneLastSeenZSetKey: string;
  private readonly scenarioRegistrySetKey: string;

  constructor(config: RedisMockStoreConfig) {
    this.mockDataPath = config.mockDataPath;
    this.keyPrefix = config.keyPrefix || 'mockifyer:v1';
    this.activeScenarioKey = `${this.keyPrefix}:active_scenario`;
    this.laneNoteHashKey = `${this.keyPrefix}:client_lane_notes`;
    this.laneLastSeenZSetKey = `${this.keyPrefix}:client_lane_last_seen`;
    this.scenarioRegistrySetKey = `${this.keyPrefix}:scenarios`;
    this.useCentralizedScenario = true;

    const RedisCtor = requireIoRedis();
    this.redis = new RedisCtor(config.redisUrl, {
      maxRetriesPerRequest: 3,
      ...(config.redisOptions || {}),
    });
  }

  /**
   * Same scenario segment used for Redis mock keys ({@link dataKey}). Use when loading scenario-scoped files
   * on disk (e.g. date-config.json) so they align with Redis active scenario and client lanes.
   */
  async getResolvedScenario(scenarioFromClient?: string, clientId?: string): Promise<string> {
    return this.scenarioKey(scenarioFromClient, clientId);
  }

  private async scenarioKey(scenarioOverride?: string, clientId?: string): Promise<string> {
    if (scenarioOverride) return scenarioOverride;
    if (this.useCentralizedScenario) {
      if (clientId && clientId.trim()) {
        const perClientKey = `${this.keyPrefix}:client_scenario:${clientId.trim()}`;
        const perClientScenario = await this.redis.get(perClientKey);
        if (typeof perClientScenario === 'string' && perClientScenario.trim()) {
          return perClientScenario.trim();
        }
      }
      const centralizedScenario = await this.redis.get(this.activeScenarioKey);
      if (typeof centralizedScenario === 'string' && centralizedScenario.trim()) {
        return centralizedScenario.trim();
      }
    }
    return getCurrentScenario(this.mockDataPath);
  }

  private async indexKey(scenarioOverride?: string, clientId?: string): Promise<string> {
    return `${this.keyPrefix}:index:${await this.scenarioKey(scenarioOverride, clientId)}`;
  }

  private async dataKey(hash: string, scenarioOverride?: string, clientId?: string): Promise<string> {
    return `${this.keyPrefix}:mock:${await this.scenarioKey(scenarioOverride, clientId)}:${hash}`;
  }

  async getActiveScenario(): Promise<string> {
    return this.scenarioKey();
  }

  async setActiveScenario(scenario: string): Promise<void> {
    await this.redis.set(this.activeScenarioKey, scenario);
    // Best-effort registry so scenarios appear even with no mocks yet.
    await this.redis.sadd(this.scenarioRegistrySetKey, scenario).catch(() => undefined);
  }

  async ping(): Promise<void> {
    await this.redis.ping();
  }

  async list(scenario?: string, clientId?: string): Promise<RedisMockListItem[]> {
    const indexKey = await this.indexKey(scenario, clientId);
    const hashes: string[] = await this.redis.smembers(indexKey);
    if (hashes.length === 0) return [];

    const keys = await Promise.all(hashes.map((h) => this.dataKey(h, scenario, clientId)));
    const values: Array<string | null> = await this.redis.mget(...keys);

    const out: RedisMockListItem[] = [];
    for (let i = 0; i < hashes.length; i++) {
      const raw = values[i];
      if (!raw) continue;
      try {
        const mockData = JSON.parse(raw) as MockData;
        out.push({ hash: hashes[i], mockData, redisKey: keys[i] });
      } catch {
        continue;
      }
    }
    return out;
  }

  async getByHash(hash: string, scenario?: string, clientId?: string): Promise<MockData | null> {
    const dataKey = await this.dataKey(hash, scenario, clientId);
    const raw: string | null = await this.redis.get(dataKey);
    if (!raw) return null;
    return JSON.parse(raw) as MockData;
  }

  /** Compute the canonical hash for a stored mock. */
  static hashForMock(mockData: MockData): string {
    const requestKey = generateRequestKey(mockData.request);
    return sha256Hex(requestKey);
  }

  async setByHash(hash: string, mockData: MockData, scenario?: string, clientId?: string): Promise<void> {
    const key = await this.dataKey(hash, scenario, clientId);
    const indexKey = await this.indexKey(scenario, clientId);
    await this.redis.set(key, JSON.stringify(mockData));
    await this.redis.sadd(indexKey, hash);
    // Best-effort registry so scenarios appear even if index scanning misses them.
    if (scenario) {
      await this.redis.sadd(this.scenarioRegistrySetKey, scenario).catch(() => undefined);
    }
  }

  async deleteByHash(hash: string, scenario?: string, clientId?: string): Promise<void> {
    const dataKey = await this.dataKey(hash, scenario, clientId);
    const indexKey = await this.indexKey(scenario, clientId);
    await this.redis.del(dataKey);
    await this.redis.srem(indexKey, hash);
  }

  /** Redis key for JSON `{ dateManipulation, updatedAt }` per scenario (dashboard Date Config + proxy). */
  dateConfigRedisKey(scenario: string): string {
    const id = scenario.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'default';
    return `${this.keyPrefix}:date_config:${id}`;
  }

  async getDateConfig(scenario: string): Promise<{
    dateManipulation: Record<string, unknown> | null;
    updatedAt?: string;
  } | null> {
    const raw: string | null = await this.redis.get(this.dateConfigRedisKey(scenario));
    if (raw === null || raw === '') return null;
    try {
      const o = JSON.parse(raw) as Record<string, unknown>;
      const dm = o.dateManipulation;
      return {
        dateManipulation:
          dm !== undefined && dm !== null && typeof dm === 'object'
            ? (dm as Record<string, unknown>)
            : null,
        updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : undefined,
      };
    } catch {
      return null;
    }
  }

  async setDateConfig(
    scenario: string,
    payload: { dateManipulation: Record<string, unknown>; updatedAt: string }
  ): Promise<void> {
    await this.redis.set(this.dateConfigRedisKey(scenario), JSON.stringify(payload));
    await this.redis.sadd(this.scenarioRegistrySetKey, scenario).catch(() => undefined);
  }

  async deleteDateConfig(scenario: string): Promise<void> {
    await this.redis.del(this.dateConfigRedisKey(scenario));
  }

  /**
   * Clone all Redis-stored mock data (and date config) from one scenario into another.
   *
   * Notes:
   * - Lane overrides are NOT copied; this is scenario->scenario only.
   * - Existing destination scenario data is not deleted; caller should ensure it's new/empty.
   */
  async cloneScenario(fromScenario: string, toScenario: string): Promise<{
    mocksCopied: number;
    dateConfigCopied: boolean;
  }> {
    const from = fromScenario.trim();
    const to = toScenario.trim();
    if (!from) throw new Error('fromScenario is required');
    if (!to) throw new Error('toScenario is required');
    if (from === to) throw new Error('fromScenario and toScenario must differ');

    // Copy date config if present.
    let dateConfigCopied = false;
    const dateDoc = await this.getDateConfig(from);
    if (dateDoc !== null && dateDoc.dateManipulation !== null) {
      await this.setDateConfig(to, {
        dateManipulation: dateDoc.dateManipulation,
        updatedAt: new Date().toISOString(),
      });
      dateConfigCopied = true;
    }

    // Copy mocks by walking the index set.
    const fromIndexKey = await this.indexKey(from);
    const hashes: string[] = await this.redis.smembers(fromIndexKey);
    if (hashes.length === 0) {
      // Still ensure the destination scenario is discoverable.
      await this.redis.sadd(this.scenarioRegistrySetKey, to).catch(() => undefined);
      return { mocksCopied: 0, dateConfigCopied };
    }

    const fromKeys = await Promise.all(hashes.map((h) => this.dataKey(h, from)));
    const values: Array<string | null> = await this.redis.mget(...fromKeys);

    const multi = this.redis.multi();
    let copied = 0;
    for (let i = 0; i < hashes.length; i++) {
      const raw = values[i];
      if (!raw) continue;
      const hash = hashes[i];
      const toKey = await this.dataKey(hash, to);
      multi.set(toKey, raw);
      copied++;
    }
    if (copied > 0) {
      const toIndexKey = await this.indexKey(to);
      multi.sadd(toIndexKey, ...hashes);
    }
    // Registry + best-effort: ensures scenarios appear even if empty.
    multi.sadd(this.scenarioRegistrySetKey, to);

    await multi.exec();
    return { mocksCopied: copied, dateConfigCopied };
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }

  /**
   * Best-effort scenario discovery for dashboard UI.
   * Scans for `${keyPrefix}:index:*` keys and extracts the scenario suffix.
   */
  async listScenarios(): Promise<string[]> {
    const out = new Set<string>();

    // 1) Registry set (best-effort fast path).
    try {
      const members: string[] = await this.redis.smembers(this.scenarioRegistrySetKey);
      for (const s of members) {
        if (typeof s === 'string' && s.trim()) out.add(s.trim());
      }
    } catch {
      // ignore
    }

    // 2) Legacy discovery: scan index keys.
    {
      const pattern = `${this.keyPrefix}:index:*`;
      let cursor = '0';
      do {
        const [next, keys]: [string, string[]] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', '200');
        cursor = next;
        for (const k of keys) {
          const parts = k.split(':index:');
          if (parts.length === 2 && parts[1]) {
            out.add(parts[1]);
          }
        }
      } while (cursor !== '0');
    }

    // 3) Date config keys can exist without any mocks/index.
    {
      const pattern = `${this.keyPrefix}:date_config:*`;
      let cursor = '0';
      do {
        const [next, keys]: [string, string[]] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', '200');
        cursor = next;
        for (const k of keys) {
          const parts = k.split(':date_config:');
          if (parts.length === 2 && parts[1]) {
            out.add(parts[1]);
          }
        }
      } while (cursor !== '0');
    }

    return Array.from(out).sort();
  }

  async getLaneScenario(clientId: string): Promise<string | null> {
    const id = clientId.trim();
    if (!id) return null;
    const key = `${this.keyPrefix}:client_scenario:${id}`;
    const v = await this.redis.get(key);
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  }

  async setLaneScenario(clientId: string, scenario: string | null): Promise<void> {
    const id = clientId.trim();
    if (!id) throw new Error('clientId is required');
    const key = `${this.keyPrefix}:client_scenario:${id}`;
    if (scenario === null) {
      await this.redis.del(key);
      return;
    }
    await this.redis.set(key, scenario);
  }

  async listClientLanes(): Promise<Array<{ clientId: string; scenario: string; note: string | null }>> {
    const pattern = `${this.keyPrefix}:client_scenario:*`;
    const out: Array<{ clientId: string; scenario: string; note: string | null }> = [];
    let cursor = '0';
    do {
      const [next, keys]: [string, string[]] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', '200');
      cursor = next;
      if (keys.length === 0) continue;
      const values: Array<string | null> = await this.redis.mget(...keys);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const val = values[i];
        if (!val || !val.trim()) continue;
        const clientId = key.slice(`${this.keyPrefix}:client_scenario:`.length);
        if (!clientId) continue;
        const note: string | null = await this.redis.hget(this.laneNoteHashKey, clientId);
        out.push({ clientId, scenario: val.trim(), note: note && note.trim() ? note.trim() : null });
      }
    } while (cursor !== '0');
    return out.sort((a, b) => a.clientId.localeCompare(b.clientId));
  }

  async setLaneNote(clientId: string, note: string | null): Promise<void> {
    const id = clientId.trim();
    if (!id) throw new Error('clientId is required');
    if (note === null || note.trim() === '') {
      await this.redis.hdel(this.laneNoteHashKey, id);
      return;
    }
    await this.redis.hset(this.laneNoteHashKey, id, note.trim());
  }

  /**
   * Best-effort lane discovery for UX (autocomplete / quick-add).
   *
   * Stores a "last seen" timestamp in a Redis sorted set keyed by clientId.
   * Entries are trimmed by TTL to prevent unbounded growth.
   */
  async recordLaneSeen(clientId: string, nowMs: number = Date.now(), ttlMs: number = 1000 * 60 * 60 * 24 * 14): Promise<void> {
    const id = clientId.trim();
    if (!id) return;
    await this.redis.zadd(this.laneLastSeenZSetKey, nowMs, id);
    const minScore = nowMs - ttlMs;
    await this.redis.zremrangebyscore(this.laneLastSeenZSetKey, 0, minScore);
  }

  /**
   * List discovered lanes seen recently, newest first.
   * This list includes lanes that might not have an explicit scenario override yet.
   */
  async listDiscoveredLanes(limit: number = 50, ttlMs: number = 1000 * 60 * 60 * 24 * 14): Promise<string[]> {
    const nowMs = Date.now();
    const minScore = nowMs - ttlMs;
    // Newest first, within TTL window.
    const ids: string[] = await this.redis.zrevrangebyscore(this.laneLastSeenZSetKey, nowMs, minScore, 'LIMIT', 0, limit);
    return ids.map((s) => s.trim()).filter(Boolean);
  }
}

