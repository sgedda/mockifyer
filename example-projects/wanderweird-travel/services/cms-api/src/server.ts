import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import {
  createMockifyerCorrelationMiddleware,
  initializeMockifyerFromEnv,
} from '@wanderweird/mock-bootstrap';
import {
  hydrateSeedNavigation,
  mapAppConfig,
  mapUmbracoPageFields,
  propString,
  propBool,
  slugFromItem,
  type CmsContentChild,
  type CmsNavigation,
  type CmsTabNode,
} from './content-model';

const PORT = Number(process.env.PORT ?? '4204');
const UMBRACO_BASE = (process.env.UMBRACO_URL ?? 'http://127.0.0.1:4400').replace(/\/$/, '');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.resolve(__dirname, '../seed/navigation.json');

function loadSeed(): CmsNavigation {
  const raw = JSON.parse(readFileSync(SEED_PATH, 'utf8')) as Omit<CmsNavigation, 'source'>;
  return hydrateSeedNavigation(raw);
}

async function fetchUmbracoJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!response.ok) {
    throw new Error(`Umbraco ${response.status} for ${url}`);
  }
  return response.json();
}

async function mapContentPage(item: Record<string, unknown>): Promise<CmsContentChild> {
  const childrenQuery =
    `${UMBRACO_BASE}/umbraco/delivery/api/v2/content` +
    `?fetch=children:${item.id}&filter=contentType:contentPage` +
    `&expand=properties[%24all]&take=50`;
  const childrenPayload = (await fetchUmbracoJson(childrenQuery)) as {
    items?: Array<Record<string, unknown>>;
  };
  const children: CmsContentChild[] = [];
  for (const child of childrenPayload.items ?? []) {
    children.push(await mapContentPage(child));
  }
  return mapUmbracoPageFields(item, children);
}

async function loadFromUmbraco(): Promise<CmsNavigation> {
  const rootQuery =
    `${UMBRACO_BASE}/umbraco/delivery/api/v2/content` +
    `?filter=contentType:mobileApp&expand=properties[%24all]&take=1`;
  const rootPayload = (await fetchUmbracoJson(rootQuery)) as {
    items?: Array<Record<string, unknown>>;
  };
  const appItem = rootPayload.items?.[0];
  if (!appItem?.id) {
    throw new Error('No mobileApp root found in Umbraco');
  }

  const tabsQuery =
    `${UMBRACO_BASE}/umbraco/delivery/api/v2/content` +
    `?fetch=children:${appItem.id}&filter=contentType:tabScreen` +
    `&expand=properties[%24all]&take=50`;
  const tabsPayload = (await fetchUmbracoJson(tabsQuery)) as {
    items?: Array<Record<string, unknown>>;
  };

  const tabs: CmsTabNode[] = [];
  for (const tab of tabsPayload.items ?? []) {
    const properties = tab.properties as Record<string, unknown> | undefined;
    const childrenQuery =
      `${UMBRACO_BASE}/umbraco/delivery/api/v2/content` +
      `?fetch=children:${tab.id}&filter=contentType:contentPage` +
      `&expand=properties[%24all]&take=50`;
    const childrenPayload = (await fetchUmbracoJson(childrenQuery)) as {
      items?: Array<Record<string, unknown>>;
    };

    const children: CmsContentChild[] = [];
    for (const child of childrenPayload.items ?? []) {
      children.push(await mapContentPage(child));
    }

    const title = typeof tab.name === 'string' ? tab.name : 'Tab';
    tabs.push({
      id: String(tab.id),
      slug: slugFromItem(tab, title),
      screenKey: propString(properties, 'screenKey') || slugFromItem(tab, title),
      title,
      iconGlyph: propString(properties, 'iconGlyph') || '•',
      heroTitle: propString(properties, 'heroTitle') || title,
      heroSubtitle: propString(properties, 'heroSubtitle'),
      heroImageUrl: propString(properties, 'heroImageUrl'),
      sortOrder: Number(propString(properties, 'sortOrder') || '100'),
      featured: propBool(properties, 'featured'),
      accentColor: propString(properties, 'accentColor') || undefined,
      children,
    });
  }

  tabs.sort((a, b) => a.sortOrder - b.sortOrder);

  const appProps = appItem.properties as Record<string, unknown> | undefined;
  return {
    app: {
      title: propString(appProps, 'appTitle') || 'Wanderweird',
      tagline: propString(appProps, 'tagline') || '',
      config: mapAppConfig(appProps),
    },
    tabs,
    source: 'umbraco',
  };
}

async function resolveNavigation(): Promise<CmsNavigation> {
  try {
    return await loadFromUmbraco();
  } catch (error) {
    console.warn(
      '[cms-api] Umbraco unavailable, using seed navigation:',
      error instanceof Error ? error.message : error
    );
    return loadSeed();
  }
}

interface PageLookup {
  page: CmsContentChild;
  breadcrumbs: Array<{ slug: string; title: string; slugPath: string }>;
}

function findPageByPath(
  pages: CmsContentChild[],
  pathParts: string[],
  trail: Array<{ slug: string; title: string; slugPath: string }> = []
): PageLookup | undefined {
  if (pathParts.length === 0) {
    return undefined;
  }
  const [head, ...rest] = pathParts;
  const match = pages.find((page) => page.slug === head);
  if (!match) {
    return undefined;
  }
  const slugPath = [...trail.map((item) => item.slug), match.slug].join('/');
  const nextTrail = [...trail, { slug: match.slug, title: match.title, slugPath }];
  if (rest.length === 0) {
    return { page: match, breadcrumbs: nextTrail };
  }
  return findPageByPath(match.children ?? [], rest, nextTrail);
}

function countDescendants(page: CmsContentChild): number {
  return (page.children ?? []).reduce(
    (sum, child) => sum + 1 + countDescendants(child),
    0
  );
}

async function main(): Promise<void> {
  await initializeMockifyerFromEnv({ label: 'cms-api' });

  const app = express();
  app.use(express.json());
  app.use(createMockifyerCorrelationMiddleware());

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'cms-api', umbraco: UMBRACO_BASE });
  });

  app.get('/navigation', async (_req, res) => {
    const navigation = await resolveNavigation();
    res.json(navigation);
  });

  app.get('/tabs/:screenKey', async (req, res) => {
    const navigation = await resolveNavigation();
    const tab = navigation.tabs.find(
      (item) => item.screenKey === req.params.screenKey || item.slug === req.params.screenKey
    );
    if (!tab) {
      res.status(404).json({ error: 'tab_not_found' });
      return;
    }
    res.json({ app: navigation.app, tab, source: navigation.source });
  });

  app.get('/tabs/:screenKey/pages/*', async (req, res) => {
    const navigation = await resolveNavigation();
    const tab = navigation.tabs.find(
      (item) => item.screenKey === req.params.screenKey || item.slug === req.params.screenKey
    );
    const slugPath = String(req.params[0] ?? '');
    const pathParts = slugPath.split('/').filter(Boolean);
    const lookup = tab ? findPageByPath(tab.children, pathParts) : undefined;
    if (!tab || !lookup) {
      res.status(404).json({ error: 'page_not_found', path: pathParts });
      return;
    }
    res.json({
      app: navigation.app,
      tab: { id: tab.id, screenKey: tab.screenKey, title: tab.title },
      page: lookup.page,
      path: pathParts,
      breadcrumbs: [
        { slug: tab.screenKey, title: tab.title, slugPath: '' },
        ...lookup.breadcrumbs,
      ],
      stackDepth: lookup.breadcrumbs.length,
      descendantCount: countDescendants(lookup.page),
      source: navigation.source,
    });
  });

  app.listen(PORT, () => {
    console.log(`[cms-api] http://127.0.0.1:${PORT} → Umbraco ${UMBRACO_BASE} (seed fallback ready)`);
  });
}

main().catch((err) => {
  console.error('[cms-api] fatal', err);
  process.exit(1);
});
