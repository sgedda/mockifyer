import type { Request } from 'express';
import type { DashboardServerConfig } from '../server';

export interface DashboardContext {
  mockDataPath: string;
  config: DashboardServerConfig;
}

export function getDashboardContext(req: Request): DashboardContext {
  const mockDataPath = (req.app.locals.mockDataPath as string | undefined) ?? process.cwd();
  const config = (req.app.locals.dashboardConfig as DashboardServerConfig | undefined) ?? {
    provider: 'filesystem',
  };
  return { mockDataPath, config };
}

