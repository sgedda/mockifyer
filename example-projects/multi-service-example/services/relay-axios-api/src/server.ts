import axios from 'axios';
import express from 'express';
import {
  createMockifyerCorrelationMiddleware,
  initializeMockifyerFromEnv,
} from '@multi-service/mock-bootstrap';
import { initializeMockifyerAxiosFromEnv } from '@multi-service/mock-axios-bootstrap';

const PORT = Number(process.env.PORT ?? '4103');
const CATALOG_BASE = (process.env.CATALOG_URL ?? 'http://127.0.0.1:4102').replace(/\/$/, '');
const RUNTIME = (process.env.MOCKIFYER_RUNTIME ?? 'filesystem').toLowerCase();
const USE_DASHBOARD_PROXY = RUNTIME === 'proxy';

async function main(): Promise<void> {
  if (USE_DASHBOARD_PROXY) {
    // mockifyer-axios has no dashboard /api/proxy client — use fetch proxy for the catalog hop so
    // Redis network log shows relay → catalog (and downstream) alongside web/gateway hops.
    await initializeMockifyerFromEnv({ label: 'relay-axios-api (catalog via fetch proxy)' });
  } else {
    initializeMockifyerAxiosFromEnv({ label: 'relay-axios-api', axiosInstance: axios });
  }

  const app = express();
  app.use(createMockifyerCorrelationMiddleware());

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'relay-axios-api',
      httpClient: USE_DASHBOARD_PROXY ? 'fetch-proxy' : 'axios',
    });
  });

  app.get('/via-axios', async (_req, res) => {
    if (USE_DASHBOARD_PROXY) {
      const catalogRes = await fetch(`${CATALOG_BASE}/product`, {
        headers: { Accept: 'application/json' },
      });
      const catalogBody: unknown = await catalogRes.json().catch(async () => catalogRes.text());
      res.json({
        service: 'relay-axios-api',
        httpClient: 'fetch (dashboard proxy → catalog)',
        catalogStatus: catalogRes.status,
        catalog: catalogBody,
      });
      return;
    }

    const upstream = await axios.get(`${CATALOG_BASE}/product`, {
      headers: { Accept: 'application/json' },
    });

    res.json({
      service: 'relay-axios-api',
      httpClient: 'axios',
      catalog: upstream.data,
    });
  });

  app.listen(PORT, () => {
    console.log(
      `[relay-axios-api] http://127.0.0.1:${PORT} → ${USE_DASHBOARD_PROXY ? 'fetch proxy' : 'axios'} → catalog ${CATALOG_BASE}`
    );
  });
}

main().catch((err) => {
  console.error('[relay-axios-api] fatal', err);
  process.exit(1);
});
