import cors from 'cors';
import express from 'express';
import {
  createMockifyerCorrelationMiddleware,
  initializeMockifyerFromEnv,
} from '@wanderweird/mock-bootstrap';

const PORT = Number(process.env.PORT ?? '4200');
const AUTH_BASE = (process.env.AUTH_URL ?? 'http://127.0.0.1:4201').replace(/\/$/, '');
const TRIPS_BASE = (process.env.TRIPS_URL ?? 'http://127.0.0.1:4202').replace(/\/$/, '');
const WANDER_BASE = (process.env.WANDER_URL ?? 'http://127.0.0.1:4203').replace(/\/$/, '');
const CMS_BASE = (process.env.CMS_URL ?? 'http://127.0.0.1:4204').replace(/\/$/, '');
const LORE_BASE = (process.env.LORE_URL ?? 'http://127.0.0.1:4205').replace(/\/$/, '');
const GRAPHQL_BASE = (process.env.GRAPHQL_URL ?? 'http://127.0.0.1:4206').replace(/\/$/, '');

async function proxyJson(
  url: string,
  init?: RequestInit
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const body: unknown = await response.json().catch(async () => response.text());
  return { status: response.status, body };
}

async function main(): Promise<void> {
  await initializeMockifyerFromEnv({ label: 'gateway-api' });

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(createMockifyerCorrelationMiddleware());

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'gateway-api',
      upstreams: {
        auth: AUTH_BASE,
        trips: TRIPS_BASE,
        wander: WANDER_BASE,
        cms: CMS_BASE,
        lore: LORE_BASE,
        graphql: GRAPHQL_BASE,
      },
    });
  });

  app.all('/graphql', async (req, res) => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    const authorization = req.header('authorization');
    if (authorization) {
      headers.Authorization = authorization;
    }

    const init: RequestInit = {
      method: req.method,
      headers,
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      init.body = JSON.stringify(req.body ?? {});
    } else if (typeof req.url === 'string' && req.url.includes('?')) {
      const qs = req.url.slice(req.url.indexOf('?'));
      const result = await fetch(`${GRAPHQL_BASE}/graphql${qs}`, { headers });
      const body: unknown = await result.json().catch(async () => result.text());
      res.status(result.status).json(body);
      return;
    }

    const result = await fetch(`${GRAPHQL_BASE}/graphql`, init);
    const body: unknown = await result.json().catch(async () => result.text());
    res.status(result.status).json(body);
  });

  app.get('/api/cms/navigation', async (_req, res) => {
    const result = await proxyJson(`${LORE_BASE}/navigation`);
    res.status(result.status).json(result.body);
  });

  app.get('/api/cms/tabs/:screenKey', async (req, res) => {
    const result = await proxyJson(
      `${LORE_BASE}/tabs/${encodeURIComponent(req.params.screenKey)}`
    );
    res.status(result.status).json(result.body);
  });

  app.get('/api/cms/tabs/:screenKey/pages/*', async (req, res) => {
    const slugPath = String(req.params[0] ?? '');
    const encoded = slugPath
      .split('/')
      .filter(Boolean)
      .map((part) => encodeURIComponent(part))
      .join('/');
    const result = await proxyJson(
      `${LORE_BASE}/tabs/${encodeURIComponent(req.params.screenKey)}/pages/${encoded}`
    );
    res.status(result.status).json(result.body);
  });

  app.post('/api/auth/login', async (req, res) => {
    const result = await proxyJson(`${AUTH_BASE}/login`, {
      method: 'POST',
      body: JSON.stringify(req.body ?? {}),
    });
    res.status(result.status).json(result.body);
  });

  app.get('/api/auth/me', async (req, res) => {
    const result = await proxyJson(`${AUTH_BASE}/me`, {
      headers: { Authorization: req.header('authorization') ?? '' },
    });
    res.status(result.status).json(result.body);
  });

  app.patch('/api/auth/me', async (req, res) => {
    const result = await proxyJson(`${AUTH_BASE}/me`, {
      method: 'PATCH',
      headers: { Authorization: req.header('authorization') ?? '' },
      body: JSON.stringify(req.body ?? {}),
    });
    res.status(result.status).json(result.body);
  });

  app.post('/api/auth/logout', async (req, res) => {
    const result = await proxyJson(`${AUTH_BASE}/logout`, {
      method: 'POST',
      headers: { Authorization: req.header('authorization') ?? '' },
    });
    res.status(result.status).json(result.body);
  });

  app.get('/api/trips', async (req, res) => {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : '';
    const qs = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const result = await proxyJson(`${TRIPS_BASE}/trips${qs}`);
    res.status(result.status).json(result.body);
  });

  app.get('/api/trips/destinations', async (_req, res) => {
    const result = await proxyJson(`${TRIPS_BASE}/destinations`);
    res.status(result.status).json(result.body);
  });

  app.get('/api/trips/:id', async (req, res) => {
    const result = await proxyJson(`${TRIPS_BASE}/trips/${encodeURIComponent(req.params.id)}`);
    res.status(result.status).json(result.body);
  });

  app.post('/api/trips', async (req, res) => {
    const result = await proxyJson(`${TRIPS_BASE}/trips`, {
      method: 'POST',
      body: JSON.stringify(req.body ?? {}),
    });
    res.status(result.status).json(result.body);
  });

  app.patch('/api/trips/:id', async (req, res) => {
    const result = await proxyJson(`${TRIPS_BASE}/trips/${encodeURIComponent(req.params.id)}`, {
      method: 'PATCH',
      body: JSON.stringify(req.body ?? {}),
    });
    res.status(result.status).json(result.body);
  });

  app.delete('/api/trips/:id', async (req, res) => {
    const result = await proxyJson(`${TRIPS_BASE}/trips/${encodeURIComponent(req.params.id)}`, {
      method: 'DELETE',
    });
    res.status(result.status).json(result.body);
  });

  app.post('/api/trips/:id/chaos-dice', async (req, res) => {
    const result = await proxyJson(
      `${TRIPS_BASE}/trips/${encodeURIComponent(req.params.id)}/chaos-dice`,
      { method: 'POST' }
    );
    res.status(result.status).json(result.body);
  });

  app.get('/api/passport/:userId', async (req, res) => {
    const result = await proxyJson(
      `${TRIPS_BASE}/passport/${encodeURIComponent(req.params.userId)}`
    );
    res.status(result.status).json(result.body);
  });

  app.get('/api/discover', async (req, res) => {
    const key = typeof req.query.destinationKey === 'string' ? req.query.destinationKey : '';
    const qs = key ? `?destinationKey=${encodeURIComponent(key)}` : '';
    const result = await proxyJson(`${WANDER_BASE}/discover${qs}`);
    res.status(result.status).json(result.body);
  });

  app.get('/api/luggage-lottery', async (_req, res) => {
    const result = await proxyJson(`${WANDER_BASE}/luggage-lottery`);
    res.status(result.status).json(result.body);
  });

  app.get('/api/home', async (req, res) => {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : 'u-wanderer';
    const [tripsResult, discoverResult, passportResult] = await Promise.all([
      proxyJson(`${TRIPS_BASE}/trips?userId=${encodeURIComponent(userId)}`),
      proxyJson(`${WANDER_BASE}/discover`),
      proxyJson(`${TRIPS_BASE}/passport/${encodeURIComponent(userId)}`),
    ]);

    res.json({
      trips: tripsResult.body,
      discover: discoverResult.body,
      passport: passportResult.body,
      hopStatuses: {
        trips: tripsResult.status,
        discover: discoverResult.status,
        passport: passportResult.status,
      },
    });
  });

  app.listen(PORT, () => {
    console.log(
      `[gateway-api] http://127.0.0.1:${PORT} → auth ${AUTH_BASE} · trips ${TRIPS_BASE} · wander ${WANDER_BASE} · cms ${CMS_BASE} · lore ${LORE_BASE} · graphql ${GRAPHQL_BASE}`
    );
  });
}

main().catch((err) => {
  console.error('[gateway-api] fatal', err);
  process.exit(1);
});
