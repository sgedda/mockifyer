import type { NextFunction, Request, Response } from 'express';

export const DASHBOARD_CORS_ALLOW_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';

/** Used when a preflight does not list `Access-Control-Request-Headers`. */
export const DASHBOARD_CORS_DEFAULT_ALLOW_HEADERS =
  'Content-Type, Authorization, x-mockifyer-client-id, x-mockifyer-device-id';

/**
 * Browser clients (Expo web, dashboard UI on another port) call `/api/proxy` and
 * `/api/date-config` with `x-mockifyer-*` lane headers. A preflight that only allows
 * `Content-Type` blocks those calls and surfaces as `TypeError: Failed to fetch`.
 * Origin is `*` without credentials, so echoing the requested headers widens nothing.
 */
export function dashboardCors(req: Request, res: Response, next: NextFunction): void {
  const requested = req.headers['access-control-request-headers'];
  const allowHeaders =
    typeof requested === 'string' && requested.trim() !== ''
      ? requested
      : DASHBOARD_CORS_DEFAULT_ALLOW_HEADERS;

  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', DASHBOARD_CORS_ALLOW_METHODS);
  res.header('Access-Control-Allow-Headers', allowHeaders);
  res.header('Vary', 'Access-Control-Request-Headers');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
}
