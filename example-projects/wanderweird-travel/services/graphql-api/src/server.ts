import cors from 'cors';
import express from 'express';
import { createSchema, createYoga } from 'graphql-yoga';
import {
  createMockifyerCorrelationMiddleware,
  initializeMockifyerFromEnv,
} from '@wanderweird/mock-bootstrap';
import { resolvers } from './resolvers.js';
import { typeDefs } from './schema.js';
import { upstreamBases } from './upstream.js';

const PORT = Number(process.env.PORT ?? '4206');

async function main(): Promise<void> {
  await initializeMockifyerFromEnv({ label: 'graphql-api' });

  const yoga = createYoga<{ req: express.Request }>({
    schema: createSchema({ typeDefs, resolvers }),
    graphqlEndpoint: '/graphql',
    landingPage: true,
    context: ({ request }) => ({
      authorization: request.headers.get('authorization') ?? undefined,
    }),
  });

  const app = express();
  app.use(cors());
  app.use(createMockifyerCorrelationMiddleware());

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'graphql-api',
      upstreams: upstreamBases,
      graphql: '/graphql',
    });
  });

  app.use(yoga.graphqlEndpoint, yoga);

  app.listen(PORT, () => {
    console.log(
      `[graphql-api] http://127.0.0.1:${PORT}/graphql · auth ${upstreamBases.auth} · trips ${upstreamBases.trips} · wander ${upstreamBases.wander} · lore ${upstreamBases.lore}`
    );
  });
}

main().catch((err) => {
  console.error('[graphql-api] fatal', err);
  process.exit(1);
});
