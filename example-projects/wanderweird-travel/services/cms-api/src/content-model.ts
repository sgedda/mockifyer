export interface CmsPageEnrichment {
  vibeIndex: number;
  weatherFootnote: string;
  tripEcho: string;
  adviceEcho: string;
  hops: string[];
}

/** Global knobs from Umbraco mobileApp — drive Expo feature toggles. */
export interface CmsAppConfig {
  showLuggageLottery: boolean;
  enableChaosDice: boolean;
  enableGraphqlTrips: boolean;
  minChaosForLegendary: number;
  defaultDiscoverKey: string;
  themePreset: string;
  maintenanceBanner: string;
  featureFlags: string[];
  configVersion: number;
  /** Free-form JSON from Umbraco textarea (modules, labels, etc.). */
  extras: Record<string, unknown>;
}

/** Per-page knobs from Umbraco contentPage — layout + CTA routing. */
export interface CmsPageConfig {
  layoutMode: 'story' | 'dossier' | 'checklist' | string;
  showChaosMeter: boolean;
  showShareSheet: boolean;
  primaryAction: 'back' | 'deepLink' | 'external' | string;
  deepLinkPath: string;
  externalUrl: string;
  extras: Record<string, unknown>;
}

export interface CmsContentChild {
  id: string;
  slug: string;
  title: string;
  bodyText: string;
  bodyHtml?: string;
  imageUrl: string;
  ctaLabel: string;
  featured: boolean;
  readingMinutes: number;
  chaosHint: number;
  storyDate?: string;
  topics: string[];
  accentColor: string;
  highlights: string[];
  relatedPageId?: string;
  relatedPageName?: string;
  pageConfig: CmsPageConfig;
  enrichment?: CmsPageEnrichment;
  children: CmsContentChild[];
}

export interface CmsTabNode {
  id: string;
  slug: string;
  screenKey: string;
  title: string;
  iconGlyph: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  sortOrder: number;
  featured?: boolean;
  accentColor?: string;
  children: CmsContentChild[];
}

export interface CmsAppNode {
  title: string;
  tagline: string;
  config: CmsAppConfig;
}

export interface CmsNavigation {
  app: CmsAppNode;
  tabs: CmsTabNode[];
  source: 'umbraco' | 'seed';
}

export function defaultAppConfig(partial?: Partial<CmsAppConfig>): CmsAppConfig {
  return {
    showLuggageLottery: true,
    enableChaosDice: true,
    enableGraphqlTrips: true,
    minChaosForLegendary: 70,
    defaultDiscoverKey: 'atlantis',
    themePreset: 'midnight',
    maintenanceBanner: '',
    featureFlags: ['graphql-trips', 'lore-remix'],
    configVersion: 1,
    extras: {},
    ...partial,
  };
}

export function defaultPageConfig(partial?: Partial<CmsPageConfig>): CmsPageConfig {
  return {
    layoutMode: 'story',
    showChaosMeter: true,
    showShareSheet: false,
    primaryAction: 'back',
    deepLinkPath: '',
    externalUrl: '',
    extras: {},
    ...partial,
  };
}

export function emptyPage(partial: Partial<CmsContentChild> & Pick<CmsContentChild, 'id' | 'slug' | 'title'>): CmsContentChild {
  return {
    bodyText: '',
    imageUrl: '',
    ctaLabel: 'Back',
    featured: false,
    readingMinutes: 1,
    chaosHint: 0,
    topics: [],
    accentColor: '#3DDC97',
    highlights: [],
    pageConfig: defaultPageConfig(),
    children: [],
    ...partial,
    pageConfig: defaultPageConfig(partial.pageConfig),
  };
}

export function propString(properties: Record<string, unknown> | undefined, alias: string): string {
  const value = properties?.[alias];
  if (typeof value === 'string') {
    // Dropdown / flexible list often stores JSON: ["midnight"]
    const trimmed = value.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed) && parsed.length > 0) {
          return String(parsed[0]);
        }
      } catch {
        // fall through
      }
    }
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (typeof first === 'string' || typeof first === 'number' || typeof first === 'boolean') {
      return String(first);
    }
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.markup === 'string') {
      return record.markup;
    }
    if (typeof record.value === 'string') {
      return record.value;
    }
    if (typeof record.url === 'string') {
      return record.url;
    }
    if (typeof record.name === 'string') {
      return record.name;
    }
  }
  return '';
}

export function propBool(properties: Record<string, unknown> | undefined, alias: string): boolean {
  const value = properties?.[alias];
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  const asString = propString(properties, alias).toLowerCase();
  return asString === 'true' || asString === '1';
}

export function propNumber(properties: Record<string, unknown> | undefined, alias: string, fallback = 0): number {
  const value = properties?.[alias];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const asString = propString(properties, alias).trim();
  if (!asString) {
    return fallback;
  }
  const parsed = Number(asString);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function propStringList(properties: Record<string, unknown> | undefined, alias: string): string[] {
  const value = properties?.[alias];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (item && typeof item === 'object' && 'value' in item) {
          return String((item as { value: unknown }).value);
        }
        return '';
      })
      .map((item) => item.trim())
      .filter(Boolean);
  }
  const raw = propString(properties, alias).trim();
  if (!raw) {
    return [];
  }
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // fall through to comma split
    }
  }
  return raw
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function propColor(properties: Record<string, unknown> | undefined, alias: string, fallback: string): string {
  const value = properties?.[alias];
  if (value && typeof value === 'object' && 'value' in value) {
    const nested = (value as { value: unknown }).value;
    if (typeof nested === 'string' && nested.trim()) {
      return nested.trim();
    }
  }
  const asString = propString(properties, alias).trim();
  return asString || fallback;
}

export function propJsonObject(
  properties: Record<string, unknown> | undefined,
  alias: string
): Record<string, unknown> {
  const value = properties?.[alias];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  const raw = propString(properties, alias).trim();
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore invalid JSON from CMS
  }
  return {};
}

function propBoolOrDefault(
  properties: Record<string, unknown> | undefined,
  alias: string,
  fallback: boolean
): boolean {
  if (!properties || properties[alias] === undefined || properties[alias] === null || properties[alias] === '') {
    return fallback;
  }
  return propBool(properties, alias);
}

export function mapAppConfig(properties: Record<string, unknown> | undefined): CmsAppConfig {
  const flags = propStringList(properties, 'featureFlags');
  return defaultAppConfig({
    showLuggageLottery: propBoolOrDefault(properties, 'showLuggageLottery', true),
    enableChaosDice: propBoolOrDefault(properties, 'enableChaosDice', true),
    enableGraphqlTrips: propBoolOrDefault(properties, 'enableGraphqlTrips', true),
    minChaosForLegendary: propNumber(properties, 'minChaosForLegendary', 70),
    defaultDiscoverKey: propString(properties, 'defaultDiscoverKey') || 'atlantis',
    themePreset: propString(properties, 'themePreset') || 'midnight',
    maintenanceBanner: propString(properties, 'maintenanceBanner'),
    featureFlags: flags.length > 0 ? flags : ['graphql-trips', 'lore-remix'],
    configVersion: propNumber(properties, 'configVersion', 1),
    extras: propJsonObject(properties, 'appConfigJson'),
  });
}

export function mapPageConfig(properties: Record<string, unknown> | undefined): CmsPageConfig {
  const layoutMode = propString(properties, 'layoutMode') || 'story';
  const primaryAction = propString(properties, 'primaryAction') || 'back';
  return defaultPageConfig({
    layoutMode,
    showChaosMeter:
      properties?.showChaosMeter === undefined ? true : propBool(properties, 'showChaosMeter'),
    showShareSheet: propBool(properties, 'showShareSheet'),
    primaryAction,
    deepLinkPath: propString(properties, 'deepLinkPath'),
    externalUrl: propString(properties, 'externalUrl'),
    extras: propJsonObject(properties, 'pageConfigJson'),
  });
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function mapUmbracoPageFields(
  item: Record<string, unknown>,
  children: CmsContentChild[]
): CmsContentChild {
  const properties = item.properties as Record<string, unknown> | undefined;
  const title = typeof item.name === 'string' ? item.name : 'Untitled';
  const bodyHtml = propString(properties, 'bodyRich');
  const bodyText = propString(properties, 'bodyText') || stripHtml(bodyHtml);
  const related = properties?.relatedPage;
  let relatedPageId: string | undefined;
  let relatedPageName: string | undefined;
  if (related && typeof related === 'object') {
    const rel = related as { id?: unknown; name?: unknown };
    if (rel.id != null) {
      relatedPageId = String(rel.id);
    }
    if (typeof rel.name === 'string') {
      relatedPageName = rel.name;
    }
  }

  return emptyPage({
    id: String(item.id),
    slug: slugFromItem(item, title),
    title,
    bodyText,
    bodyHtml: bodyHtml || undefined,
    imageUrl: propString(properties, 'imageUrl'),
    ctaLabel: propString(properties, 'ctaLabel') || 'Back',
    featured: propBool(properties, 'featured'),
    readingMinutes: Math.max(1, propNumber(properties, 'readingMinutes', 1)),
    chaosHint: propNumber(properties, 'chaosHint', 0),
    storyDate: propString(properties, 'storyDate') || undefined,
    topics: propStringList(properties, 'topics'),
    accentColor: propColor(properties, 'accentColor', '#3DDC97'),
    highlights: propStringList(properties, 'highlights'),
    relatedPageId,
    relatedPageName,
    pageConfig: mapPageConfig(properties),
    children,
  });
}

export function slugFromItem(item: Record<string, unknown>, fallback: string): string {
  const route = item.route as { path?: string } | undefined;
  if (route?.path) {
    const parts = route.path.split('/').filter(Boolean);
    return parts[parts.length - 1] ?? fallback;
  }
  const name = typeof item.name === 'string' ? item.name : fallback;
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function hydrateSeedPage(raw: CmsContentChild): CmsContentChild {
  const bodyText = raw.bodyText ?? '';
  return emptyPage({
    ...raw,
    readingMinutes: raw.readingMinutes || Math.max(1, Math.round(bodyText.split(/\s+/).length / 40) || 1),
    pageConfig: defaultPageConfig(raw.pageConfig),
    children: (raw.children ?? []).map(hydrateSeedPage),
  });
}

export function hydrateSeedNavigation(raw: Omit<CmsNavigation, 'source'> & { source?: CmsNavigation['source'] }): CmsNavigation {
  return {
    ...raw,
    source: 'seed',
    app: {
      title: raw.app?.title ?? 'Wanderweird',
      tagline: raw.app?.tagline ?? '',
      config: defaultAppConfig(raw.app?.config),
    },
    tabs: (raw.tabs ?? []).map((tab) => ({
      ...tab,
      children: (tab.children ?? []).map(hydrateSeedPage),
    })),
  };
}
