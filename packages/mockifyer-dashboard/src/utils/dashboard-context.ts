import type { Request } from 'express';

export interface DashboardContextConfig {
  provider: 'filesystem' | 'sqlite' | 'redis';
  redisUrl?: string;
  keyPrefix?: string;
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

