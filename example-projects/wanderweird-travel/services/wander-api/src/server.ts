import express from 'express';
import {
  createMockifyerCorrelationMiddleware,
  initializeMockifyerFromEnv,
} from '@wanderweird/mock-bootstrap';

const PORT = Number(process.env.PORT ?? '4203');
const OPENTRIPMAP_API_KEY = process.env.OPENTRIPMAP_API_KEY?.trim() ?? '';

interface DestinationAnchor {
  key: string;
  name: string;
  countryQuery: string;
  countryName: string;
  capital: string;
  region: string;
  population: number;
  currencyCode: string;
  latitude: number;
  longitude: number;
  fictionalBlurb: string;
}

interface NearbyPlace {
  xid: string;
  name: string;
  kinds: string;
  distanceMeters: number | null;
  rate: number | null;
}

const ANCHORS: DestinationAnchor[] = [
  {
    key: 'atlantis',
    name: 'Atlantis Boardwalk',
    countryQuery: 'Greece',
    countryName: 'Greece',
    capital: 'Athens',
    region: 'Europe',
    population: 10_400_000,
    currencyCode: 'EUR',
    latitude: 37.9838,
    longitude: 23.7275,
    fictionalBlurb: 'Coastal walks, evening lights, and a boardwalk worth lingering on.',
  },
  {
    key: 'moonbase',
    name: 'Moon Base Brunch Bar',
    countryQuery: 'Iceland',
    countryName: 'Iceland',
    capital: 'Reykjavík',
    region: 'Europe',
    population: 380_000,
    currencyCode: 'ISK',
    latitude: 64.1466,
    longitude: -21.9426,
    fictionalBlurb: 'Quiet mornings, wide horizons, and a memorable brunch stop.',
  },
  {
    key: 'narnia',
    name: 'Narnia Customs Queue',
    countryQuery: 'United Kingdom',
    countryName: 'United Kingdom',
    capital: 'London',
    region: 'Europe',
    population: 67_000_000,
    currencyCode: 'GBP',
    latitude: 51.5074,
    longitude: -0.1278,
    fictionalBlurb: 'City landmarks, short queues if you plan ahead, and classic day trips.',
  },
  {
    key: 'upside',
    name: 'Upside-Down Farmers Market',
    countryQuery: 'Portugal',
    countryName: 'Portugal',
    capital: 'Lisbon',
    region: 'Europe',
    population: 10_300_000,
    currencyCode: 'EUR',
    latitude: 38.7223,
    longitude: -9.1393,
    fictionalBlurb: 'Local markets, hillside views, and easy food stops between neighborhoods.',
  },
  {
    key: 'bermuda',
    name: 'Bermuda Triangular Buffet',
    countryQuery: 'Bermuda',
    countryName: 'Bermuda',
    capital: 'Hamilton',
    region: 'Americas',
    population: 64_000,
    currencyCode: 'BMD',
    latitude: 32.2942,
    longitude: -64.7839,
    fictionalBlurb: 'Island beaches, pink sand stretches, and slow afternoons by the water.',
  },
  {
    key: 'cloudnine',
    name: 'Cloud Nine B&B',
    countryQuery: 'Switzerland',
    countryName: 'Switzerland',
    capital: 'Bern',
    region: 'Europe',
    population: 8_700_000,
    currencyCode: 'CHF',
    latitude: 46.5197,
    longitude: 6.6323,
    fictionalBlurb: 'Mountain air, tidy old towns, and calm evenings after a full day out.',
  },
];

const FALLBACK_ADVICE = [
  'Pack curiosity. Leave certainty in the overhead bin.',
  'If the map disagrees with the street, trust the street snack.',
  'A weird itinerary is still an itinerary.',
];

const FALLBACK_DELAY_ACTIVITIES = [
  {
    activity: 'Invent a new boarding-group mythology and recruit seatmates.',
    type: 'social',
    participants: 3,
  },
  {
    activity: 'Rank every snack in the terminal by emotional support value.',
    type: 'recreational',
    participants: 1,
  },
  {
    activity: 'Write a postcard to your future self at the gate.',
    type: 'relaxation',
    participants: 1,
  },
];

const FALLBACK_NEARBY: Record<string, NearbyPlace[]> = {
  atlantis: [
    { xid: 'fb-acropolis', name: 'Acropolis of Athens', kinds: 'historic,architecture', distanceMeters: 1200, rate: 7 },
    { xid: 'fb-plaka', name: 'Plaka alleys', kinds: 'cultural,interesting_places', distanceMeters: 800, rate: 5 },
  ],
  moonbase: [
    { xid: 'fb-hallgrim', name: 'Hallgrímskirkja', kinds: 'religion,architecture', distanceMeters: 1500, rate: 7 },
    { xid: 'fb-harbor', name: 'Reykjavík harbour walk', kinds: 'interesting_places', distanceMeters: 900, rate: 4 },
  ],
  narnia: [
    { xid: 'fb-british-museum', name: 'British Museum', kinds: 'museums,cultural', distanceMeters: 1100, rate: 7 },
    { xid: 'fb-covent', name: 'Covent Garden', kinds: 'shops,cultural', distanceMeters: 700, rate: 5 },
  ],
  upside: [
    { xid: 'fb-belem', name: 'Belém Tower', kinds: 'historic,architecture', distanceMeters: 5000, rate: 7 },
    { xid: 'fb-alfama', name: 'Alfama viewpoints', kinds: 'interesting_places', distanceMeters: 1200, rate: 6 },
  ],
  bermuda: [
    { xid: 'fb-dockyard', name: 'Royal Naval Dockyard', kinds: 'historic,cultural', distanceMeters: 3000, rate: 5 },
    { xid: 'fb-pink', name: 'Pink sand daydream pier', kinds: 'beaches,interesting_places', distanceMeters: 800, rate: 4 },
  ],
  cloudnine: [
    { xid: 'fb-oldtown', name: 'Bern Old City', kinds: 'historic,architecture', distanceMeters: 600, rate: 7 },
    { xid: 'fb-bear', name: 'Bärengraben', kinds: 'interesting_places', distanceMeters: 900, rate: 4 },
  ],
};

const LUGGAGE_PRIZES = [
  { title: 'Invisible carry-on', rarity: 'legendary', note: 'Fits everything. Visible to no one, including you.' },
  { title: 'Socks that match across timezones', rarity: 'rare', note: 'Pairs remain paired even after laundry portals.' },
  { title: 'Complimentary confusion voucher', rarity: 'common', note: 'Redeemable at any information desk that does not exist.' },
  { title: 'Pocket-sized aurora', rarity: 'epic', note: 'Do not open indoors. Or outdoors. Or in airports.' },
  { title: 'Queue skip for parallel realities', rarity: 'rare', note: 'Works once per prophecy.' },
];

function pickAnchor(key?: string): DestinationAnchor {
  if (key) {
    const found = ANCHORS.find((a) => a.key === key);
    if (found) {
      return found;
    }
  }
  return ANCHORS[Math.floor(Math.random() * ANCHORS.length)];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(`Upstream ${response.status} for ${url}`);
  }
  return response.json();
}

async function getWeather(anchor: DestinationAnchor): Promise<Record<string, unknown>> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${anchor.latitude}` +
    `&longitude=${anchor.longitude}&current=temperature_2m,weather_code,wind_speed_10m` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=3`;

  try {
    const data = (await fetchJson(url)) as Record<string, unknown>;
    return {
      source: 'open-meteo',
      current: data.current,
      daily: data.daily,
      mockFriendlyLabel: `Weather near the real-world cousin of ${anchor.name}`,
    };
  } catch (error) {
    return {
      source: 'fallback',
      current: { temperature_2m: 18, weather_code: 2, wind_speed_10m: 9 },
      mockFriendlyLabel: `Improvised weather for ${anchor.name}`,
      error: error instanceof Error ? error.message : 'weather_failed',
    };
  }
}

/**
 * REST Countries-shaped country vignette.
 * Official restcountries.com v3 is deprecated (v5 needs a Bearer key);
 * apicountries.com still serves the classic public JSON shape for demos.
 */
async function getCountryVignette(anchor: DestinationAnchor): Promise<Record<string, unknown>> {
  const query = encodeURIComponent(anchor.countryQuery.toLowerCase());
  try {
    const data = await fetchJson(`https://www.apicountries.com/countries/name/${query}`);
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
    if (!row) {
      throw new Error('empty_country_payload');
    }

    const flags = asRecord(row.flags);
    const languagesRaw = row.languages;
    const languages = Array.isArray(languagesRaw)
      ? languagesRaw
          .map((item) => {
            const lang = asRecord(item);
            return typeof lang?.name === 'string' ? lang.name : '';
          })
          .filter(Boolean)
      : [];

    const currenciesRaw = row.currencies;
    const currencies = Array.isArray(currenciesRaw)
      ? currenciesRaw
          .map((item) => {
            const currency = asRecord(item);
            const code = typeof currency?.code === 'string' ? currency.code : '';
            const name = typeof currency?.name === 'string' ? currency.name : '';
            return [code, name].filter(Boolean).join(' · ');
          })
          .filter(Boolean)
      : [];

    const capital =
      typeof row.capital === 'string'
        ? row.capital
        : Array.isArray(row.capital)
          ? String(row.capital[0] ?? anchor.capital)
          : anchor.capital;

    return {
      source: 'rest-countries-compatible',
      provider: 'apicountries.com',
      name: typeof row.name === 'string' ? row.name : anchor.countryName,
      capital,
      region: typeof row.region === 'string' ? row.region : anchor.region,
      subregion: typeof row.subregion === 'string' ? row.subregion : undefined,
      population: typeof row.population === 'number' ? row.population : anchor.population,
      flagPng: typeof flags?.png === 'string' ? flags.png : '',
      flagEmoji: typeof row.flag === 'string' ? row.flag : '',
      languages,
      currencies,
      borders: Array.isArray(row.borders) ? row.borders.map(String) : [],
      fictionalBridge: `${anchor.name} borrows vibes from ${
        typeof row.name === 'string' ? row.name : anchor.countryName
      } without paying rent.`,
    };
  } catch (error) {
    return {
      source: 'fallback',
      provider: 'wanderweird-atlas',
      name: anchor.countryName,
      capital: anchor.capital,
      region: anchor.region,
      population: anchor.population,
      flagPng: '',
      flagEmoji: '',
      languages: [],
      currencies: [anchor.currencyCode],
      borders: [],
      fictionalBridge: `${anchor.name} borrows vibes from ${anchor.countryName} without paying rent.`,
      error: error instanceof Error ? error.message : 'country_failed',
    };
  }
}

async function getCurrencyTip(anchor: DestinationAnchor): Promise<Record<string, unknown>> {
  if (anchor.currencyCode === 'EUR') {
    return {
      source: 'local',
      base: 'EUR',
      tip: 'Eurozone cousin — tip in compliments and spare pearls.',
    };
  }

  try {
    const url = `https://api.frankfurter.app/latest?from=EUR&to=${encodeURIComponent(anchor.currencyCode)}`;
    const data = (await fetchJson(url)) as {
      amount?: number;
      base?: string;
      rates?: Record<string, number>;
    };
    const rate = data.rates?.[anchor.currencyCode];
    return {
      source: 'frankfurter',
      base: data.base ?? 'EUR',
      quote: anchor.currencyCode,
      rate: rate ?? null,
      tip:
        rate != null
          ? `1 EUR ≈ ${rate} ${anchor.currencyCode} near the real-world cousin of ${anchor.name}.`
          : `Currency vibes detected for ${anchor.currencyCode}.`,
    };
  } catch (error) {
    return {
      source: 'fallback',
      base: 'EUR',
      quote: anchor.currencyCode,
      tip: `Bring IOUs denominated in ${anchor.currencyCode}.`,
      error: error instanceof Error ? error.message : 'currency_failed',
    };
  }
}

async function getAdvice(): Promise<Record<string, unknown>> {
  try {
    const data = (await fetchJson('https://api.adviceslip.com/advice')) as {
      slip?: { advice?: string; id?: number };
    };
    return {
      source: 'adviceslip',
      advice: data.slip?.advice ?? FALLBACK_ADVICE[0],
      id: data.slip?.id,
    };
  } catch {
    const advice = FALLBACK_ADVICE[Math.floor(Math.random() * FALLBACK_ADVICE.length)];
    return { source: 'fallback', advice };
  }
}

/** “What to do when your flight is delayed” — Bored API App Brewery mirror. */
async function getDelayActivity(): Promise<Record<string, unknown>> {
  try {
    const data = (await fetchJson('https://bored-api.appbrewery.com/random')) as {
      activity?: string;
      type?: string;
      participants?: number;
      price?: number;
      key?: string;
      link?: string;
      duration?: string;
    };
    const activity = data.activity?.trim();
    if (!activity) {
      throw new Error('empty_activity');
    }
    return {
      source: 'bored-api',
      provider: 'bored-api.appbrewery.com',
      headline: 'What to do when your flight is delayed',
      activity,
      type: data.type ?? 'recreational',
      participants: typeof data.participants === 'number' ? data.participants : 1,
      price: typeof data.price === 'number' ? data.price : null,
      duration: typeof data.duration === 'string' ? data.duration : null,
      key: typeof data.key === 'string' ? data.key : null,
      link: typeof data.link === 'string' ? data.link : null,
    };
  } catch (error) {
    const fallback =
      FALLBACK_DELAY_ACTIVITIES[Math.floor(Math.random() * FALLBACK_DELAY_ACTIVITIES.length)];
    return {
      source: 'fallback',
      headline: 'What to do when your flight is delayed',
      activity: fallback.activity,
      type: fallback.type,
      participants: fallback.participants,
      error: error instanceof Error ? error.message : 'activity_failed',
    };
  }
}

function fallbackNearby(anchor: DestinationAnchor): NearbyPlace[] {
  return FALLBACK_NEARBY[anchor.key] ?? [
    {
      xid: 'fb-generic',
      name: `Mysterious plaza near ${anchor.capital}`,
      kinds: 'interesting_places',
      distanceMeters: 500,
      rate: 3,
    },
  ];
}

/** OpenTripMap radius search around the destination’s real-world cousin. */
async function getNearbyPlaces(anchor: DestinationAnchor): Promise<Record<string, unknown>> {
  if (!OPENTRIPMAP_API_KEY) {
    return {
      source: 'fallback',
      provider: 'wanderweird-atlas',
      note: 'Set OPENTRIPMAP_API_KEY for live OpenTripMap POIs (free key at https://opentripmap.io).',
      radiusMeters: 3000,
      places: fallbackNearby(anchor),
    };
  }

  const url =
    `https://api.opentripmap.com/0.1/en/places/radius` +
    `?radius=3000&lon=${anchor.longitude}&lat=${anchor.latitude}` +
    `&rate=2&limit=6&format=json&apikey=${encodeURIComponent(OPENTRIPMAP_API_KEY)}`;

  try {
    const data = await fetchJson(url);
    const rows = Array.isArray(data) ? data : [];
    const places: NearbyPlace[] = rows
      .map((item) => {
        const row = asRecord(item) ?? {};
        const name = typeof row.name === 'string' ? row.name.trim() : '';
        if (!name) {
          return null;
        }
        return {
          xid: typeof row.xid === 'string' ? row.xid : name,
          name,
          kinds: typeof row.kinds === 'string' ? row.kinds.split(',')[0] ?? row.kinds : 'place',
          distanceMeters: typeof row.dist === 'number' ? Math.round(row.dist) : null,
          rate: typeof row.rate === 'number' ? row.rate : null,
        };
      })
      .filter((place): place is NearbyPlace => place != null)
      .slice(0, 5);

    return {
      source: 'opentripmap',
      provider: 'api.opentripmap.com',
      radiusMeters: 3000,
      places: places.length > 0 ? places : fallbackNearby(anchor),
    };
  } catch (error) {
    return {
      source: 'fallback',
      provider: 'wanderweird-atlas',
      note: 'OpenTripMap unreachable — serving atlas POIs.',
      radiusMeters: 3000,
      places: fallbackNearby(anchor),
      error: error instanceof Error ? error.message : 'opentripmap_failed',
    };
  }
}

async function main(): Promise<void> {
  await initializeMockifyerFromEnv({ label: 'wander-api' });

  const app = express();
  app.use(express.json());
  app.use(createMockifyerCorrelationMiddleware());

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'wander-api',
      openTripMapConfigured: Boolean(OPENTRIPMAP_API_KEY),
    });
  });

  app.get('/anchors', (_req, res) => {
    res.json({
      anchors: ANCHORS.map((a) => ({
        key: a.key,
        name: a.name,
        countryQuery: a.countryQuery,
        fictionalBlurb: a.fictionalBlurb,
      })),
    });
  });

  app.get('/discover', async (req, res) => {
    const anchor = pickAnchor(
      typeof req.query.destinationKey === 'string' ? req.query.destinationKey : undefined
    );
    const [weather, country, advice, currency, delayActivity, nearby] = await Promise.all([
      getWeather(anchor),
      getCountryVignette(anchor),
      getAdvice(),
      getCurrencyTip(anchor),
      getDelayActivity(),
      getNearbyPlaces(anchor),
    ]);

    res.json({
      destination: {
        key: anchor.key,
        name: anchor.name,
        blurb: anchor.fictionalBlurb,
      },
      weather,
      country,
      advice,
      currency,
      delayActivity,
      nearby,
      serendipityScore: 40 + Math.floor(Math.random() * 60),
      generatedAt: new Date().toISOString(),
    });
  });

  app.get('/luggage-lottery', (_req, res) => {
    const prize = LUGGAGE_PRIZES[Math.floor(Math.random() * LUGGAGE_PRIZES.length)];
    res.json({
      drawnAt: new Date().toISOString(),
      prize,
      ticketStub: `WW-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      disclaimer: 'Prizes exist only inside Mockifyer scenarios. Do not try to check them as baggage.',
    });
  });

  app.listen(PORT, () => {
    console.log(
      `[wander-api] http://127.0.0.1:${PORT} · open-meteo · frankfurter · adviceslip · bored-api · rest-countries-compatible · opentripmap${
        OPENTRIPMAP_API_KEY ? '' : ' (fallback POIs — set OPENTRIPMAP_API_KEY)'
      }`
    );
  });
}

main().catch((err) => {
  console.error('[wander-api] fatal', err);
  process.exit(1);
});
