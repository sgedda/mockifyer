import type { NextFunction, Request, Response } from 'express';
import {
  MOCKIFYER_CLIENT_ID_HEADER,
  MOCKIFYER_DEVICE_ID_HEADER,
  MOCKIFYER_INCLUDE_TRACE_BODIES_HEADER,
  MOCKIFYER_INCLUDE_TRACE_HEADER,
  MOCKIFYER_METRO_STREAM_BASE_HEADER,
  MOCKIFYER_OVERRIDE_GROUP_HEADER,
  MOCKIFYER_PARENT_REQUEST_ID_HEADER,
  MOCKIFYER_REQUEST_ID_HEADER,
} from '@sgedda/mockifyer-core';

export const DASHBOARD_CORS_ALLOW_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';

/**
 * Request headers Mockifyer clients set. Browser clients (Expo web on another port)
 * send the lane headers to `/api/proxy` and `/api/date-config`; a preflight that only
 * allows `Content-Type` blocks those calls and surfaces as `TypeError: Failed to fetch`.
 */
export const DASHBOARD_CORS_ALLOW_HEADERS = [
  'Content-Type',
  MOCKIFYER_CLIENT_ID_HEADER,
  MOCKIFYER_DEVICE_ID_HEADER,
  MOCKIFYER_REQUEST_ID_HEADER,
  MOCKIFYER_PARENT_REQUEST_ID_HEADER,
  MOCKIFYER_INCLUDE_TRACE_HEADER,
  MOCKIFYER_INCLUDE_TRACE_BODIES_HEADER,
  MOCKIFYER_OVERRIDE_GROUP_HEADER,
  MOCKIFYER_METRO_STREAM_BASE_HEADER,
].join(', ');

/**
 * Parse allowed origins from env.
 * Returns null for disabled CORS, array of origins for enabled.
 * Default: allow all origins (*) for backward compatibility.
 */
function parseAllowedOrigins(): string[] | null {
  const env = process.env.MOCKIFYER_DASHBOARD_CORS;
  
  // Explicitly disabled
  if (env && (env.trim().toLowerCase() === 'off' || env.trim().toLowerCase() === 'false')) {
    return null; // CORS disabled
  }
  
  // Not set or explicitly enabled - allow all origins (default)
  if (!env || env.trim() === '*' || env.trim().toLowerCase() === 'on' || env.trim().toLowerCase() === 'true') {
    return ['*']; // Allow all origins (backward compatible default)
  }
  
  // Comma-separated list of specific origins
  return env
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

const allowedOrigins = parseAllowedOrigins();

export function dashboardCors(req: Request, res: Response, next: NextFunction): void {
  // CORS disabled - no headers
  if (allowedOrigins === null) {
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
    return;
  }

  // Determine origin to allow
  const requestOrigin = req.headers.origin;
  let allowOrigin = '*';

  if (allowedOrigins[0] !== '*' && requestOrigin) {
    // Check if request origin is in allowed list
    if (allowedOrigins.includes(requestOrigin)) {
      allowOrigin = requestOrigin;
      // When using credentials, we must echo the origin (not *)
      res.header('Access-Control-Allow-Credentials', 'true');
    } else {
      // Origin not allowed
      if (req.method === 'OPTIONS') {
        res.sendStatus(403);
        return;
      }
      // Continue but don't set CORS headers - browser will block
      next();
      return;
    }
  }

  res.header('Access-Control-Allow-Origin', allowOrigin);
  res.header('Access-Control-Allow-Methods', DASHBOARD_CORS_ALLOW_METHODS);
  res.header('Access-Control-Allow-Headers', DASHBOARD_CORS_ALLOW_HEADERS);
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
}
