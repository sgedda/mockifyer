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
  /** Set by {@link createServer} — used for filesystem fallbacks and disk mirrors. */
  mockDataPath?: string;
  /** Set by {@link createServer} when SQLite uses an explicit DB file. */
  sqlitePath?: string;
  redisUrl?: string;
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

export function getDashboardContext(req: Request): DashboardContext {
  const mockDataPath = (req.app.locals.mockDataPath as string | undefined) ?? process.cwd();
  const config = (req.app.locals.dashboardConfig as DashboardContextConfig | undefined) ?? {
    provider: 'filesystem',
  };
  return { mockDataPath, config };
}

