import express from 'express';
import {
  createMockifyerCorrelationMiddleware,
  initializeMockifyerFromEnv,
} from '@multi-service/mock-bootstrap';

const PORT = Number(process.env.PORT ?? '4102');

async function fetchJsonPlaceholderPost(): Promise<{ status: number; body: unknown }> {
  const res = await fetch('https://jsonplaceholder.typicode.com/posts/1', {
    headers: { Accept: 'application/json' },
  });
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = await res.text();
  }
  return { status: res.status, body };
}

async function main(): Promise<void> {
  await initializeMockifyerFromEnv({ label: 'catalog-api' });

  const app = express();
  app.use(createMockifyerCorrelationMiddleware());

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'catalog-api' });
  });

  app.get('/product', async (_req, res) => {
    const upstream = await fetchJsonPlaceholderPost();
    res.json({
      service: 'catalog-api',
      upstream: {
        label: 'jsonplaceholder.typicode.com/posts/1',
        ...upstream,
      },
    });
  });

  app.listen(PORT, () => {
    console.log(`[catalog-api] http://127.0.0.1:${PORT}`);
  });
}

main().catch((err) => {
  console.error('[catalog-api] fatal', err);
  process.exit(1);
});
