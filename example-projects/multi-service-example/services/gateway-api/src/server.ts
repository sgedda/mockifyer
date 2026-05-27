import express from 'express';
import {
  createMockifyerCorrelationMiddleware,
  initializeMockifyerFromEnv,
} from '@multi-service/mock-bootstrap';

const PORT = Number(process.env.PORT ?? '4101');
const RELAY_BASE = (process.env.RELAY_URL ?? 'http://127.0.0.1:4103').replace(/\/$/, '');

async function main(): Promise<void> {
  await initializeMockifyerFromEnv({ label: 'gateway-api' });

  const app = express();
  app.use(createMockifyerCorrelationMiddleware());

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'gateway-api' });
  });

  app.get('/aggregate', async (_req, res) => {
    const relayRes = await fetch(`${RELAY_BASE}/via-axios`, {
      headers: { Accept: 'application/json' },
    });
    const relayBody: unknown = await relayRes.json().catch(async () => relayRes.text());

    res.json({
      service: 'gateway-api',
      relay: {
        url: `${RELAY_BASE}/via-axios`,
        status: relayRes.status,
        body: relayBody,
      },
    });
  });

  app.listen(PORT, () => {
    console.log(
      `[gateway-api] http://127.0.0.1:${PORT} → relay (axios) ${RELAY_BASE} → catalog`
    );
  });
}

main().catch((err) => {
  console.error('[gateway-api] fatal', err);
  process.exit(1);
});
