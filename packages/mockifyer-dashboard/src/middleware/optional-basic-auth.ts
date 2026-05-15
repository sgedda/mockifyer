import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { timingSafeEqual } from 'crypto';
import type { DashboardBasicAuthCredentials, DashboardContextConfig } from '../utils/dashboard-context';

const AUTH_REALM = 'Mockifyer Dashboard';

function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Resolves Basic Auth credentials: explicit `config.basicAuth` wins when both
 * username and password are non-empty; otherwise reads env (see README).
 */
export function resolveDashboardBasicAuth(
  config: DashboardContextConfig
): DashboardBasicAuthCredentials | null {
  const inline = config.basicAuth;
  if (inline?.username?.trim()) {
    const password = inline.password;
    if (password === undefined || password === '') {
      console.warn(
        '[Mockifyer Dashboard] basicAuth.username is set but password is empty; basic auth disabled.'
      );
      return null;
    }
    return { username: inline.username.trim(), password };
  }

  const envUser = process.env.MOCKIFYER_DASHBOARD_AUTH_USER?.trim();
  if (!envUser) {
    return null;
  }
  const envPassword = process.env.MOCKIFYER_DASHBOARD_AUTH_PASSWORD;
  if (envPassword === undefined || envPassword === '') {
    console.warn(
      '[Mockifyer Dashboard] MOCKIFYER_DASHBOARD_AUTH_USER is set but MOCKIFYER_DASHBOARD_AUTH_PASSWORD is empty; basic auth disabled.'
    );
    return null;
  }
  return { username: envUser, password: envPassword };
}

function shouldSkipBasicAuth(req: Request): boolean {
  if (req.method === 'OPTIONS') {
    return true;
  }
  const healthPath = req.path === '/api/health' || req.path === '/api/health/';
  if (healthPath && (req.method === 'GET' || req.method === 'HEAD')) {
    return true;
  }
  return false;
}

function sendUnauthorized(res: Response, body: string): void {
  res.setHeader('WWW-Authenticate', `Basic realm="${AUTH_REALM}"`);
  res.status(401).send(body);
}

/**
 * HTTP Basic Auth for the dashboard. Skips OPTIONS and GET/HEAD /api/health.
 */
export function createDashboardBasicAuthMiddleware(
  creds: DashboardBasicAuthCredentials
): RequestHandler {
  const expectedUser = creds.username;
  const expectedPass = creds.password;

  return (req: Request, res: Response, next: NextFunction): void => {
    if (shouldSkipBasicAuth(req)) {
      next();
      return;
    }

    const header = req.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Basic ')) {
      sendUnauthorized(res, 'Authentication required');
      return;
    }

    let decoded: string;
    try {
      decoded = Buffer.from(header.slice(6).trim(), 'base64').toString('utf8');
    } catch {
      sendUnauthorized(res, 'Invalid credentials');
      return;
    }

    const colon = decoded.indexOf(':');
    const user = colon >= 0 ? decoded.slice(0, colon) : decoded;
    const pass = colon >= 0 ? decoded.slice(colon + 1) : '';

    if (!timingSafeEqualString(user, expectedUser) || !timingSafeEqualString(pass, expectedPass)) {
      sendUnauthorized(res, 'Invalid credentials');
      return;
    }

    next();
  };
}
