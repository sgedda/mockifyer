import * as crypto from 'crypto';
import { MockData, StoredRequest } from '../types';
import { CachedMockData, generateRequestKey } from '../utils/mock-matcher';
import { DatabaseProvider, DatabaseProviderConfig, SaveMockOptions } from './types';
import { getCurrentScenario } from '../utils/scenario';
import { logger } from '../utils/logger';

function hashRequestKey(requestKey: string): string {
  return crypto.createHash('sha256').update(requestKey).digest('hex');
}

/**
 * Node-only: stores mocks in Redis. Keys are hashed (SHA-256) request keys; values are JSON {@link MockData}.
 * Requires optional dependency `ioredis` (`npm install ioredis`).
 *
 * - `config.path`: Redis URL (default `redis://127.0.0.1:6379` or `MOCKIFYER_REDIS_URL`)
 * - `config.options.mockDataPath`: same as main Mockifyer `mockDataPath` (for scenario isolation)
 * - `config.options.keyPrefix`: Redis key prefix (default `mockifyer:v1`)
 */
export class RedisProvider implements DatabaseProvider {
  /** ioredis client (optional peer dependency). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private redis: any;

  private readonly mockDataPath: string;

  private readonly keyPrefix: string;

  private readonly redisUrl: string;
  private readonly activeScenarioKey: string;
  private readonly useCentralizedScenario: boolean;

  constructor(config: DatabaseProviderConfig) {
    this.redisUrl =
      config.path || (typeof process !== 'undefined' && process.env?.MOCKIFYER_REDIS_URL) || 'redis://127.0.0.1:6379';
    this.mockDataPath = (config.options?.mockDataPath as string) || '.';
    this.keyPrefix = (config.options?.keyPrefix as string) || 'mockifyer:v1';
    this.activeScenarioKey =
      (config.options?.activeScenarioKey as string) || `${this.keyPrefix}:active_scenario`;
    this.useCentralizedScenario = (config.options?.useCentralizedScenario as boolean) ?? true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let RedisCtor: any;
    try {
      RedisCtor = require('ioredis');
    } catch {
      throw new Error(
        'Redis provider requires the optional dependency `ioredis`. Install with: npm install ioredis'
      );
    }
    const maxRetries = (config.options?.maxRetriesPerRequest as number) ?? 3;
    const extraIo = (config.options?.redis as Record<string, unknown> | undefined) || {};
    this.redis = new RedisCtor(this.redisUrl, {
      maxRetriesPerRequest: maxRetries,
      ...extraIo,
    });
  }

  private async scenarioKey(scenarioOverride?: string): Promise<string> {
    if (scenarioOverride) return scenarioOverride;
    if (!this.useCentralizedScenario) return getCurrentScenario(this.mockDataPath);

    const centralizedScenario = await this.redis.get(this.activeScenarioKey);
    if (typeof centralizedScenario === 'string' && centralizedScenario.trim()) {
      return centralizedScenario.trim();
    }

    return getCurrentScenario(this.mockDataPath);
  }

  private async indexKey(scenarioOverride?: string): Promise<string> {
    return `${this.keyPrefix}:index:${await this.scenarioKey(scenarioOverride)}`;
  }

  private async dataKey(hash: string, scenarioOverride?: string): Promise<string> {
    return `${this.keyPrefix}:mock:${await this.scenarioKey(scenarioOverride)}:${hash}`;
  }

  async initialize(): Promise<void> {
    await this.redis.ping();
    const scenario = await this.scenarioKey();
    logger.info(`[RedisProvider] Connected; prefix=${this.keyPrefix} scenario=${scenario}`);
  }

  async save(mockData: MockData, _options?: SaveMockOptions): Promise<void> {
    const requestKey = generateRequestKey(mockData.request);
    const h = hashRequestKey(requestKey);
    const key = await this.dataKey(h);
    const payload = JSON.stringify(mockData);
    await this.redis.set(key, payload);
    const scenarioIndex = await this.indexKey();
    await this.redis.sadd(scenarioIndex, h);
    logger.debug(`[RedisProvider] Saved mock ${h.slice(0, 12)}… (${payload.length} bytes)`);
  }

  async findExactMatch(
    _request: StoredRequest,
    requestKey: string
  ): Promise<CachedMockData | undefined> {
    const h = hashRequestKey(requestKey);
    const dataKey = await this.dataKey(h);
    const raw = await this.redis.get(dataKey);
    if (!raw) {
      return undefined;
    }
    const mockData = JSON.parse(raw) as MockData;
    return {
      mockData,
      filename: `redis_${h.slice(0, 16)}.json`,
      filePath: `redis://${dataKey}`,
    };
  }

  async findAllForSimilarMatch(request: StoredRequest): Promise<CachedMockData[]> {
    const results: CachedMockData[] = [];
    try {
      const requestUrl = new URL(request.url);
      const requestPath = requestUrl.pathname;
      const requestMethod = (request.method || 'GET').toUpperCase();

      const scenarioIndex = await this.indexKey();
      const members = await this.redis.smembers(scenarioIndex);
      if (members.length === 0) {
        return [];
      }

      const keys = await Promise.all(members.map((h: string) => this.dataKey(h)));
      const values = await this.redis.mget(...keys);

      for (let i = 0; i < members.length; i++) {
        const raw = values[i];
        if (!raw) continue;
        try {
          const mockData = JSON.parse(raw) as MockData;
          const mockUrl = new URL(mockData.request.url);
          const mockPath = mockUrl.pathname;
          const mockMethod = (mockData.request.method || 'GET').toUpperCase();
          if (mockPath === requestPath && mockMethod === requestMethod) {
            const h = members[i];
            results.push({
              mockData,
              filename: `redis_${h.slice(0, 16)}.json`,
              filePath: `redis://${keys[i]}`,
            });
          }
        } catch {
          continue;
        }
      }
    } catch {
      return [];
    }

    return results.sort((a, b) => {
      const timeA = new Date(a.mockData.timestamp).getTime();
      const timeB = new Date(b.mockData.timestamp).getTime();
      return timeB - timeA;
    });
  }

  async exists(requestKey: string): Promise<boolean> {
    const h = hashRequestKey(requestKey);
    const dataKey = await this.dataKey(h);
    const n = await this.redis.exists(dataKey);
    return n === 1;
  }

  async getAll(): Promise<MockData[]> {
    const scenarioIndex = await this.indexKey();
    const members = await this.redis.smembers(scenarioIndex);
    if (members.length === 0) {
      return [];
    }
    const keys = await Promise.all(members.map((h: string) => this.dataKey(h)));
    const values = await this.redis.mget(...keys);
    const out: MockData[] = [];
    for (const raw of values) {
      if (!raw) continue;
      try {
        out.push(JSON.parse(raw) as MockData);
      } catch {
        continue;
      }
    }
    return out.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    });
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }

  async clearAll(): Promise<void> {
    const scenario = await this.scenarioKey();
    const scenarioIndex = await this.indexKey(scenario);
    const members = await this.redis.smembers(scenarioIndex);
    if (members.length > 0) {
      const keys = await Promise.all(members.map((h: string) => this.dataKey(h, scenario)));
      await this.redis.del(...keys);
    }
    await this.redis.del(scenarioIndex);
    logger.info(`[RedisProvider] Cleared scenario ${scenario}`);
  }
}
