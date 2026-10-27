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

export function dashboardCors(req: Request, res: Response, next: NextFunction): void {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', DASHBOARD_CORS_ALLOW_METHODS);
  res.header('Access-Control-Allow-Headers', DASHBOARD_CORS_ALLOW_HEADERS);
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
}
