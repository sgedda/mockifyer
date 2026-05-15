import {
  createDashboardBasicAuthMiddleware,
  resolveDashboardBasicAuth,
} from '../packages/mockifyer-dashboard/src/middleware/optional-basic-auth';
import type { DashboardContextConfig } from '../packages/mockifyer-dashboard/src/utils/dashboard-context';

describe('dashboard optional basic auth', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('resolveDashboardBasicAuth returns null when env unset', () => {
    delete process.env.MOCKIFYER_DASHBOARD_AUTH_USER;
    delete process.env.MOCKIFYER_DASHBOARD_AUTH_PASSWORD;
    const cfg: DashboardContextConfig = { provider: 'filesystem' };
    expect(resolveDashboardBasicAuth(cfg)).toBeNull();
  });

  it('resolveDashboardBasicAuth reads env when both set', () => {
    process.env.MOCKIFYER_DASHBOARD_AUTH_USER = ' admin ';
    process.env.MOCKIFYER_DASHBOARD_AUTH_PASSWORD = 'secret';
    const cfg: DashboardContextConfig = { provider: 'filesystem' };
    expect(resolveDashboardBasicAuth(cfg)).toEqual({ username: 'admin', password: 'secret' });
  });

  it('resolveDashboardBasicAuth prefers config.basicAuth over env', () => {
    process.env.MOCKIFYER_DASHBOARD_AUTH_USER = 'envuser';
    process.env.MOCKIFYER_DASHBOARD_AUTH_PASSWORD = 'envpass';
    const cfg: DashboardContextConfig = {
      provider: 'filesystem',
      basicAuth: { username: 'inline', password: 'inlinepass' },
    };
    expect(resolveDashboardBasicAuth(cfg)).toEqual({ username: 'inline', password: 'inlinepass' });
  });

  it('middleware calls next for valid Basic header', () => {
    const mw = createDashboardBasicAuthMiddleware({ username: 'u', password: 'p' });
    const next = jest.fn();
    const res = {} as any;
    const req = {
      method: 'GET',
      path: '/api/mocks',
      headers: {
        authorization: `Basic ${Buffer.from('u:p', 'utf8').toString('base64')}`,
      },
    };
    mw(req as any, res as any, next);
    expect(next).toHaveBeenCalled();
  });

  it('middleware skips /api/health', () => {
    const mw = createDashboardBasicAuthMiddleware({ username: 'u', password: 'p' });
    const next = jest.fn();
    const res = {} as any;
    const req = {
      method: 'GET',
      path: '/api/health',
      headers: {},
    };
    mw(req as any, res as any, next);
    expect(next).toHaveBeenCalled();
  });

  it('middleware skips OPTIONS', () => {
    const mw = createDashboardBasicAuthMiddleware({ username: 'u', password: 'p' });
    const next = jest.fn();
    const res = {} as any;
    const req = {
      method: 'OPTIONS',
      path: '/api/mocks',
      headers: {},
    };
    mw(req as any, res as any, next);
    expect(next).toHaveBeenCalled();
  });

  it('middleware returns 401 without Authorization', () => {
    const mw = createDashboardBasicAuthMiddleware({ username: 'u', password: 'p' });
    const next = jest.fn();
    const status = jest.fn().mockReturnThis();
    const setHeader = jest.fn();
    const send = jest.fn();
    const res = { status, setHeader, send } as any;
    const req = {
      method: 'GET',
      path: '/api/mocks',
      headers: {},
    };
    mw(req as any, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
    expect(setHeader).toHaveBeenCalledWith('WWW-Authenticate', expect.stringContaining('Basic realm='));
  });

  it('middleware does not skip POST /api/health', () => {
    const mw = createDashboardBasicAuthMiddleware({ username: 'u', password: 'p' });
    const next = jest.fn();
    const status = jest.fn().mockReturnThis();
    const setHeader = jest.fn();
    const send = jest.fn();
    const res = { status, setHeader, send } as any;
    const req = { method: 'POST', path: '/api/health', headers: {} };
    mw(req as any, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
  });
});
