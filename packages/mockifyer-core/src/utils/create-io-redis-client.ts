export interface CreateIoRedisClientOptions {
  maxRetriesPerRequest?: number;
  /** Force cluster or standalone mode. When unset, uses env then auto-detect. */
  cluster?: boolean;
  clusterOptions?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ParsedRedisUrl {
  host: string;
  port: number;
  password?: string;
  username?: string;
  tls?: Record<string, never>;
}

const clusterModeByUrl = new Map<string, boolean>();
const pendingClusterProbe = new Map<string, Promise<boolean>>();

function envTruthy(key: string): boolean {
  const v = typeof process !== 'undefined' ? process.env[key]?.trim().toLowerCase() : '';
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function envFalsy(key: string): boolean {
  const v = typeof process !== 'undefined' ? process.env[key]?.trim().toLowerCase() : '';
  return v === '0' || v === 'false' || v === 'no' || v === 'off';
}

/** Parse `redis://` / `rediss://` URLs into ioredis connection fields. */
export function parseRedisUrl(redisUrl: string): ParsedRedisUrl {
  const u = new URL(redisUrl);
  const port = u.port ? parseInt(u.port, 10) : u.protocol === 'rediss:' ? 6380 : 6379;
  const password = u.password ? decodeURIComponent(u.password) : undefined;
  const username = u.username ? decodeURIComponent(u.username) : undefined;
  return {
    host: u.hostname,
    port,
    ...(password ? { password } : {}),
    ...(username ? { username } : {}),
    ...(u.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}

function requireIoRedis(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('ioredis');
  } catch {
    throw new Error(
      'Redis requires the optional dependency `ioredis`. Install with: npm install ioredis'
    );
  }
}

function buildRedisOptions(parsed: ParsedRedisUrl, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const { cluster: _cluster, clusterOptions: _clusterOptions, ...rest } = extra;
  return {
    maxRetriesPerRequest: 3,
    ...(parsed.password ? { password: parsed.password } : {}),
    ...(parsed.username ? { username: parsed.username } : {}),
    ...(parsed.tls ? { tls: parsed.tls } : {}),
    ...rest,
  };
}

function createStandaloneClient(redisUrl: string, options: CreateIoRedisClientOptions = {}): any {
  const Redis = requireIoRedis();
  return new Redis(redisUrl, buildRedisOptions(parseRedisUrl(redisUrl), options));
}

function createClusterClient(redisUrl: string, options: CreateIoRedisClientOptions = {}): any {
  const Redis = requireIoRedis();
  const parsed = parseRedisUrl(redisUrl);
  const { cluster: _cluster, clusterOptions, ...redisOptions } = options;
  return new Redis.Cluster([{ host: parsed.host, port: parsed.port }], {
    redisOptions: buildRedisOptions(parsed, redisOptions),
    enableReadyCheck: true,
    slotsRefreshTimeout: 2000,
    ...(clusterOptions || {}),
  });
}

async function probeRedisCluster(redisUrl: string): Promise<boolean> {
  const Redis = requireIoRedis();
  const probe = new Redis(redisUrl, {
    ...buildRedisOptions(parseRedisUrl(redisUrl), {}),
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });
  try {
    await probe.connect();
    const slots = await probe.cluster('slots');
    return Array.isArray(slots) && slots.length > 0;
  } catch {
    return false;
  } finally {
    await probe.quit().catch(() => undefined);
  }
}

/**
 * Resolve whether `redisUrl` points at Redis Cluster.
 * Order: explicit option → `MOCKIFYER_REDIS_CLUSTER` env → cached probe → one-time CLUSTER SLOTS probe.
 */
export async function resolveRedisClusterMode(
  redisUrl: string,
  explicit?: boolean
): Promise<boolean> {
  if (explicit === true) return true;
  if (explicit === false) return false;
  if (envTruthy('MOCKIFYER_REDIS_CLUSTER')) return true;
  if (envFalsy('MOCKIFYER_REDIS_CLUSTER')) return false;

  const cached = clusterModeByUrl.get(redisUrl);
  if (cached !== undefined) return cached;

  let pending = pendingClusterProbe.get(redisUrl);
  if (!pending) {
    pending = probeRedisCluster(redisUrl).then((isCluster) => {
      clusterModeByUrl.set(redisUrl, isCluster);
      pendingClusterProbe.delete(redisUrl);
      return isCluster;
    });
    pendingClusterProbe.set(redisUrl, pending);
  }
  return pending;
}

/** Create an ioredis standalone or cluster client (auto-detects cluster when unset). */
export async function resolveIoRedisClient(
  redisUrl: string,
  options: CreateIoRedisClientOptions = {}
): Promise<any> {
  const useCluster = await resolveRedisClusterMode(redisUrl, options.cluster);
  return useCluster ? createClusterClient(redisUrl, options) : createStandaloneClient(redisUrl, options);
}

/** Reset cached cluster detection (tests only). */
export function resetRedisClusterModeCacheForTests(): void {
  clusterModeByUrl.clear();
  pendingClusterProbe.clear();
}
