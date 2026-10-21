import express from 'express';
import {
  createMockifyerCorrelationMiddleware,
  initializeMockifyerFromEnv,
} from '@wanderweird/mock-bootstrap';

const PORT = Number(process.env.PORT ?? '4205');
const CMS_BASE = (process.env.CMS_URL ?? 'http://127.0.0.1:4204').replace(/\/$/, '');
const WANDER_BASE = (process.env.WANDER_URL ?? 'http://127.0.0.1:4203').replace(/\/$/, '');
const TRIPS_BASE = (process.env.TRIPS_URL ?? 'http://127.0.0.1:4202').replace(/\/$/, '');

interface CmsPage {
  id: string;
  slug: string;
  title: string;
  bodyText: string;
  featured?: boolean;
  readingMinutes?: number;
  chaosHint?: number;
  topics?: string[];
  accentColor?: string;
  highlights?: string[];
  children?: CmsPage[];
  enrichment?: Record<string, unknown>;
  [key: string]: unknown;
}

interface CmsNavigation {
  app: { title: string; tagline: string; config?: Record<string, unknown> };
  tabs: Array<{ children?: CmsPage[]; [key: string]: unknown }>;
  source: string;
}

interface LiveContext {
  weatherFootnote: string;
  adviceEcho: string;
  tripEcho: string;
  serendipityScore: number;
  hops: string[];
}

async function fetchJson(url: string): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  const body: unknown = await response.json().catch(async () => response.text());
  return { status: response.status, body };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

async function loadLiveContext(): Promise<LiveContext> {
  const hops: string[] = ['lore-api'];
  const [discoverResult, tripsResult] = await Promise.all([
    fetchJson(`${WANDER_BASE}/discover`),
    fetchJson(`${TRIPS_BASE}/trips?userId=u-wanderer`),
  ]);

  hops.push('wander-api', 'trips-api');

  const discover = asRecord(discoverResult.body);
  const destination = asRecord(discover?.destination);
  const weather = asRecord(asRecord(discover?.weather)?.current);
  const advice = asRecord(discover?.advice);
  const tripsBody = asRecord(tripsResult.body);
  const trips = Array.isArray(tripsBody?.trips) ? tripsBody.trips : [];
  const firstTrip = asRecord(trips[0]);
  const temp = weather?.temperature_2m;
  const destName = typeof destination?.name === 'string' ? destination.name : 'a fictional pier';

  return {
    weatherFootnote:
      typeof temp === 'number'
        ? `Current weather near ${destName}: about ${temp}°C.`
        : `Weather near ${destName} is unavailable right now.`,
    adviceEcho: typeof advice?.advice === 'string' ? advice.advice : 'Leave room for the unexpected.',
    tripEcho:
      typeof firstTrip?.title === 'string'
        ? `Connected to your trip “${firstTrip.title}”.`
        : 'No trips saved yet — create one from the Trips tab.',
    serendipityScore:
      typeof discover?.serendipityScore === 'number' ? discover.serendipityScore : 50,
    hops,
  };
}

function enrichPage(page: CmsPage, ctx: LiveContext): CmsPage {
  const topics = page.topics ?? [];
  const chaosHint = typeof page.chaosHint === 'number' ? page.chaosHint : 0;
  const featured = Boolean(page.featured);
  const vibeIndex = Math.max(
    0,
    Math.min(
      100,
      Math.round(chaosHint * 0.45 + ctx.serendipityScore * 0.35 + topics.length * 6 + (featured ? 12 : 0))
    )
  );

  const title = featured && !page.title.startsWith('✦ ') ? `✦ ${page.title}` : page.title;
  const footnote = `\n\n—\n${ctx.weatherFootnote}\n${ctx.tripEcho}\nTip: ${ctx.adviceEcho}`;

  const children = (page.children ?? []).map((child) => enrichPage(child, ctx));

  return {
    ...page,
    title,
    bodyText: `${page.bodyText}${footnote}`,
    readingMinutes: Math.max(1, (page.readingMinutes ?? 1) + (featured ? 1 : 0)),
    enrichment: {
      vibeIndex,
      weatherFootnote: ctx.weatherFootnote,
      tripEcho: ctx.tripEcho,
      adviceEcho: ctx.adviceEcho,
      hops: [...ctx.hops, 'cms-api'],
    },
    children,
  };
}

function enrichNavigation(nav: CmsNavigation, ctx: LiveContext): CmsNavigation {
  return {
    ...nav,
    app: {
      ...nav.app,
      tagline: nav.app.tagline,
    },
    tabs: nav.tabs.map((tab) => ({
      ...tab,
      children: (tab.children ?? []).map((child) => enrichPage(child, ctx)),
    })),
  };
}

function findPageByPath(pages: CmsPage[], pathParts: string[]): CmsPage | undefined {
  if (pathParts.length === 0) {
    return undefined;
  }
  const [head, ...rest] = pathParts;
  const match = pages.find((page) => page.slug === head);
  if (!match) {
    return undefined;
  }
  if (rest.length === 0) {
    return match;
  }
  return findPageByPath(match.children ?? [], rest);
}

async function main(): Promise<void> {
  await initializeMockifyerFromEnv({ label: 'lore-api' });

  const app = express();
  app.use(express.json());
  app.use(createMockifyerCorrelationMiddleware());

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'lore-api',
      upstreams: { cms: CMS_BASE, wander: WANDER_BASE, trips: TRIPS_BASE },
    });
  });

  app.get('/navigation', async (_req, res) => {
    const cms = await fetchJson(`${CMS_BASE}/navigation`);
    if (cms.status >= 400) {
      res.status(cms.status).json(cms.body);
      return;
    }
    const ctx = await loadLiveContext();
    res.json(enrichNavigation(cms.body as CmsNavigation, ctx));
  });

  app.get('/tabs/:screenKey', async (req, res) => {
    const cms = await fetchJson(`${CMS_BASE}/tabs/${encodeURIComponent(req.params.screenKey)}`);
    if (cms.status >= 400) {
      res.status(cms.status).json(cms.body);
      return;
    }
    const ctx = await loadLiveContext();
    const payload = cms.body as { app: CmsNavigation['app']; tab: { children?: CmsPage[] }; source: string };
    res.json({
      ...payload,
      app: payload.app,
      tab: {
        ...payload.tab,
        children: (payload.tab.children ?? []).map((child) => enrichPage(child, ctx)),
      },
    });
  });

  app.get('/tabs/:screenKey/pages/*', async (req, res) => {
    const slugPath = String(req.params[0] ?? '');
    const encoded = slugPath
      .split('/')
      .filter(Boolean)
      .map((part) => encodeURIComponent(part))
      .join('/');
    const cms = await fetchJson(
      `${CMS_BASE}/tabs/${encodeURIComponent(req.params.screenKey)}/pages/${encoded}`
    );
    if (cms.status >= 400) {
      res.status(cms.status).json(cms.body);
      return;
    }
    const ctx = await loadLiveContext();
    const payload = cms.body as { page: CmsPage; [key: string]: unknown };
    res.json({
      ...payload,
      page: enrichPage(payload.page, ctx),
    });
  });

  app.listen(PORT, () => {
    console.log(
      `[lore-api] http://127.0.0.1:${PORT} remixes cms ${CMS_BASE} + wander ${WANDER_BASE} + trips ${TRIPS_BASE}`
    );
  });
}

main().catch((err) => {
  console.error('[lore-api] fatal', err);
  process.exit(1);
});
