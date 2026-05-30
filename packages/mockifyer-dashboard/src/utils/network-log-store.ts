import * as crypto from 'crypto';
import {
  buildNetworkEvent,
  NETWORK_LOG_DEFAULT_MAX_EVENTS,
  NETWORK_LOG_DEFAULT_TTL_SEC,
  parseNetworkLogIntEnv,
  type NetworkEvent,
} from '@sgedda/mockifyer-core';
import type { DashboardContextConfig } from './dashboard-context';
import { resolveDashboardSqlitePath } from './create-dashboard-mock-store';
import { openDashboardSqliteDatabase } from './sqlite-database';

export interface NetworkLogScenarioConfig {
  enabled: boolean;
  captureBodies: boolean;
  updatedAt: string;
}

export interface NetworkLogListOptions {
  scenario: string;
  clientId?: string;
  limit?: number;
  /** ISO-8601 timestamp — return events strictly after this instant. */
  since?: string;
}

export interface NetworkLogStore {
  getConfig(scenario: string): Promise<NetworkLogScenarioConfig>;
  setConfig(scenario: string, patch: Partial<Pick<NetworkLogScenarioConfig, 'enabled' | 'captureBodies'>>): Promise<NetworkLogScenarioConfig>;
  append(scenario: string, partial: Omit<NetworkEvent, 'id' | 'timestamp' | 'scenario'> & { id?: string; timestamp?: string }): Promise<NetworkEvent | null>;
  list(options: NetworkLogListOptions): Promise<{ events: NetworkEvent[]; ephemeral: boolean }>;
  clear(options: { scenario: string; clientId?: string }): Promise<number>;
  close(): Promise<void>;
}

function defaultConfig(): NetworkLogScenarioConfig {
  return {
    enabled: true,
    captureBodies: false,
    updatedAt: new Date().toISOString(),
  };
}

function requireIoRedis(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('ioredis');
  } catch {
    throw new Error(
      "Network log Redis store requires optional dependency 'ioredis'. Install it in the dashboard package."
    );
  }
}

function maxEvents(): number {
  return parseNetworkLogIntEnv(process.env.MOCKIFYER_NETWORK_LOG_MAX_EVENTS, NETWORK_LOG_DEFAULT_MAX_EVENTS);
}

function ttlSec(): number {
  return parseNetworkLogIntEnv(process.env.MOCKIFYER_NETWORK_LOG_TTL_SEC, NETWORK_LOG_DEFAULT_TTL_SEC);
}

function filterSince(events: NetworkEvent[], since?: string): NetworkEvent[] {
  if (!since) return events;
  const sinceMs = Date.parse(since);
  if (!Number.isFinite(sinceMs)) return events;
  return events.filter((e) => Date.parse(e.timestamp) > sinceMs);
}

function filterClient(events: NetworkEvent[], clientId?: string): NetworkEvent[] {
  if (!clientId?.trim()) return events;
  const lane = clientId.trim();
  return events.filter((e) => (e.clientId ?? '') === lane);
}

class MemoryNetworkLogStore implements NetworkLogStore {
  private readonly buffers = new Map<string, NetworkEvent[]>();
  private readonly configs = new Map<string, NetworkLogScenarioConfig>();
  private readonly max = maxEvents();

  private bufferKey(scenario: string): string {
    return scenario.trim() || 'default';
  }

  async getConfig(scenario: string): Promise<NetworkLogScenarioConfig> {
    return this.configs.get(this.bufferKey(scenario)) ?? defaultConfig();
  }

  async setConfig(
    scenario: string,
    patch: Partial<Pick<NetworkLogScenarioConfig, 'enabled' | 'captureBodies'>>
  ): Promise<NetworkLogScenarioConfig> {
    const key = this.bufferKey(scenario);
    const prev = this.configs.get(key) ?? defaultConfig();
    const next: NetworkLogScenarioConfig = {
      enabled: patch.enabled ?? prev.enabled,
      captureBodies: patch.captureBodies ?? prev.captureBodies,
      updatedAt: new Date().toISOString(),
    };
    this.configs.set(key, next);
    return next;
  }

  async append(
    scenario: string,
    partial: Omit<NetworkEvent, 'id' | 'timestamp' | 'scenario'> & { id?: string; timestamp?: string }
  ): Promise<NetworkEvent | null> {
    const cfg = await this.getConfig(scenario);
    if (!cfg.enabled) return null;

    const event = buildNetworkEvent(
      { ...partial, scenario: this.bufferKey(scenario) },
      { captureBodies: cfg.captureBodies }
    );

    const key = this.bufferKey(scenario);
    const buf = this.buffers.get(key) ?? [];
    buf.unshift(event);
    if (buf.length > this.max) {
      buf.length = this.max;
    }
    this.buffers.set(key, buf);
    return event;
  }

  async list(options: NetworkLogListOptions): Promise<{ events: NetworkEvent[]; ephemeral: boolean }> {
    const key = this.bufferKey(options.scenario);
    const limit = Math.min(Math.max(options.limit ?? 200, 1), this.max);
    let events = [...(this.buffers.get(key) ?? [])];
    events = filterClient(events, options.clientId);
    events = filterSince(events, options.since);
    return { events: events.slice(0, limit), ephemeral: true };
  }

  async clear(options: { scenario: string; clientId?: string }): Promise<number> {
    const key = this.bufferKey(options.scenario);
    const buf = this.buffers.get(key) ?? [];
    if (!options.clientId?.trim()) {
      const n = buf.length;
      this.buffers.set(key, []);
      return n;
    }
    const lane = options.clientId.trim();
    const kept = buf.filter((e) => (e.clientId ?? '') !== lane);
    const removed = buf.length - kept.length;
    this.buffers.set(key, kept);
    return removed;
  }

  async close(): Promise<void> {
    // no-op
  }
}

class RedisNetworkLogStore implements NetworkLogStore {
  private readonly redis: any;
  private readonly keyPrefix: string;
  private readonly max = maxEvents();
  private readonly ttl = ttlSec();

  constructor(redisUrl: string, keyPrefix?: string) {
    const RedisCtor = requireIoRedis();
    this.keyPrefix = keyPrefix || 'mockifyer:v1';
    this.redis = new RedisCtor(redisUrl, { maxRetriesPerRequest: 3 });
  }

  private eventsKey(scenario: string): string {
    return `${this.keyPrefix}:network_events:${scenario.trim() || 'default'}`;
  }

  private configKey(scenario: string): string {
    return `${this.keyPrefix}:network_log_config:${scenario.trim() || 'default'}`;
  }

  async getConfig(scenario: string): Promise<NetworkLogScenarioConfig> {
    const raw = await this.redis.get(this.configKey(scenario));
    if (!raw) return defaultConfig();
    try {
      const o = JSON.parse(raw);
      return {
        enabled: o.enabled !== false,
        captureBodies: o.captureBodies === true,
        updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : new Date().toISOString(),
      };
    } catch {
      return defaultConfig();
    }
  }

  async setConfig(
    scenario: string,
    patch: Partial<Pick<NetworkLogScenarioConfig, 'enabled' | 'captureBodies'>>
  ): Promise<NetworkLogScenarioConfig> {
    const prev = await this.getConfig(scenario);
    const next: NetworkLogScenarioConfig = {
      enabled: patch.enabled ?? prev.enabled,
      captureBodies: patch.captureBodies ?? prev.captureBodies,
      updatedAt: new Date().toISOString(),
    };
    await this.redis.set(this.configKey(scenario), JSON.stringify(next));
    return next;
  }

  async append(
    scenario: string,
    partial: Omit<NetworkEvent, 'id' | 'timestamp' | 'scenario'> & { id?: string; timestamp?: string }
  ): Promise<NetworkEvent | null> {
    const cfg = await this.getConfig(scenario);
    if (!cfg.enabled) return null;

    const event = buildNetworkEvent(
      { ...partial, scenario: scenario.trim() || 'default' },
      { captureBodies: cfg.captureBodies }
    );

    const listKey = this.eventsKey(scenario);
    const payload = JSON.stringify(event);
    await this.redis
      .multi()
      .lpush(listKey, payload)
      .ltrim(listKey, 0, this.max - 1)
      .expire(listKey, this.ttl)
      .exec();

    return event;
  }

  async list(options: NetworkLogListOptions): Promise<{ events: NetworkEvent[]; ephemeral: boolean }> {
    const limit = Math.min(Math.max(options.limit ?? 200, 1), this.max);
    const raw: string[] = await this.redis.lrange(this.eventsKey(options.scenario), 0, this.max - 1);
    let events: NetworkEvent[] = [];
    for (const line of raw) {
      try {
        events.push(JSON.parse(line) as NetworkEvent);
      } catch {
        // skip corrupt entries
      }
    }
    events = filterClient(events, options.clientId);
    events = filterSince(events, options.since);
    return { events: events.slice(0, limit), ephemeral: false };
  }

  async clear(options: { scenario: string; clientId?: string }): Promise<number> {
    const listKey = this.eventsKey(options.scenario);
    if (!options.clientId?.trim()) {
      const len = await this.redis.llen(listKey);
      await this.redis.del(listKey);
      return typeof len === 'number' ? len : 0;
    }

    const lane = options.clientId.trim();
    const raw: string[] = await this.redis.lrange(listKey, 0, -1);
    const kept: string[] = [];
    let removed = 0;
    for (const line of raw) {
      try {
        const ev = JSON.parse(line) as NetworkEvent;
        if ((ev.clientId ?? '') === lane) {
          removed += 1;
        } else {
          kept.push(line);
        }
      } catch {
        kept.push(line);
      }
    }
    if (removed === 0) return 0;
    const pipe = this.redis.pipeline();
    pipe.del(listKey);
    if (kept.length > 0) {
      for (let i = kept.length - 1; i >= 0; i -= 1) {
        pipe.rpush(listKey, kept[i]);
      }
      pipe.expire(listKey, this.ttl);
    }
    await pipe.exec();
    return removed;
  }

  async close(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}

/** Process-wide ephemeral store for filesystem dashboard provider. */
const memorySingleton = new MemoryNetworkLogStore();

class SqliteNetworkLogStore implements NetworkLogStore {
  private readonly db: any;
  private readonly keyPrefix: string;
  private readonly max = maxEvents();
  private readonly ttl = ttlSec();

  constructor(dbPath: string, keyPrefix?: string) {
    this.keyPrefix = keyPrefix || 'mockifyer:v1';
    this.db = openDashboardSqliteDatabase(
      dbPath,
      "Network log SQLite store requires optional dependency 'better-sqlite3'. Install it in the dashboard package."
    );
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS network_log_config (
        scenario TEXT PRIMARY KEY NOT NULL,
        json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS network_log_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scenario TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_network_log_scenario ON network_log_events(scenario, id DESC);
    `);
  }

  private eventsKey(scenario: string): string {
    return scenario.trim() || 'default';
  }

  async getConfig(scenario: string): Promise<NetworkLogScenarioConfig> {
    const row = this.db
      .prepare(`SELECT json FROM network_log_config WHERE scenario = ?`)
      .get(this.eventsKey(scenario)) as { json: string } | undefined;
    if (!row?.json) return defaultConfig();
    try {
      const o = JSON.parse(row.json);
      return {
        enabled: o.enabled !== false,
        captureBodies: o.captureBodies === true,
        updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : new Date().toISOString(),
      };
    } catch {
      return defaultConfig();
    }
  }

  async setConfig(
    scenario: string,
    patch: Partial<Pick<NetworkLogScenarioConfig, 'enabled' | 'captureBodies'>>
  ): Promise<NetworkLogScenarioConfig> {
    const prev = await this.getConfig(scenario);
    const next: NetworkLogScenarioConfig = {
      enabled: patch.enabled ?? prev.enabled,
      captureBodies: patch.captureBodies ?? prev.captureBodies,
      updatedAt: new Date().toISOString(),
    };
    this.db
      .prepare(
        `INSERT INTO network_log_config (scenario, json) VALUES (?, ?)
         ON CONFLICT(scenario) DO UPDATE SET json = excluded.json`
      )
      .run(this.eventsKey(scenario), JSON.stringify(next));
    return next;
  }

  async append(
    scenario: string,
    partial: Omit<NetworkEvent, 'id' | 'timestamp' | 'scenario'> & { id?: string; timestamp?: string }
  ): Promise<NetworkEvent | null> {
    const cfg = await this.getConfig(scenario);
    if (!cfg.enabled) return null;

    const event = buildNetworkEvent(
      { ...partial, scenario: this.eventsKey(scenario) },
      { captureBodies: cfg.captureBodies }
    );

    const now = Date.now();
    const minTs = now - this.ttl * 1000;
    const sc = this.eventsKey(scenario);
    const insert = this.db.prepare(
      `INSERT INTO network_log_events (scenario, payload, created_at) VALUES (?, ?, ?)`
    );
    const purge = this.db.prepare(
      `DELETE FROM network_log_events WHERE scenario = ? AND created_at < ?`
    );
    const trim = this.db.prepare(
      `DELETE FROM network_log_events WHERE scenario = ? AND id NOT IN (
         SELECT id FROM network_log_events WHERE scenario = ? ORDER BY id DESC LIMIT ?
       )`
    );
    const run = this.db.transaction(() => {
      purge.run(sc, minTs);
      insert.run(sc, JSON.stringify(event), now);
      trim.run(sc, sc, this.max);
    });
    run();
    return event;
  }

  async list(options: NetworkLogListOptions): Promise<{ events: NetworkEvent[]; ephemeral: boolean }> {
    const limit = Math.min(Math.max(options.limit ?? 200, 1), this.max);
    const sc = this.eventsKey(options.scenario);
    const minTs = Date.now() - this.ttl * 1000;
    const rows = this.db
      .prepare(
        `SELECT payload FROM network_log_events
         WHERE scenario = ? AND created_at >= ?
         ORDER BY id DESC
         LIMIT ?`
      )
      .all(sc, minTs, this.max) as Array<{ payload: string }>;

    let events: NetworkEvent[] = [];
    for (const row of rows) {
      try {
        events.push(JSON.parse(row.payload) as NetworkEvent);
      } catch {
        // skip
      }
    }
    events = filterClient(events, options.clientId);
    events = filterSince(events, options.since);
    return { events: events.slice(0, limit), ephemeral: false };
  }

  async clear(options: { scenario: string; clientId?: string }): Promise<number> {
    const sc = this.eventsKey(options.scenario);
    if (!options.clientId?.trim()) {
      const count = this.db
        .prepare(`SELECT COUNT(*) AS c FROM network_log_events WHERE scenario = ?`)
        .get(sc) as { c: number };
      this.db.prepare(`DELETE FROM network_log_events WHERE scenario = ?`).run(sc);
      return count?.c ?? 0;
    }

    const lane = options.clientId.trim();
    const rows = this.db
      .prepare(`SELECT id, payload FROM network_log_events WHERE scenario = ?`)
      .all(sc) as Array<{ id: number; payload: string }>;
    const del = this.db.prepare(`DELETE FROM network_log_events WHERE id = ?`);
    let removed = 0;
    const run = this.db.transaction(() => {
      for (const row of rows) {
        try {
          const ev = JSON.parse(row.payload) as NetworkEvent;
          if ((ev.clientId ?? '') === lane) {
            del.run(row.id);
            removed += 1;
          }
        } catch {
          // keep
        }
      }
    });
    run();
    return removed;
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export function createNetworkLogStore(config: DashboardContextConfig): NetworkLogStore {
  if (config.provider === 'redis') {
    const redisUrl = config.redisUrl || process.env.MOCKIFYER_REDIS_URL || '';
    if (!redisUrl) {
      throw new Error('Redis provider requires redisUrl or MOCKIFYER_REDIS_URL');
    }
    return new RedisNetworkLogStore(redisUrl, config.keyPrefix);
  }
  if (config.provider === 'sqlite') {
    const dataPath = config.mockDataPath || process.env.MOCKIFYER_PATH || './mock-data';
    const dbPath = resolveDashboardSqlitePath(dataPath, config);
    return new SqliteNetworkLogStore(dbPath, config.keyPrefix);
  }
  return memorySingleton;
}

export function newRequestId(): string {
  return crypto.randomUUID();
}
