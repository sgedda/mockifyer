import { asArray, asRecord } from './upstream.js';

function stringField(record: Record<string, unknown> | undefined, key: string, fallback = ''): string {
  const value = record?.[key];
  return typeof value === 'string' ? value : fallback;
}

function numberField(record: Record<string, unknown> | undefined, key: string, fallback = 0): number {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function boolField(record: Record<string, unknown> | undefined, key: string): boolean {
  return Boolean(record?.[key]);
}

function chaosBand(score: number): string {
  if (score >= 80) return 'existential';
  if (score >= 55) return 'spicy';
  if (score >= 30) return 'mild';
  return 'calm';
}

function packingProgress(packingList: unknown[]): number {
  if (packingList.length === 0) {
    return 0;
  }
  const packed = packingList.filter((item) => boolField(asRecord(item), 'packed')).length;
  return Math.round((packed / packingList.length) * 100);
}

function daysUntil(startDate: string): number | null {
  if (!startDate) {
    return null;
  }
  const start = Date.parse(startDate);
  if (Number.isNaN(start)) {
    return null;
  }
  const ms = start - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function mapUser(raw: unknown) {
  const user = asRecord(raw);
  if (!user) {
    return null;
  }
  const notifications = asRecord(user.notifications) ?? {};
  return {
    id: stringField(user, 'id'),
    username: stringField(user, 'username'),
    displayName: stringField(user, 'displayName'),
    email: stringField(user, 'email'),
    homeBase: stringField(user, 'homeBase'),
    jetLagTolerance: numberField(user, 'jetLagTolerance'),
    preferredChaos: stringField(user, 'preferredChaos', 'mild'),
    passportColor: stringField(user, 'passportColor', '#3DDC97'),
    bio: stringField(user, 'bio'),
    notifications: {
      serendipityPings: Boolean(notifications.serendipityPings),
      luggageLottery: Boolean(notifications.luggageLottery),
      weatherWeirdness: Boolean(notifications.weatherWeirdness),
    },
  };
}

export function mapTrip(raw: unknown) {
  const trip = asRecord(raw);
  if (!trip) {
    return null;
  }
  const packingList = asArray(trip.packingList).map((item) => {
    const row = asRecord(item) ?? {};
    return {
      id: stringField(row, 'id'),
      label: stringField(row, 'label'),
      packed: boolField(row, 'packed'),
      absurdity: numberField(row, 'absurdity'),
    };
  });
  const chaosScore = numberField(trip, 'chaosScore');
  const startDate = stringField(trip, 'startDate');
  return {
    id: stringField(trip, 'id'),
    userId: stringField(trip, 'userId'),
    title: stringField(trip, 'title'),
    destination: stringField(trip, 'destination'),
    destinationKey: stringField(trip, 'destinationKey'),
    startDate,
    endDate: stringField(trip, 'endDate'),
    status: stringField(trip, 'status', 'dreaming'),
    vibe: stringField(trip, 'vibe'),
    notes: stringField(trip, 'notes'),
    chaosScore,
    chaosBand: chaosBand(chaosScore),
    stampEarned: boolField(trip, 'stampEarned'),
    packingList,
    packingProgress: packingProgress(packingList),
    daysUntil: daysUntil(startDate),
    itinerary: asArray(trip.itinerary).map((item) => {
      const row = asRecord(item) ?? {};
      return {
        day: numberField(row, 'day'),
        title: stringField(row, 'title'),
        detail: stringField(row, 'detail'),
      };
    }),
    createdAt: stringField(trip, 'createdAt'),
    updatedAt: stringField(trip, 'updatedAt'),
  };
}

export function mapDestination(raw: unknown) {
  const destination = asRecord(raw);
  if (!destination) {
    return null;
  }
  return {
    key: stringField(destination, 'key'),
    name: stringField(destination, 'name'),
    vibe: stringField(destination, 'vibe'),
  };
}

export function mapDiscover(raw: unknown) {
  const discover = asRecord(raw);
  if (!discover) {
    return null;
  }
  const destination = asRecord(discover.destination) ?? {};
  const advice = asRecord(discover.advice) ?? {};
  const country = asRecord(discover.country);
  const delay = asRecord(discover.delayActivity);
  const nearby = asRecord(discover.nearby);
  const weather = asRecord(discover.weather);
  const current = asRecord(weather?.current);
  const temperature =
    typeof current?.temperature_2m === 'number' ? current.temperature_2m : null;

  return {
    destination: {
      key: stringField(destination, 'key'),
      name: stringField(destination, 'name'),
      blurb: stringField(destination, 'blurb'),
    },
    advice: {
      source: stringField(advice, 'source', 'advice-slip'),
      advice: stringField(advice, 'advice'),
      id: typeof advice.id === 'number' ? advice.id : null,
    },
    country: country
      ? {
          source: stringField(country, 'source', 'atlas'),
          name: stringField(country, 'name'),
          capital: stringField(country, 'capital'),
          region: stringField(country, 'region'),
          population:
            typeof country.population === 'number' ? country.population : null,
          flagEmoji: stringField(country, 'flagEmoji') || null,
          languages: asArray(country.languages).map(String),
          fictionalBridge: stringField(country, 'fictionalBridge'),
        }
      : null,
    delayActivity: delay
      ? {
          source: stringField(delay, 'source', 'bored-api'),
          headline: stringField(delay, 'headline', 'What to do when your flight is delayed'),
          activity: stringField(delay, 'activity'),
          type: stringField(delay, 'type', 'recreational'),
          participants: numberField(delay, 'participants', 1),
        }
      : null,
    nearby: nearby
      ? {
          source: stringField(nearby, 'source', 'opentripmap'),
          note: stringField(nearby, 'note') || null,
          radiusMeters: numberField(nearby, 'radiusMeters', 3000),
          places: asArray(nearby.places).map((item) => {
            const place = asRecord(item) ?? {};
            return {
              xid: stringField(place, 'xid'),
              name: stringField(place, 'name'),
              kinds: stringField(place, 'kinds'),
              distanceMeters:
                typeof place.distanceMeters === 'number' ? place.distanceMeters : null,
              rate: typeof place.rate === 'number' ? place.rate : null,
            };
          }),
        }
      : null,
    serendipityScore: numberField(discover, 'serendipityScore', 50),
    temperatureC: temperature,
    weatherSummary:
      temperature == null
        ? 'Weather unclassified — bring a cape just in case.'
        : `${temperature}°C near the real-world cousin of ${stringField(destination, 'name', 'nowhere')}.`,
    currencyNote: (() => {
      const currency = asRecord(discover.currency);
      if (typeof currency?.tip === 'string' && currency.tip.trim()) {
        return currency.tip;
      }
      const rates = asRecord(currency?.rates);
      const code =
        stringField(currency, 'quote') ||
        stringField(country, 'currencyCode') ||
        Object.keys(rates ?? {})[0];
      if (!code || !rates || typeof rates[code] !== 'number') {
        return 'FX desk is napping.';
      }
      return `1 EUR ≈ ${rates[code]} ${code} (Frankfurter)`;
    })(),
    generatedAt: stringField(discover, 'generatedAt'),
    rawWeatherJson: JSON.stringify(discover.weather ?? {}),
  };
}

export function mapPassport(raw: unknown) {
  const passport = asRecord(raw);
  if (!passport) {
    return null;
  }
  return {
    userId: stringField(passport, 'userId'),
    tripsLogged: numberField(passport, 'tripsLogged'),
    legendaryCount: numberField(passport, 'legendaryCount'),
    averageChaos: numberField(passport, 'averageChaos'),
    stamps: asArray(passport.stamps).map((item) => {
      const row = asRecord(item) ?? {};
      return {
        tripId: stringField(row, 'tripId'),
        destination: stringField(row, 'destination'),
        destinationKey: stringField(row, 'destinationKey'),
        vibe: stringField(row, 'vibe'),
        earnedAt: stringField(row, 'earnedAt'),
      };
    }),
  };
}

export function mapCmsPage(raw: unknown): Record<string, unknown> | null {
  const page = asRecord(raw);
  if (!page) {
    return null;
  }
  const enrichment = asRecord(page.enrichment);
  return {
    id: stringField(page, 'id'),
    slug: stringField(page, 'slug'),
    title: stringField(page, 'title'),
    bodyText: stringField(page, 'bodyText'),
    imageUrl: stringField(page, 'imageUrl'),
    ctaLabel: stringField(page, 'ctaLabel', 'Back'),
    featured: boolField(page, 'featured'),
    readingMinutes: numberField(page, 'readingMinutes', 1),
    chaosHint: numberField(page, 'chaosHint'),
    topics: asArray(page.topics).map(String),
    accentColor: stringField(page, 'accentColor', '#3DDC97'),
    highlights: asArray(page.highlights).map(String),
    vibeIndex: enrichment ? numberField(enrichment, 'vibeIndex') : null,
    enrichmentHops: enrichment ? asArray(enrichment.hops).map(String) : [],
    children: asArray(page.children)
      .map((child) => mapCmsPage(child))
      .filter((child): child is Record<string, unknown> => child != null),
  };
}

export function mapCmsTab(raw: unknown) {
  const tab = asRecord(raw);
  if (!tab) {
    return null;
  }
  return {
    id: stringField(tab, 'id'),
    slug: stringField(tab, 'slug'),
    screenKey: stringField(tab, 'screenKey'),
    title: stringField(tab, 'title'),
    iconGlyph: stringField(tab, 'iconGlyph'),
    heroTitle: stringField(tab, 'heroTitle'),
    heroSubtitle: stringField(tab, 'heroSubtitle'),
    heroImageUrl: stringField(tab, 'heroImageUrl'),
    sortOrder: numberField(tab, 'sortOrder'),
    featured: boolField(tab, 'featured'),
    accentColor: stringField(tab, 'accentColor'),
    children: asArray(tab.children)
      .map((child) => mapCmsPage(child))
      .filter((child): child is Record<string, unknown> => child != null),
  };
}

export function mapLuggageLottery(raw: unknown) {
  const lottery = asRecord(raw);
  if (!lottery) {
    return null;
  }
  const prize = asRecord(lottery.prize) ?? {};
  return {
    drawnAt: stringField(lottery, 'drawnAt'),
    ticketStub: stringField(lottery, 'ticketStub'),
    disclaimer: stringField(lottery, 'disclaimer'),
    prize: {
      title: stringField(prize, 'title'),
      rarity: stringField(prize, 'rarity'),
      note: stringField(prize, 'note'),
    },
  };
}
