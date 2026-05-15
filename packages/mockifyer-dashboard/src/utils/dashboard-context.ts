import type { Request } from 'express';

/** Optional HTTP Basic Auth for the dashboard (see {@link resolveDashboardBasicAuth}). */
export interface DashboardBasicAuthCredentials {
  username: string;
  password: string;
}

export interface DashboardContextConfig {
  provider: 'filesystem' | 'sqlite' | 'redis';
  redisUrl?: string;
  keyPrefix?: string;
  /**
   * When both username and password are set, enables HTTP Basic Auth for all routes
   * except `OPTIONS` and `GET/HEAD /api/health`. Overrides `MOCKIFYER_DASHBOARD_AUTH_*` env vars.
   */
  basicAuth?: DashboardBasicAuthCredentials | null;
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

