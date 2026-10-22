import { GraphQLError } from 'graphql';
import {
  mapCmsPage,
  mapCmsTab,
  mapDestination,
  mapDiscover,
  mapLuggageLottery,
  mapPassport,
  mapTrip,
  mapUser,
} from './mappers.js';
import {
  asArray,
  asRecord,
  errorMessage,
  fetchJson,
  upstreamBases,
} from './upstream.js';

interface GqlContext {
  authorization?: string;
}

function requireOk(status: number, body: unknown, fallback: string): void {
  if (status >= 400) {
    throw new GraphQLError(errorMessage(body, fallback), {
      extensions: { httpStatus: status },
    });
  }
}

function authHeaders(ctx: GqlContext): Record<string, string> {
  return ctx.authorization ? { Authorization: ctx.authorization } : {};
}

export const resolvers = {
  Query: {
    health: () => 'graphql-api ok',

    me: async (_: unknown, __: unknown, ctx: GqlContext) => {
      const result = await fetchJson(`${upstreamBases.auth}/me`, {
        headers: authHeaders(ctx),
      });
      requireOk(result.status, result.body, 'Not authenticated');
      return mapUser(asRecord(result.body)?.user);
    },

    trips: async (_: unknown, args: { userId: string }) => {
      const result = await fetchJson(
        `${upstreamBases.trips}/trips?userId=${encodeURIComponent(args.userId)}`
      );
      requireOk(result.status, result.body, 'Failed to load trips');
      return asArray(asRecord(result.body)?.trips)
        .map((trip) => mapTrip(trip))
        .filter((trip): trip is NonNullable<ReturnType<typeof mapTrip>> => trip != null);
    },

    trip: async (_: unknown, args: { id: string }) => {
      const result = await fetchJson(
        `${upstreamBases.trips}/trips/${encodeURIComponent(args.id)}`
      );
      requireOk(result.status, result.body, 'Trip not found');
      return mapTrip(asRecord(result.body)?.trip);
    },

    destinations: async () => {
      const result = await fetchJson(`${upstreamBases.trips}/destinations`);
      requireOk(result.status, result.body, 'Failed to load destinations');
      return asArray(asRecord(result.body)?.destinations)
        .map((item) => mapDestination(item))
        .filter((item): item is NonNullable<ReturnType<typeof mapDestination>> => item != null);
    },

    discover: async (_: unknown, args: { destinationKey?: string | null }) => {
      const qs = args.destinationKey
        ? `?destinationKey=${encodeURIComponent(args.destinationKey)}`
        : '';
      const result = await fetchJson(`${upstreamBases.wander}/discover${qs}`);
      requireOk(result.status, result.body, 'Discover failed');
      return mapDiscover(result.body);
    },

    passport: async (_: unknown, args: { userId: string }) => {
      const result = await fetchJson(
        `${upstreamBases.trips}/passport/${encodeURIComponent(args.userId)}`
      );
      requireOk(result.status, result.body, 'Passport not found');
      return mapPassport(result.body);
    },

    luggageLottery: async () => {
      const result = await fetchJson(`${upstreamBases.wander}/luggage-lottery`);
      requireOk(result.status, result.body, 'Lottery jammed');
      return mapLuggageLottery(result.body);
    },

    cmsNavigation: async () => {
      const result = await fetchJson(`${upstreamBases.lore}/navigation`);
      requireOk(result.status, result.body, 'CMS navigation failed');
      const nav = asRecord(result.body);
      const app = asRecord(nav?.app) ?? {};
      return {
        appTitle: typeof app.title === 'string' ? app.title : 'Wanderweird',
        tagline: typeof app.tagline === 'string' ? app.tagline : '',
        source: typeof nav?.source === 'string' ? nav.source : 'unknown',
        tabs: asArray(nav?.tabs)
          .map((tab) => mapCmsTab(tab))
          .filter((tab): tab is NonNullable<ReturnType<typeof mapCmsTab>> => tab != null),
      };
    },

    cmsPage: async (_: unknown, args: { screenKey: string; slugPath: string }) => {
      const encoded = args.slugPath
        .split('/')
        .filter(Boolean)
        .map((part) => encodeURIComponent(part))
        .join('/');
      const result = await fetchJson(
        `${upstreamBases.lore}/tabs/${encodeURIComponent(args.screenKey)}/pages/${encoded}`
      );
      requireOk(result.status, result.body, 'CMS page not found');
      return mapCmsPage(asRecord(result.body)?.page);
    },

    travelerDashboard: async (_: unknown, args: { userId: string }) => {
      const hops = ['graphql-api', 'trips-api', 'wander-api', 'lore-api'];
      const [tripsResult, discoverResult, passportResult, navResult] = await Promise.all([
        fetchJson(`${upstreamBases.trips}/trips?userId=${encodeURIComponent(args.userId)}`),
        fetchJson(`${upstreamBases.wander}/discover`),
        fetchJson(`${upstreamBases.trips}/passport/${encodeURIComponent(args.userId)}`),
        fetchJson(`${upstreamBases.lore}/navigation`),
      ]);

      requireOk(tripsResult.status, tripsResult.body, 'Dashboard trips failed');

      const trips = asArray(asRecord(tripsResult.body)?.trips)
        .map((trip) => mapTrip(trip))
        .filter((trip): trip is NonNullable<ReturnType<typeof mapTrip>> => trip != null)
        .sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate));

      const discover =
        discoverResult.status < 400 ? mapDiscover(discoverResult.body) : null;
      const passport =
        passportResult.status < 400 ? mapPassport(passportResult.body) : null;

      let featuredStory: ReturnType<typeof mapCmsPage> = null;
      if (navResult.status < 400) {
        const tabs = asArray(asRecord(navResult.body)?.tabs);
        for (const tab of tabs) {
          const children = asArray(asRecord(tab)?.children);
          const featured = children.find((child) => Boolean(asRecord(child)?.featured));
          if (featured) {
            featuredStory = mapCmsPage(featured);
            break;
          }
        }
      }

      const avgChaos =
        trips.length === 0
          ? 0
          : Math.round(
              (trips.reduce((sum, trip) => sum + trip.chaosScore, 0) / trips.length) * 10
            ) / 10;

      const upcoming = trips
        .filter((trip) => (trip.daysUntil ?? Number.NEGATIVE_INFINITY) >= 0)
        .sort((a, b) => (a.daysUntil ?? 0) - (b.daysUntil ?? 0));
      const nextTrip = upcoming[0] ?? trips[0] ?? null;

      const destinationName = discover?.destination.name ?? 'the fog';
      const headline =
        nextTrip == null
          ? 'No trips yet — create your first itinerary'
          : (nextTrip.daysUntil ?? 0) >= 0
            ? `Next up: ${nextTrip.title} in ${nextTrip.daysUntil} day(s)`
            : `Recent: ${nextTrip.title} (${Math.abs(nextTrip.daysUntil ?? 0)} days ago)`;
      const moodLine =
        discover != null
          ? `${discover.weatherSummary} Match score ${discover.serendipityScore}% for ${destinationName}.`
          : 'Destination ideas will appear when Discover is available.';

      return {
        userId: args.userId,
        headline,
        moodLine,
        tripCount: trips.length,
        averageChaos: avgChaos,
        nextTrip,
        trips,
        discover,
        passport,
        featuredStory,
        hops,
      };
    },
  },

  Mutation: {
    login: async (_: unknown, args: { username: string; password: string }) => {
      const result = await fetchJson(`${upstreamBases.auth}/login`, {
        method: 'POST',
        body: JSON.stringify({ username: args.username, password: args.password }),
      });
      requireOk(result.status, result.body, 'Login failed');
      const body = asRecord(result.body);
      const user = mapUser(body?.user);
      if (!user || typeof body?.token !== 'string') {
        throw new GraphQLError('Malformed login response');
      }
      return {
        token: body.token,
        welcomeMessage:
          typeof body.welcomeMessage === 'string'
            ? body.welcomeMessage
            : `Welcome back, ${user.displayName}`,
        user,
      };
    },

    updateProfile: async (
      _: unknown,
      args: { input: Record<string, unknown> },
      ctx: GqlContext
    ) => {
      const result = await fetchJson(`${upstreamBases.auth}/me`, {
        method: 'PATCH',
        headers: authHeaders(ctx),
        body: JSON.stringify(args.input),
      });
      requireOk(result.status, result.body, 'Profile update failed');
      return mapUser(asRecord(result.body)?.user);
    },

    createTrip: async (_: unknown, args: { input: Record<string, unknown> }) => {
      const result = await fetchJson(`${upstreamBases.trips}/trips`, {
        method: 'POST',
        body: JSON.stringify(args.input),
      });
      requireOk(result.status, result.body, 'Create trip failed');
      return mapTrip(asRecord(result.body)?.trip);
    },

    updateTrip: async (
      _: unknown,
      args: { id: string; input: Record<string, unknown> }
    ) => {
      const result = await fetchJson(
        `${upstreamBases.trips}/trips/${encodeURIComponent(args.id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify(args.input),
        }
      );
      requireOk(result.status, result.body, 'Update trip failed');
      return mapTrip(asRecord(result.body)?.trip);
    },

    deleteTrip: async (_: unknown, args: { id: string }) => {
      const result = await fetchJson(
        `${upstreamBases.trips}/trips/${encodeURIComponent(args.id)}`,
        { method: 'DELETE' }
      );
      requireOk(result.status, result.body, 'Delete trip failed');
      return { ok: true, id: args.id };
    },

    rollChaosDice: async (_: unknown, args: { id: string }) => {
      const result = await fetchJson(
        `${upstreamBases.trips}/trips/${encodeURIComponent(args.id)}/chaos-dice`,
        { method: 'POST' }
      );
      requireOk(result.status, result.body, 'Chaos dice stuck');
      const body = asRecord(result.body);
      const trip = mapTrip(body?.trip);
      if (!trip) {
        throw new GraphQLError('Chaos dice returned no trip');
      }
      return {
        roll: typeof body?.roll === 'number' ? body.roll : 0,
        event: typeof body?.event === 'string' ? body.event : 'mysterious silence',
        narration:
          typeof body?.narration === 'string' ? body.narration : 'The dice refuse commentary.',
        trip,
      };
    },
  },
};
