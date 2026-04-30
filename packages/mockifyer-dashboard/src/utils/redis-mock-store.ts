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

  constructor(config: RedisMockStoreConfig) {
    this.mockDataPath = config.mockDataPath;
    this.keyPrefix = config.keyPrefix || 'mockifyer:v1';
    this.activeScenarioKey = `${this.keyPrefix}:active_scenario`;
    this.useCentralizedScenario = true;

    const RedisCtor = requireIoRedis();
    this.redis = new RedisCtor(config.redisUrl, {
      maxRetriesPerRequest: 3,
      ...(config.redisOptions || {}),
    });
  }

  private async scenarioKey(scenarioOverride?: string): Promise<string> {
    if (scenarioOverride) return scenarioOverride;
    if (this.useCentralizedScenario) {
      const centralizedScenario = await this.redis.get(this.activeScenarioKey);
      if (typeof centralizedScenario === 'string' && centralizedScenario.trim()) {
        return centralizedScenario.trim();
      }
    }
    return getCurrentScenario(this.mockDataPath);
  }

  private async indexKey(scenarioOverride?: string): Promise<string> {
    return `${this.keyPrefix}:index:${await this.scenarioKey(scenarioOverride)}`;
  }

  private async dataKey(hash: string, scenarioOverride?: string): Promise<string> {
    return `${this.keyPrefix}:mock:${await this.scenarioKey(scenarioOverride)}:${hash}`;
  }

  async getActiveScenario(): Promise<string> {
    return this.scenarioKey();
  }

  async setActiveScenario(scenario: string): Promise<void> {
    await this.redis.set(this.activeScenarioKey, scenario);
  }

  async ping(): Promise<void> {
    await this.redis.ping();
  }

  async list(scenario?: string): Promise<RedisMockListItem[]> {
    const indexKey = await this.indexKey(scenario);
    const hashes: string[] = await this.redis.smembers(indexKey);
    if (hashes.length === 0) return [];

    const keys = await Promise.all(hashes.map((h) => this.dataKey(h, scenario)));
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
    const dataKey = await this.dataKey(hash, scenario);
    const raw: string | null = await this.redis.get(dataKey);
    if (!raw) return null;
    return JSON.parse(raw) as MockData;
  }

  /** Compute the canonical hash for a stored mock. */
  static hashForMock(mockData: MockData): string {
    const requestKey = generateRequestKey(mockData.request);
    return sha256Hex(requestKey);
  }

  async setByHash(hash: string, mockData: MockData, scenario?: string): Promise<void> {
    const key = await this.dataKey(hash, scenario);
    const indexKey = await this.indexKey(scenario);
    await this.redis.set(key, JSON.stringify(mockData));
    await this.redis.sadd(indexKey, hash);
  }

  async deleteByHash(hash: string, scenario?: string): Promise<void> {
    const dataKey = await this.dataKey(hash, scenario);
    const indexKey = await this.indexKey(scenario);
    await this.redis.del(dataKey);
    await this.redis.srem(indexKey, hash);
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

