import { isRedisMovedError } from './redis-cluster-ops';

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

interface RedisEndpoint {
  host: string;
  port: number;
}

type ClusterNatMap = Record<string, { host: string; port: number }>;

interface ClusterDiscovery {
  isCluster: boolean;
  natMap?: ClusterNatMap;
}

const clusterDiscoveryByUrl = new Map<string, ClusterDiscovery>();
const pendingClusterDiscovery = new Map<string, Promise<ClusterDiscovery>>();

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

/** Extract host:port pairs from a Redis `CLUSTER SLOTS` reply. */
export function extractNodesFromClusterSlots(slots: unknown): RedisEndpoint[] {
  if (!Array.isArray(slots)) return [];
  const seen = new Set<string>();
  const nodes: RedisEndpoint[] = [];

  const pushNode = (host: unknown, port: unknown): void => {
    const h = String(host ?? '').trim();
    const p = Number(port);
    if (!h || !Number.isFinite(p)) return;
    const key = `${h}:${p}`;
    if (seen.has(key)) return;
    seen.add(key);
    nodes.push({ host: h, port: p });
  };

  for (const row of slots) {
    if (!Array.isArray(row) || row.length < 4) continue;
    // ioredis flat form: [start, end, host, port, host, port, ...]
    if (typeof row[2] === 'string' || typeof row[2] === 'number') {
      for (let i = 2; i + 1 < row.length; i += 2) {
        pushNode(row[i], row[i + 1]);
      }
      continue;
    }
    // Nested host/port groups after start/end
    for (let j = 2; j < row.length; j++) {
      const group = row[j];
      if (!Array.isArray(group)) continue;
      for (let i = 0; i + 1 < group.length; i += 2) {
        pushNode(group[i], group[i + 1]);
      }
    }
  }
  return nodes;
}

/** Map discovered cluster node addresses to a single reachable endpoint (managed Redis). */
export function buildClusterNatMapToEndpoint(
  nodes: RedisEndpoint[],
  endpoint: RedisEndpoint,
  mapUnknownToEndpoint = false
): ClusterNatMap {
  const target = { host: endpoint.host, port: endpoint.port };
  const natMap: ClusterNatMap = {};
  natMap[`${endpoint.host}:${endpoint.port}`] = target;
  for (const node of nodes) {
    natMap[`${node.host}:${node.port}`] = target;
  }
  if (!mapUnknownToEndpoint) return natMap;

  // ioredis looks up natMap by the host:port strings returned from CLUSTER SLOTS/MOVED.
  // In forced cluster mode we may not know those private addresses until ioredis asks.
  return new Proxy(natMap, {
    get(record, prop, receiver) {
      if (typeof prop === 'string' && /^[^\s]+:\d+$/.test(prop)) {
        return Reflect.get(record, prop, receiver) ?? target;
      }
      return Reflect.get(record, prop, receiver);
    },
  });
}

function isLoopbackHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
}

function isPrivateIpv4(host: string): boolean {
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host.trim());
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/**
 * Whether to remap CLUSTER SLOTS node addresses to the configured URL endpoint.
 * Managed cloud Redis often announces unreachable internal IPs; local docker clusters should not remap.
 */
export function shouldBuildClusterNatMap(endpoint: RedisEndpoint, nodes: RedisEndpoint[]): boolean {
  if (envTruthy('MOCKIFYER_REDIS_CLUSTER_NAT_MAP')) return true;
  if (envFalsy('MOCKIFYER_REDIS_CLUSTER_NAT_MAP')) return false;
  if (isLoopbackHost(endpoint.host)) return false;
  if (nodes.length === 0) return false;
  return nodes.some(
    (node) =>
      node.host !== endpoint.host ||
      node.port !== endpoint.port ||
      isPrivateIpv4(node.host)
  );
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
  const tlsServername =
    typeof process !== 'undefined' ? process.env.MOCKIFYER_REDIS_TLS_SERVERNAME?.trim() : '';
  return {
    maxRetriesPerRequest: 3,
    ...(parsed.password ? { password: parsed.password } : {}),
    ...(parsed.username ? { username: parsed.username } : {}),
    ...(parsed.tls
      ? {
          tls: {
            ...parsed.tls,
            servername: tlsServername || parsed.host,
          },
        }
      : {}),
    ...rest,
  };
}

function attachRedisErrorHandler(client: any): void {
  if (!client || typeof client.on !== 'function') return;
  client.on('error', (err: Error) => {
    const msg = err?.message || String(err);
    if (msg.includes('Failed to refresh slots cache')) {
      console.warn(`[mockifyer][redis] ${msg} (cluster slot refresh; check NAT/TLS or set MOCKIFYER_REDIS_CLUSTER_NAT_MAP=1)`);
      return;
    }
    console.warn(`[mockifyer][redis] ${msg}`);
  });
}

function createStandaloneClient(redisUrl: string, options: CreateIoRedisClientOptions = {}): any {
  const Redis = requireIoRedis();
  const client = new Redis(redisUrl, buildRedisOptions(parseRedisUrl(redisUrl), options));
  attachRedisErrorHandler(client);
  return client;
}

function createClusterClient(
  redisUrl: string,
  options: CreateIoRedisClientOptions = {},
  discovery?: ClusterDiscovery
): any {
  const Redis = requireIoRedis();
  const parsed = parseRedisUrl(redisUrl);
  const endpoint = { host: parsed.host, port: parsed.port };
  const { cluster: _cluster, clusterOptions, ...redisOptions } = options;
  const client = new Redis.Cluster([endpoint], {
    redisOptions: buildRedisOptions(parsed, redisOptions),
    enableReadyCheck: true,
    slotsRefreshTimeout: 10000,
    dnsLookup: (address: string, callback: (err: Error | null, address: string) => void) => {
      callback(null, address);
    },
    ...(discovery?.natMap ? { natMap: discovery.natMap } : {}),
    ...(clusterOptions || {}),
  });
  attachRedisErrorHandler(client);
  return client;
}

/**
 * NAT map for managed cluster endpoints. Non-loopback URLs always remap to the configured
 * host:port (Azure/AWS single-endpoint cluster). Set MOCKIFYER_REDIS_CLUSTER_NAT_MAP=false to disable.
 */
function clusterNatMapForEndpoint(
  endpoint: RedisEndpoint,
  nodes: RedisEndpoint[] = []
): ClusterNatMap | undefined {
  if (envFalsy('MOCKIFYER_REDIS_CLUSTER_NAT_MAP')) return undefined;
  const remapUnknownNodes = nodes.length === 0 && !isLoopbackHost(endpoint.host);
  if (envTruthy('MOCKIFYER_REDIS_CLUSTER_NAT_MAP') || !isLoopbackHost(endpoint.host)) {
    return buildClusterNatMapToEndpoint(nodes, endpoint, remapUnknownNodes);
  }
  if (shouldBuildClusterNatMap(endpoint, nodes)) {
    return buildClusterNatMapToEndpoint(nodes, endpoint);
  }
  return undefined;
}

function forcedClusterDiscovery(redisUrl: string, nodes: RedisEndpoint[] = []): ClusterDiscovery {
  const parsed = parseRedisUrl(redisUrl);
  const endpoint = { host: parsed.host, port: parsed.port };
  const natMap = clusterNatMapForEndpoint(endpoint, nodes);
  return { isCluster: true, ...(natMap ? { natMap } : {}) };
}

async function probeRedisClusterDiscovery(redisUrl: string): Promise<ClusterDiscovery> {
  const parsed = parseRedisUrl(redisUrl);
  const endpoint = { host: parsed.host, port: parsed.port };
  let Redis: any;
  try {
    Redis = requireIoRedis();
  } catch {
    return { isCluster: false };
  }
  const probe = new Redis(redisUrl, {
    ...buildRedisOptions(parsed, {}),
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });
  try {
    await probe.connect();
    try {
      const slots = await probe.cluster('slots');
      const nodes = extractNodesFromClusterSlots(slots);
      if (nodes.length > 0) {
        const natMap = clusterNatMapForEndpoint(endpoint, nodes);
        return { isCluster: true, ...(natMap ? { natMap } : {}) };
      }
    } catch {
      // CLUSTER SLOTS may fail on some proxies; try INFO cluster next.
    }
    const info = await probe.info('cluster');
    if (info.includes('cluster_enabled:1') || info.includes('cluster_state:ok')) {
      const natMap = clusterNatMapForEndpoint(endpoint, []);
      return { isCluster: true, ...(natMap ? { natMap } : {}) };
    }
    return { isCluster: false };
  } catch {
    return { isCluster: false };
  } finally {
    await probe.quit().catch(() => undefined);
  }
}

async function loadClusterDiscovery(redisUrl: string, explicit?: boolean): Promise<ClusterDiscovery> {
  if (explicit === true || envTruthy('MOCKIFYER_REDIS_CLUSTER')) {
    return forcedClusterDiscovery(redisUrl);
  }
  const probed = await probeRedisClusterDiscovery(redisUrl);
  if (probed.isCluster) return probed;
  return { isCluster: false };
}

async function resolveRedisClusterDiscovery(
  redisUrl: string,
  explicit?: boolean
): Promise<ClusterDiscovery> {
  if (explicit === false || envFalsy('MOCKIFYER_REDIS_CLUSTER')) {
    return { isCluster: false };
  }

  const cached = clusterDiscoveryByUrl.get(redisUrl);
  if (cached !== undefined) return cached;

  if (explicit === true || envTruthy('MOCKIFYER_REDIS_CLUSTER')) {
    const discovery = forcedClusterDiscovery(redisUrl);
    clusterDiscoveryByUrl.set(redisUrl, discovery);
    return discovery;
  }

  let pending = pendingClusterDiscovery.get(redisUrl);
  if (!pending) {
    pending = loadClusterDiscovery(redisUrl, explicit).then((discovery) => {
      clusterDiscoveryByUrl.set(redisUrl, discovery);
      pendingClusterDiscovery.delete(redisUrl);
      return discovery;
    });
    pendingClusterDiscovery.set(redisUrl, pending);
  }
  return pending;
}

/**
 * Resolve whether `redisUrl` points at Redis Cluster.
 * Order: explicit option → `MOCKIFYER_REDIS_CLUSTER` env → cached probe → one-time CLUSTER SLOTS probe.
 */
export async function resolveRedisClusterMode(
  redisUrl: string,
  explicit?: boolean
): Promise<boolean> {
  const discovery = await resolveRedisClusterDiscovery(redisUrl, explicit);
  return discovery.isCluster;
}

/** Create an ioredis standalone or cluster client (auto-detects cluster when unset). */
export async function resolveIoRedisClient(
  redisUrl: string,
  options: CreateIoRedisClientOptions = {}
): Promise<any> {
  const discovery = await resolveRedisClusterDiscovery(redisUrl, options.cluster);
  return discovery.isCluster
    ? createClusterClient(redisUrl, options, discovery)
    : createStandaloneClient(redisUrl, options);
}

/**
 * Lazy ioredis client with MOVED fallback: retries once as Redis.Cluster when a standalone
 * connection hits cluster redirects (common when auto-detect fails on managed Redis).
 */
export class ResilientIoRedisClient {
  private clientPromise: Promise<any>;
  private movedRetryDone = false;

  constructor(
    private readonly redisUrl: string,
    private readonly options: CreateIoRedisClientOptions = {}
  ) {
    this.clientPromise = resolveIoRedisClient(redisUrl, options);
  }

  /** Run a Redis command; on MOVED, invalidate discovery cache and retry with forced cluster. */
  async run<T>(fn: (client: any) => Promise<T>): Promise<T> {
    try {
      return await fn(await this.clientPromise);
    } catch (err) {
      if (this.movedRetryDone || !isRedisMovedError(err)) {
        throw err;
      }
      this.movedRetryDone = true;
      invalidateRedisClusterDiscoveryCache(this.redisUrl);
      this.clientPromise = resolveIoRedisClient(this.redisUrl, {
        ...this.options,
        cluster: true,
      });
      return fn(await this.clientPromise);
    }
  }

  async close(): Promise<void> {
    try {
      const client = await this.clientPromise;
      await client.quit().catch(() => undefined);
    } catch {
      // ignore close errors
    }
  }
}

/** Reset cached cluster detection for one URL (or all when omitted). */
export function invalidateRedisClusterDiscoveryCache(redisUrl?: string): void {
  if (redisUrl) {
    clusterDiscoveryByUrl.delete(redisUrl);
    pendingClusterDiscovery.delete(redisUrl);
    return;
  }
  clusterDiscoveryByUrl.clear();
  pendingClusterDiscovery.clear();
}

/** Reset cached cluster detection (tests only). */
export function resetRedisClusterModeCacheForTests(): void {
  invalidateRedisClusterDiscoveryCache();
}
