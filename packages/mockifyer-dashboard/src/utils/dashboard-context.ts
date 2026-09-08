import type { Request } from 'express';

/** When using Redis: optional disk pairing for version-controlled fixtures under `mockDataPath`. */
export type RedisDiskMirrorConfigInput =
  | boolean
  | {
      /** Write `mockDataPath/<scenario>/redis/<hash>.json` when the proxy records from upstream. */
      mirrorWrites?: boolean;
      /** If Redis has no entry, scan scenario JSON on disk before calling upstream. */
      readFallback?: boolean;
    };

export interface RedisDiskMirrorResolved {
  mirrorWrites: boolean;
  readFallback: boolean;
}

export interface DashboardContextConfig {
  provider: 'filesystem' | 'sqlite' | 'redis';
  /** Set by {@link createServer} — used for SQLite paths and filesystem fallbacks. */
  mockDataPath?: string;
  redisUrl?: string;
  /** Force Redis Cluster client (also `MOCKIFYER_REDIS_CLUSTER` or auto-detect via CLUSTER SLOTS). */
  redisCluster?: boolean;
  keyPrefix?: string;
  /**
   * Redis + disk: mirror recorded mocks to the scenario folder and/or read from disk when Redis misses.
   * Also configurable via `MOCKIFYER_REDIS_MIRROR_DISK` and `MOCKIFYER_REDIS_DISK_READ_FALLBACK`.
   */
  redisDiskMirror?: RedisDiskMirrorConfigInput;
}

function envTruthy(key: string): boolean {
  const v = process.env[key]?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/**
 * Resolves Redis disk mirror flags: environment variables first, then explicit `config.redisDiskMirror`
 * (object fields override only when set to boolean).
 */
export function resolveRedisDiskMirrorOptions(config: DashboardContextConfig): RedisDiskMirrorResolved {
  let mirrorWrites = envTruthy('MOCKIFYER_REDIS_MIRROR_DISK');
  let readFallback = envTruthy('MOCKIFYER_REDIS_DISK_READ_FALLBACK');

  const raw = config.redisDiskMirror;
  if (raw === true) {
    mirrorWrites = true;
    readFallback = true;
  } else if (raw && typeof raw === 'object') {
    if (typeof raw.mirrorWrites === 'boolean') {
      mirrorWrites = raw.mirrorWrites;
    }
    if (typeof raw.readFallback === 'boolean') {
      readFallback = raw.readFallback;
    }
  }

  return { mirrorWrites, readFallback };
}

export interface DashboardContext {
  mockDataPath: string;
  config: DashboardContextConfig;
}

interface RequestWithDashboardContext extends Request {
  mockifyerDashboard?: DashboardContext;
}

/**
 * Attach mock-data path + provider config to the request.
 * Required when {@link createServer} is mounted on a parent app (`app.use('/mockifyer', …)`):
 * `req.app.locals` then refers to the host, not the dashboard sub-app.
 */
export function attachDashboardContext(req: Request, context: DashboardContext): void {
  (req as RequestWithDashboardContext).mockifyerDashboard = context;
}

export function getDashboardContext(req: Request): DashboardContext {
  const bound = (req as RequestWithDashboardContext).mockifyerDashboard;
  if (bound?.mockDataPath) {
    return bound;
  }
  const mockDataPath = (req.app.locals.mockDataPath as string | undefined) ?? process.cwd();
  const config = (req.app.locals.dashboardConfig as DashboardContextConfig | undefined) ?? {
    provider: 'filesystem',
  };
  return { mockDataPath, config };
}

