import axios from 'axios';
import express from 'express';
import { MOCKIFYER_CLIENT_ID_HEADER } from '@sgedda/mockifyer-core';
import { initializeMockifyerAxiosFromEnv } from '@multi-service/mock-axios-bootstrap';

const PORT = Number(process.env.PORT ?? '4103');
const CATALOG_BASE = (process.env.CATALOG_URL ?? 'http://127.0.0.1:4102').replace(/\/$/, '');

function main(): void {
  initializeMockifyerAxiosFromEnv({ label: 'relay-axios-api', axiosInstance: axios });

  const app = express();

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'relay-axios-api', httpClient: 'axios' });
  });

  app.get('/via-axios', async (_req, res) => {
    const lane = process.env.MOCKIFYER_CLIENT_ID?.trim();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (lane) {
      headers[MOCKIFYER_CLIENT_ID_HEADER] = lane;
    }

    const upstream = await axios.get(`${CATALOG_BASE}/product`, { headers });

    res.json({
      service: 'relay-axios-api',
      httpClient: 'axios',
      catalog: upstream.data,
    });
  });

  app.listen(PORT, () => {
    console.log(`[relay-axios-api] http://127.0.0.1:${PORT} → axios → catalog ${CATALOG_BASE}`);
  });
}

main();
