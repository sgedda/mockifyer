export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  email: string;
  homeBase: string;
  jetLagTolerance: number;
  preferredChaos: 'mild' | 'spicy' | 'existential';
  passportColor: string;
  bio: string;
  notifications: {
    serendipityPings: boolean;
    luggageLottery: boolean;
    weatherWeirdness: boolean;
  };
}

export interface PackingItem {
  id: string;
  label: string;
  packed: boolean;
  absurdity: number;
}

export interface Trip {
  id: string;
  userId: string;
  title: string;
  destination: string;
  destinationKey: string;
  startDate: string;
  endDate: string;
  status: 'dreaming' | 'booked' | 'in_progress' | 'legendary';
  vibe: string;
  notes: string;
  chaosScore: number;
  stampEarned: boolean;
  packingList: PackingItem[];
  itinerary: Array<{ day: number; title: string; detail: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface DestinationOption {
  key: string;
  name: string;
  vibe: string;
}

export interface DelayActivity {
  source: string;
  headline: string;
  activity: string;
  type: string;
  participants: number;
  price?: number | null;
  duration?: string | null;
  link?: string | null;
}

export interface NearbyPlace {
  xid: string;
  name: string;
  kinds: string;
  distanceMeters: number | null;
  rate: number | null;
}

export interface NearbyPlacesPayload {
  source: string;
  provider?: string;
  note?: string;
  radiusMeters: number;
  places: NearbyPlace[];
}

export interface DiscoverPayload {
  destination: { key: string; name: string; blurb: string };
  weather: Record<string, unknown>;
  country: Record<string, unknown>;
  advice: { source: string; advice: string; id?: number };
  currency?: Record<string, unknown>;
  delayActivity?: DelayActivity;
  nearby?: NearbyPlacesPayload;
  serendipityScore: number;
  generatedAt: string;
}

export interface PassportPayload {
  userId: string;
  stamps: Array<{
    tripId: string;
    destination: string;
    destinationKey: string;
    vibe: string;
    earnedAt: string;
  }>;
  tripsLogged: number;
  legendaryCount: number;
  averageChaos: number;
}

export interface LuggageLotteryPayload {
  drawnAt: string;
  prize: { title: string; rarity: string; note: string };
  ticketStub: string;
  disclaimer: string;
}

export interface CmsPageEnrichment {
  vibeIndex: number;
  weatherFootnote: string;
  tripEcho: string;
  adviceEcho: string;
  hops: string[];
}

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
  extras: Record<string, unknown>;
}

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
  featured?: boolean;
  readingMinutes?: number;
  chaosHint?: number;
  storyDate?: string;
  topics?: string[];
  accentColor?: string;
  highlights?: string[];
  relatedPageId?: string;
  relatedPageName?: string;
  pageConfig?: CmsPageConfig;
  enrichment?: CmsPageEnrichment;
  children?: CmsContentChild[];
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

export interface CmsNavigation {
  app: { title: string; tagline: string; config?: CmsAppConfig };
  tabs: CmsTabNode[];
  source: 'umbraco' | 'seed';
}
