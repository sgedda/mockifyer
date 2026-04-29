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

  constructor(config: RedisMockStoreConfig) {
    this.mockDataPath = config.mockDataPath;
    this.keyPrefix = config.keyPrefix || 'mockifyer:v1';

    const RedisCtor = requireIoRedis();
    this.redis = new RedisCtor(config.redisUrl, {
      maxRetriesPerRequest: 3,
      ...(config.redisOptions || {}),
    });
  }

  private scenarioKey(scenarioOverride?: string): string {
    if (scenarioOverride) return scenarioOverride;
    return getCurrentScenario(this.mockDataPath);
  }

  private indexKey(scenarioOverride?: string): string {
    return `${this.keyPrefix}:index:${this.scenarioKey(scenarioOverride)}`;
  }

  private dataKey(hash: string, scenarioOverride?: string): string {
    return `${this.keyPrefix}:mock:${this.scenarioKey(scenarioOverride)}:${hash}`;
  }

  async ping(): Promise<void> {
    await this.redis.ping();
  }

  async list(scenario?: string): Promise<RedisMockListItem[]> {
    const hashes: string[] = await this.redis.smembers(this.indexKey(scenario));
    if (hashes.length === 0) return [];

    const keys = hashes.map((h) => this.dataKey(h, scenario));
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

  async getByHash(hash: string, scenario?: string): Promise<MockData | null> {
    const raw: string | null = await this.redis.get(this.dataKey(hash, scenario));
    if (!raw) return null;
    return JSON.parse(raw) as MockData;
  }

  /** Compute the canonical hash for a stored mock. */
  static hashForMock(mockData: MockData): string {
    const requestKey = generateRequestKey(mockData.request);
    return sha256Hex(requestKey);
  }

  async setByHash(hash: string, mockData: MockData, scenario?: string): Promise<void> {
    const key = this.dataKey(hash, scenario);
    await this.redis.set(key, JSON.stringify(mockData));
    await this.redis.sadd(this.indexKey(scenario), hash);
  }

  async deleteByHash(hash: string, scenario?: string): Promise<void> {
    await this.redis.del(this.dataKey(hash, scenario));
    await this.redis.srem(this.indexKey(scenario), hash);
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }

  /**
   * Best-effort scenario discovery for dashboard UI.
   * Scans for `${keyPrefix}:index:*` keys and extracts the scenario suffix.
   */
  async listScenarios(): Promise<string[]> {
    const pattern = `${this.keyPrefix}:index:*`;
    const scenarios = new Set<string>();
    let cursor = '0';
    do {
      const [next, keys]: [string, string[]] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', '200');
      cursor = next;
      for (const k of keys) {
        const parts = k.split(':index:');
        if (parts.length === 2 && parts[1]) {
          scenarios.add(parts[1]);
        }
      }
    } while (cursor !== '0');

    return Array.from(scenarios).sort();
  }
}

