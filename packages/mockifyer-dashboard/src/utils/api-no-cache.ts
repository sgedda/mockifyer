import type { NextFunction, Request, Response } from 'express';

export const DASHBOARD_API_CACHE_CONTROL =
  'no-store, no-cache, must-revalidate, proxy-revalidate';

/**
 * Dashboard JSON is live mock/override state. Express still generates ETags and
 * returns 304 when the client sends If-None-Match — even with Cache-Control:
 * no-store. fetch() then sees `!response.ok` and an empty body, which leaves
 * the Overrides view stuck on "Loading…".
 */
export function dashboardApiNoCache(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', DASHBOARD_API_CACHE_CONTROL);
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  delete req.headers['if-none-match'];
  delete req.headers['if-modified-since'];
  next();
}
