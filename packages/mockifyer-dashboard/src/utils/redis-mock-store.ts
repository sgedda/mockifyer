import * as crypto from 'crypto';
import type { MockData, DomainPathRulesMap } from '@sgedda/mockifyer-core';
import {
  assertValidScenarioName,
  generateRequestKey,
  getCurrentScenario,
  validateScenarioName,
} from '@sgedda/mockifyer-core';
import type { MockKvBackend } from './mock-kv-backend';
import { RedisMockKvBackend } from './redis-mock-kv-backend';
import { SqliteMockKvBackend } from './sqlite-mock-kv-backend';

export interface RedisMockStoreConfig {
  /** When set, used directly (Redis or SQLite KV backend). */
  kv?: MockKvBackend;
  redisUrl?: string;
  /** SQLite database file path (dashboard `--provider sqlite`). */
  sqlitePath?: string;
  keyPrefix?: string;
  mockDataPath: string;
  /** ioredis options passthrough */
  redisOptions?: Record<string, unknown>;
  /**
   * When true: if the proxy request carries a non-empty **`clientId`** and no body **`scenario`** override,
   * require **`client_scenario:{clientId}`** in Redis. If missing, do not serve or record mocks (upstream passthrough only).
   *
   * Defaults to **`true`** when unset (no global scenario fallback for proxied lanes).
   * Set **`false`** or env **`MOCKIFYER_STRICT_LANE_SCENARIO=false`** to allow global/filesystem fallback.
   */
  strictLaneScenarioResolution?: boolean;
}

export interface RedisMockListItem {
  hash: string;
  mockData: MockData;
  redisKey: string;
}

/** How the dashboard proxy resolved the effective scenario name for Redis keys / date config / proxy settings. */
export type ScenarioResolutionSource = 'body_override' | 'lane_redis' | 'global_redis' | 'filesystem_fallback';

/** Observation record for `/api/client-lanes` (“last seen resolved”; not continuous heartbeats). */
export interface LaneEffectiveObservation {
  lastEffectiveScenario: string;
  lastSeenAt: string;
  resolutionSource: ScenarioResolutionSource;
  clientBodyScenarioOverride: boolean;
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export class RedisMockStore {
  private readonly kv: MockKvBackend;
  private readonly mockDataPath: string;
  private readonly keyPrefix: string;
  private readonly activeScenarioKey: string;
  private readonly useCentralizedScenario: boolean;
  private readonly laneNoteHashKey: string;
  private readonly laneLastSeenZSetKey: string;
  private readonly laneDeviceLastSeenZSetPrefix: string;
  private readonly scenarioRegistrySetKey: string;
  /** Stable index of configured lane ids (avoids relying on SCAN alone). */
  private readonly clientLaneIdsSetKey: string;
  private readonly proxyConfigPrefix: string;
  private readonly strictLaneScenarioResolution: boolean;
  private static readonly EFFECTIVE_TTL_SEC = 60 * 60 * 24 * 14;

  constructor(config: RedisMockStoreConfig) {
    if (config.kv) {
      this.kv = config.kv;
    } else if (config.sqlitePath) {
      this.kv = new SqliteMockKvBackend(config.sqlitePath);
    } else {
      const redisUrl = config.redisUrl || process.env.MOCKIFYER_REDIS_URL || '';
      if (!redisUrl) {
        throw new Error('Redis mock store requires redisUrl or MOCKIFYER_REDIS_URL');
      }
      this.kv = new RedisMockKvBackend(redisUrl, config.redisOptions);
    }

    this.mockDataPath = config.mockDataPath;
    this.keyPrefix = config.keyPrefix || 'mockifyer:v1';
    this.activeScenarioKey = `${this.keyPrefix}:active_scenario`;
    this.laneNoteHashKey = `${this.keyPrefix}:client_lane_notes`;
    this.laneLastSeenZSetKey = `${this.keyPrefix}:client_lane_last_seen`;
    this.laneDeviceLastSeenZSetPrefix = `${this.keyPrefix}:client_lane_devices:`;
    this.scenarioRegistrySetKey = `${this.keyPrefix}:scenarios`;
    this.clientLaneIdsSetKey = `${this.keyPrefix}:client_lane_ids`;
    this.proxyConfigPrefix = `${this.keyPrefix}:proxy_config:`;
    this.useCentralizedScenario = true;

    if (config.strictLaneScenarioResolution !== undefined) {
      this.strictLaneScenarioResolution = config.strictLaneScenarioResolution;
    } else {
      const raw =
        typeof process !== 'undefined' ? String(process.env.MOCKIFYER_STRICT_LANE_SCENARIO || '').trim().toLowerCase() : '';
      if (raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on') {
        this.strictLaneScenarioResolution = true;
      } else if (raw === '0' || raw === 'false' || raw === 'no' || raw === 'off') {
        this.strictLaneScenarioResolution = false;
      } else {
        this.strictLaneScenarioResolution = true;
      }
    }


  }

  /**
   * Same scenario segment used for Redis mock keys ({@link dataKey}). Use when loading scenario-scoped files
   * on disk (e.g. date-config.json) so they align with Redis active scenario and client lanes.
   */
  async getResolvedScenario(scenarioFromClient?: string, clientId?: string): Promise<string> {
    return this.scenarioKey(scenarioFromClient, clientId);
  }

  /**
   * Dashboard `/api/proxy` resolution: body **`scenario`** → **`client_scenario:{clientId}`** → (**strict:** stop if lane missing)
   * → **`active_scenario`** → filesystem **`getCurrentScenario`**.
   */
  async resolveProxyScenario(
    scenarioOverride?: string,
    clientId?: string,
    options?: { strictLaneScenario?: boolean }
  ): Promise<{
    scenario: string | null;
    resolutionSource: ScenarioResolutionSource;
    hadBodyScenarioOverride: boolean;
  }> {
    const strictLane =
      typeof options?.strictLaneScenario === 'boolean'
        ? options.strictLaneScenario
        : this.strictLaneScenarioResolution;
    const hadBodyScenarioOverride =
      typeof scenarioOverride === 'string' && scenarioOverride.trim() !== '';

    if (hadBodyScenarioOverride) {
      const scenarioName = assertValidScenarioName(scenarioOverride!.trim());
      return {
        scenario: scenarioName,
        resolutionSource: 'body_override',
        hadBodyScenarioOverride,
      };
    }

    const laneId = typeof clientId === 'string' ? clientId.trim() : '';

    if (this.useCentralizedScenario) {
      if (laneId) {
        const perClientKey = `${this.keyPrefix}:client_scenario:${laneId}`;
        const perClientScenario = await this.kv.get(perClientKey);
        if (typeof perClientScenario === 'string' && perClientScenario.trim()) {
          return {
            scenario: assertValidScenarioName(perClientScenario.trim()),
            resolutionSource: 'lane_redis',
            hadBodyScenarioOverride: false,
          };
        }
        if (strictLane) {
          return { scenario: null, resolutionSource: 'lane_redis', hadBodyScenarioOverride: false };
        }
      }
      const centralizedScenario = await this.kv.get(this.activeScenarioKey);
      if (typeof centralizedScenario === 'string' && centralizedScenario.trim()) {
        return {
          scenario: assertValidScenarioName(centralizedScenario.trim()),
          resolutionSource: 'global_redis',
          hadBodyScenarioOverride: false,
        };
      }
    }

    const fsScenario = assertValidScenarioName(getCurrentScenario(this.mockDataPath));
    return {
      scenario: fsScenario,
      resolutionSource: 'filesystem_fallback',
      hadBodyScenarioOverride: false,
    };
  }

  private async scenarioKey(scenarioOverride?: string, clientId?: string): Promise<string> {
    if (scenarioOverride) return assertValidScenarioName(scenarioOverride);
    if (this.useCentralizedScenario) {
      if (clientId && clientId.trim()) {
        const perClientKey = `${this.keyPrefix}:client_scenario:${clientId.trim()}`;
        const perClientScenario = await this.kv.get(perClientKey);
        if (typeof perClientScenario === 'string' && perClientScenario.trim()) {
          return assertValidScenarioName(perClientScenario.trim());
        }
      }
      const centralizedScenario = await this.kv.get(this.activeScenarioKey);
      if (typeof centralizedScenario === 'string' && centralizedScenario.trim()) {
        return assertValidScenarioName(centralizedScenario.trim());
      }
    }
    return assertValidScenarioName(getCurrentScenario(this.mockDataPath));
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
    const scenarioName = assertValidScenarioName(scenario);
    await this.kv.set(this.activeScenarioKey, scenarioName);
    // Best-effort registry so scenarios appear even with no mocks yet.
    await this.kv.sadd(this.scenarioRegistrySetKey, scenarioName).catch(() => undefined);
  }

  async ping(): Promise<void> {
    await this.kv.ping();
  }

  async list(scenario?: string, clientId?: string): Promise<RedisMockListItem[]> {
    const indexKey = await this.indexKey(scenario, clientId);
    const hashes: string[] = await this.kv.smembers(indexKey);
    if (hashes.length === 0) return [];

    const keys = await Promise.all(hashes.map((h) => this.dataKey(h, scenario, clientId)));
    const values: Array<string | null> = await this.kv.mget(...keys);

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
    const raw: string | null = await this.kv.get(dataKey);
    if (!raw) return null;
    return JSON.parse(raw) as MockData;
  }

  /**
   * Read a mock when the effective scenario name is already resolved (proxy path after {@link resolveProxyScenario}).
   */
  async getByHashInScenario(hash: string, scenarioName: string): Promise<MockData | null> {
    const id = assertValidScenarioName(scenarioName);
    const key = `${this.keyPrefix}:mock:${id}:${hash}`;
    const raw: string | null = await this.kv.get(key);
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
    await this.kv.set(key, JSON.stringify(mockData));
    await this.kv.sadd(indexKey, hash);
    // Best-effort registry so scenarios appear even if index scanning misses them.
    if (scenario) {
      await this.kv.sadd(this.scenarioRegistrySetKey, scenario).catch(() => undefined);
    }
  }

  /** Write mock into a known resolved scenario segment (dashboard proxy — avoids recomputing {@link scenarioKey}). */
  async setByHashInScenario(hash: string, mockData: MockData, scenarioName: string): Promise<void> {
    const id = assertValidScenarioName(scenarioName);
    const key = `${this.keyPrefix}:mock:${id}:${hash}`;
    const indexKey = `${this.keyPrefix}:index:${id}`;
    await this.kv.set(key, JSON.stringify(mockData));
    await this.kv.sadd(indexKey, hash);
    await this.kv.sadd(this.scenarioRegistrySetKey, id).catch(() => undefined);
  }

  async deleteByHash(hash: string, scenario?: string, clientId?: string): Promise<void> {
    const dataKey = await this.dataKey(hash, scenario, clientId);
    const indexKey = await this.indexKey(scenario, clientId);
    await this.kv.del(dataKey);
    await this.kv.srem(indexKey, hash);
  }

  /** Redis key for JSON `{ dateManipulation, updatedAt }` per scenario (dashboard Date Config + proxy). */
  dateConfigRedisKey(scenario: string): string {
    const id = assertValidScenarioName(scenario);
    return `${this.keyPrefix}:date_config:${id}`;
  }

  async getDateConfig(scenario: string): Promise<{
    dateManipulation: Record<string, unknown> | null;
    updatedAt?: string;
  } | null> {
    const raw: string | null = await this.kv.get(this.dateConfigRedisKey(scenario));
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
    await this.kv.set(this.dateConfigRedisKey(scenario), JSON.stringify(payload));
    await this.kv.sadd(this.scenarioRegistrySetKey, scenario).catch(() => undefined);
  }

  async deleteDateConfig(scenario: string): Promise<void> {
    await this.kv.del(this.dateConfigRedisKey(scenario));
  }

  /** Redis key for JSON `{ recordOnMiss, allowUpstream, updatedAt }` per scenario (proxy behavior). */
  proxyConfigRedisKey(scenario: string): string {
    const id = assertValidScenarioName(scenario);
    return `${this.proxyConfigPrefix}${id}`;
  }

  async getProxyConfig(scenario: string): Promise<{
    recordOnMiss: boolean;
    allowUpstream: boolean;
    recordResponses: boolean;
    updatedAt?: string;
  } | null> {
    const raw: string | null = await this.kv.get(this.proxyConfigRedisKey(scenario));
    if (raw === null || raw === '') return null;
    try {
      const o = JSON.parse(raw) as Record<string, unknown>;
      // Default to recording on cache miss unless explicitly disabled.
      const recordOnMiss = o.recordOnMiss !== false;
      const allowUpstream = o.allowUpstream !== false; // default true
      const recordResponses = o.recordResponses === true;
      return {
        recordOnMiss,
        allowUpstream,
        recordResponses,
        updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : undefined,
      };
    } catch {
      return null;
    }
  }

  async setProxyConfig(
    scenario: string,
    payload: {
      recordOnMiss: boolean;
      allowUpstream: boolean;
      recordResponses: boolean;
      updatedAt: string;
    }
  ): Promise<void> {
    await this.kv.set(this.proxyConfigRedisKey(scenario), JSON.stringify(payload));
    await this.kv.sadd(this.scenarioRegistrySetKey, scenario).catch(() => undefined);
  }

  async deleteProxyConfig(scenario: string): Promise<void> {
    await this.kv.del(this.proxyConfigRedisKey(scenario));
  }

  domainPathRulesRedisKey(scenario: string): string {
    const id = assertValidScenarioName(scenario);
    return `${this.keyPrefix}:path_rules:${id}`;
  }

  async getDomainPathRules(scenario: string): Promise<DomainPathRulesMap> {
    const raw: string | null = await this.kv.get(this.domainPathRulesRedisKey(scenario));
    if (raw === null || raw === '') return {};
    try {
      const o = JSON.parse(raw) as Record<string, unknown>;
      const out: DomainPathRulesMap = {};
      for (const [path, val] of Object.entries(o)) {
        if (!val || typeof val !== 'object') continue;
        const r = val as Record<string, unknown>;
        if (typeof r.recordResponses !== 'boolean') continue;
        out[path] = {
          recordResponses: r.recordResponses,
          autoMock: r.autoMock === true,
          updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : undefined,
        };
      }
      return out;
    } catch {
      return {};
    }
  }

  async setDomainPathRule(
    scenario: string,
    domainPath: string,
    rule: { recordResponses: boolean; autoMock?: boolean } | null
  ): Promise<DomainPathRulesMap> {
    const scenarioName = assertValidScenarioName(scenario);
    const key = this.domainPathRulesRedisKey(scenarioName);
    const normalized = domainPath.trim().replace(/^\/+|\/+$/g, '');
    const rules = await this.getDomainPathRules(scenarioName);
    if (rule === null) {
      delete rules[normalized];
    } else {
      rules[normalized] = {
        recordResponses: rule.recordResponses,
        autoMock: rule.autoMock === true,
        updatedAt: new Date().toISOString(),
      };
    }
    if (Object.keys(rules).length === 0) {
      await this.kv.del(key);
    } else {
      await this.kv.set(key, JSON.stringify(rules));
    }
    await this.kv.sadd(this.scenarioRegistrySetKey, scenarioName).catch(() => undefined);
    return rules;
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
    const from = assertValidScenarioName(fromScenario);
    const to = assertValidScenarioName(toScenario);
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

    // Copy proxy config if present (best-effort).
    const proxyDoc = await this.getProxyConfig(from);
    if (proxyDoc !== null) {
      await this.setProxyConfig(to, {
        recordOnMiss: proxyDoc.recordOnMiss,
        allowUpstream: proxyDoc.allowUpstream,
        recordResponses: proxyDoc.recordResponses,
        updatedAt: new Date().toISOString(),
      }).catch(() => undefined);
    }

    // Copy mocks by walking the index set.
    const fromIndexKey = await this.indexKey(from);
    const hashes: string[] = await this.kv.smembers(fromIndexKey);
    if (hashes.length === 0) {
      // Still ensure the destination scenario is discoverable.
      await this.kv.sadd(this.scenarioRegistrySetKey, to).catch(() => undefined);
      return { mocksCopied: 0, dateConfigCopied };
    }

    const fromKeys = await Promise.all(hashes.map((h) => this.dataKey(h, from)));
    const values: Array<string | null> = await this.kv.mget(...fromKeys);

    let copied = 0;
    for (let i = 0; i < hashes.length; i++) {
      const raw = values[i];
      if (!raw) continue;
      const hash = hashes[i];
      const toKey = await this.dataKey(hash, to);
      await this.kv.set(toKey, raw);
      copied++;
    }
    if (copied > 0) {
      const toIndexKey = await this.indexKey(to);
      await this.kv.sadd(toIndexKey, ...hashes);
    }
    // Registry + best-effort: ensures scenarios appear even if empty.
    await this.kv.sadd(this.scenarioRegistrySetKey, to).catch(() => undefined);

    return { mocksCopied: copied, dateConfigCopied };
  }

  /**
   * Best-effort scenario discovery for dashboard UI.
   * Scans for `${keyPrefix}:index:*` keys and extracts the scenario suffix.
   */
  async listScenarios(): Promise<string[]> {
    const out = new Set<string>();

    // 1) Registry set (best-effort fast path).
    try {
      const members: string[] = await this.kv.smembers(this.scenarioRegistrySetKey);
      for (const s of members) {
        const parsed = validateScenarioName(s);
        if (parsed.ok) out.add(parsed.value);
      }
    } catch {
      // ignore
    }

    // 2) Legacy discovery: scan index keys.
    {
      const pattern = `${this.keyPrefix}:index:*`;
      const keys = await this.kv.scanKeys(pattern);
      for (const k of keys) {
        const parts = k.split(':index:');
        if (parts.length === 2 && parts[1]) {
          const parsed = validateScenarioName(parts[1]);
          if (parsed.ok) out.add(parsed.value);
        }
      }
    }

    // 3) Date config keys can exist without any mocks/index.
    {
      const pattern = `${this.keyPrefix}:date_config:*`;
      const keys = await this.kv.scanKeys(pattern);
      for (const k of keys) {
        const parts = k.split(':date_config:');
        if (parts.length === 2 && parts[1]) {
          const parsed = validateScenarioName(parts[1]);
          if (parsed.ok) out.add(parsed.value);
        }
      }
    }

    return Array.from(out).sort();
  }

  async getLaneScenario(clientId: string): Promise<string | null> {
    const id = clientId.trim();
    if (!id) return null;
    const key = `${this.keyPrefix}:client_scenario:${id}`;
    const v = await this.kv.get(key);
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  }

  async setLaneScenario(clientId: string, scenario: string | null): Promise<void> {
    const id = clientId.trim();
    if (!id) throw new Error('clientId is required');
    const key = `${this.keyPrefix}:client_scenario:${id}`;
    if (scenario === null) {
      await this.kv.del(key);
      await this.kv.srem(this.clientLaneIdsSetKey, id);
      return;
    }
    const scenarioName = assertValidScenarioName(scenario);
    await this.kv.set(key, scenarioName);
    await this.kv.sadd(this.clientLaneIdsSetKey, id);
    await this.kv.sadd(this.scenarioRegistrySetKey, scenarioName).catch(() => undefined);
  }

  async listClientLanes(): Promise<Array<{ clientId: string; scenario: string; note: string | null }>> {
    const scenarioKeyPrefix = `${this.keyPrefix}:client_scenario:`;
    const registryIds = await this.kv.smembers(this.clientLaneIdsSetKey).catch(() => [] as string[]);

    // SCAN backfill for stores created before the lane-id index existed.
    const scannedKeys = await this.kv.scanKeys(`${scenarioKeyPrefix}*`);
    const scannedIds = scannedKeys
      .map((key) => key.slice(scenarioKeyPrefix.length))
      .filter((clientId) => Boolean(clientId));

    const missingFromRegistry = scannedIds.filter((id) => !registryIds.includes(id));
    if (missingFromRegistry.length > 0) {
      await this.kv.sadd(this.clientLaneIdsSetKey, ...missingFromRegistry).catch(() => undefined);
    }

    const allIds = [...new Set([...registryIds, ...scannedIds])].sort((a, b) => a.localeCompare(b));
    if (allIds.length === 0) return [];

    const keys = allIds.map((clientId) => `${scenarioKeyPrefix}${clientId}`);
    const values: Array<string | null> = await this.kv.mget(...keys);
    const out: Array<{ clientId: string; scenario: string; note: string | null }> = [];
    for (let i = 0; i < allIds.length; i++) {
      const val = values[i];
      if (!val || !val.trim()) continue;
      const clientId = allIds[i];
      const note: string | null = await this.kv.hget(this.laneNoteHashKey, clientId);
      out.push({ clientId, scenario: val.trim(), note: note && note.trim() ? note.trim() : null });
    }
    return out;
  }

  async setLaneNote(clientId: string, note: string | null): Promise<void> {
    const id = clientId.trim();
    if (!id) throw new Error('clientId is required');
    if (note === null || note.trim() === '') {
      await this.kv.hdel(this.laneNoteHashKey, id);
      return;
    }
    await this.kv.hset(this.laneNoteHashKey, id, note.trim());
  }

  /**
   * Remove lane metadata (scenario override, note, discovery telemetry). Does not delete mock data.
   */
  async removeClientLane(clientId: string): Promise<void> {
    const id = clientId.trim();
    if (!id) throw new Error('clientId is required');
    await this.setLaneScenario(id, null);
    await this.setLaneNote(id, null);
    await this.kv.zrem(this.laneLastSeenZSetKey, id).catch(() => undefined);
    await this.kv.del(this.laneDevicesZSetKey(id)).catch(() => undefined);
    const laneSeg = this.sanitizeObservationSegment(id, 120);
    await this.kv.del(`${this.keyPrefix}:lane_last_resolved:${laneSeg}`).catch(() => undefined);
  }

  private sanitizeObservationSegment(segment: string, maxLen: number): string {
    const raw = segment.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const s = raw || '_';
    return s.length <= maxLen ? s : s.slice(0, maxLen);
  }

  /**
   * Best-effort telemetry: last effective scenario used by `/api/proxy` (14d TTL).
   */
  async recordProxyEffectiveObservation(input: {
    clientId?: string | null;
    deviceId?: string | null;
    effectiveScenario: string;
    resolutionSource: ScenarioResolutionSource;
    clientBodyScenarioOverride: boolean;
  }): Promise<void> {
    const payload: LaneEffectiveObservation = {
      lastEffectiveScenario: input.effectiveScenario,
      lastSeenAt: new Date().toISOString(),
      resolutionSource: input.resolutionSource,
      clientBodyScenarioOverride: input.clientBodyScenarioOverride,
    };
    const ttl = RedisMockStore.EFFECTIVE_TTL_SEC;
    try {
      const lane = input.clientId && input.clientId.trim() ? input.clientId.trim() : '';
      if (lane) {
        const laneSeg = this.sanitizeObservationSegment(lane, 120);
        const laneRedisKey = `${this.keyPrefix}:lane_last_resolved:${laneSeg}`;
        await this.kv.set(laneRedisKey, JSON.stringify(payload), 'EX', ttl).catch(() => undefined);
      }
      const dev = input.deviceId && input.deviceId.trim() ? input.deviceId.trim() : '';
      if (lane && dev) {
        const laneSeg = this.sanitizeObservationSegment(lane, 120);
        const devSeg = this.sanitizeObservationSegment(dev, 120);
        const devKey = `${this.keyPrefix}:device_last_resolved:${laneSeg}:${devSeg}`;
        await this.kv.set(devKey, JSON.stringify(payload), 'EX', ttl).catch(() => undefined);
      }
    } catch {
      // best-effort
    }
  }

  /** Read aggregated last proxy resolution for a lane (configured vs drift lives in dashboard UI). */
  async readLaneLastResolved(clientId: string): Promise<LaneEffectiveObservation | null> {
    const laneSeg = this.sanitizeObservationSegment(clientId, 120);
    const laneRedisKey = `${this.keyPrefix}:lane_last_resolved:${laneSeg}`;
    const raw = await this.kv.get(laneRedisKey);
    if (!raw || typeof raw !== 'string') return null;
    try {
      const o = JSON.parse(raw) as LaneEffectiveObservation;
      if (!o.lastEffectiveScenario || !o.lastSeenAt) return null;
      return o;
    } catch {
      return null;
    }
  }

  /** Per-device sibling of {@link readLaneLastResolved}. */
  async readDeviceLastResolved(clientId: string, deviceId: string): Promise<LaneEffectiveObservation | null> {
    const laneSeg = this.sanitizeObservationSegment(clientId, 120);
    const devSeg = this.sanitizeObservationSegment(deviceId, 120);
    const devKey = `${this.keyPrefix}:device_last_resolved:${laneSeg}:${devSeg}`;
    const raw = await this.kv.get(devKey);
    if (!raw || typeof raw !== 'string') return null;
    try {
      const o = JSON.parse(raw) as LaneEffectiveObservation;
      if (!o.lastEffectiveScenario || !o.lastSeenAt) return null;
      return o;
    } catch {
      return null;
    }
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
    await this.kv.zadd(this.laneLastSeenZSetKey, nowMs, id);
    const minScore = nowMs - ttlMs;
    await this.kv.zremrangebyscore(this.laneLastSeenZSetKey, 0, minScore);
  }

  private laneDevicesZSetKey(clientId: string): string {
    const id = clientId.trim();
    return `${this.laneDeviceLastSeenZSetPrefix}${id || 'default'}`;
  }

  /**
   * Record a device seen for a given lane (best-effort).
   *
   * Uses a sorted set per lane with score = lastSeenMs.
   */
  async recordLaneDeviceSeen(
    clientId: string,
    deviceId: string,
    nowMs: number = Date.now(),
    ttlMs: number = 1000 * 60 * 60 * 24 * 14
  ): Promise<void> {
    const lane = clientId.trim();
    const device = deviceId.trim();
    if (!lane || !device) return;
    const key = this.laneDevicesZSetKey(lane);
    await this.kv.zadd(key, nowMs, device);
    const minScore = nowMs - ttlMs;
    await this.kv.zremrangebyscore(key, 0, minScore);
  }

  /**
   * List recent devices seen for a given lane, newest first.
   */
  async listLaneDevices(
    clientId: string,
    limit: number = 25,
    ttlMs: number = 1000 * 60 * 60 * 24 * 14
  ): Promise<Array<{ deviceId: string; lastSeenMs: number }>> {
    const lane = clientId.trim();
    if (!lane) return [];
    const key = this.laneDevicesZSetKey(lane);
    const nowMs = Date.now();
    const minScore = nowMs - ttlMs;
    // members newest first with their lastSeen score
    const raw: string[] = await this.kv.zrevrangebyscore(key, nowMs, minScore, 'WITHSCORES', 'LIMIT', 0, limit);
    const out: Array<{ deviceId: string; lastSeenMs: number }> = [];
    for (let i = 0; i < raw.length; i += 2) {
      const deviceId = raw[i];
      const score = raw[i + 1];
      const lastSeenMs = typeof score === 'string' ? Number(score) : NaN;
      if (!deviceId || !Number.isFinite(lastSeenMs)) continue;
      out.push({ deviceId: deviceId.trim(), lastSeenMs });
    }
    return out.filter((d) => d.deviceId);
  }

  /**
   * Count devices seen recently for a given lane.
   */
  async countLaneDevices(clientId: string, ttlMs: number = 1000 * 60 * 60 * 24 * 14): Promise<number> {
    const lane = clientId.trim();
    if (!lane) return 0;
    const key = this.laneDevicesZSetKey(lane);
    const nowMs = Date.now();
    const minScore = nowMs - ttlMs;
    const n: number = await this.kv.zcount(key, minScore, nowMs);
    return typeof n === 'number' && Number.isFinite(n) ? n : 0;
  }

  /**
   * List discovered lanes seen recently, newest first.
   * This list includes lanes that might not have an explicit scenario override yet.
   */
  async listDiscoveredLanes(limit: number = 50, ttlMs: number = 1000 * 60 * 60 * 24 * 14): Promise<string[]> {
    const detailed = await this.listDiscoveredLanesDetailed(limit, ttlMs);
    return detailed.map((d) => d.clientId);
  }

  /** Discovered lanes with last-seen timestamps (newest first). */
  async listDiscoveredLanesDetailed(
    limit: number = 50,
    ttlMs: number = 1000 * 60 * 60 * 24 * 14
  ): Promise<Array<{ clientId: string; lastSeenMs: number }>> {
    const nowMs = Date.now();
    const minScore = nowMs - ttlMs;
    const raw: string[] = await this.kv.zrevrangebyscore(
      this.laneLastSeenZSetKey,
      nowMs,
      minScore,
      'WITHSCORES',
      'LIMIT',
      0,
      limit
    );
    const out: Array<{ clientId: string; lastSeenMs: number }> = [];
    for (let i = 0; i < raw.length; i += 2) {
      const clientId = raw[i]?.trim();
      const score = raw[i + 1];
      const lastSeenMs = typeof score === 'string' ? Number(score) : NaN;
      if (!clientId || !Number.isFinite(lastSeenMs)) continue;
      out.push({ clientId, lastSeenMs });
    }
    return out;
  }

  private scenarioMetaRedisKey(scenario: string): string {
    return `${this.keyPrefix}:scenario_meta:${scenario.trim()}`;
  }

  async getScenarioMetaJson(scenario: string): Promise<{ locked?: boolean; updatedAt?: string } | null> {
    const raw = await this.kv.get(this.scenarioMetaRedisKey(scenario));
    if (raw === null || raw === '') return null;
    try {
      return JSON.parse(raw) as { locked?: boolean; updatedAt?: string };
    } catch {
      return null;
    }
  }

  async isScenarioLocked(scenario: string): Promise<boolean> {
    const m = await this.getScenarioMetaJson(scenario);
    return m?.locked === true;
  }

  async setScenarioLocked(scenario: string, locked: boolean): Promise<void> {
    const prev = (await this.getScenarioMetaJson(scenario)) || {};
    const payload = {
      ...prev,
      locked: locked === true,
      updatedAt: new Date().toISOString(),
    };
    await this.kv.set(this.scenarioMetaRedisKey(scenario), JSON.stringify(payload));
  }

  async close(): Promise<void> {
    await this.kv.close();
  }
}

