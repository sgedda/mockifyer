import { Platform } from 'react-native';
import type { Trip, UserProfile } from '../types';

function defaultGatewayOrigin(): string {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:4200';
  }
  return 'http://127.0.0.1:4200';
}

const GATEWAY_BASE = (
  process.env.EXPO_PUBLIC_GATEWAY_URL ?? defaultGatewayOrigin()
).replace(/\/$/, '');

interface GraphQlResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
  token?: string
): Promise<T> {
  const response = await fetch(`${GATEWAY_BASE}/graphql`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = (await response.json().catch(async () => ({
    errors: [{ message: await response.text() }],
  }))) as GraphQlResponse<T>;

  if (!response.ok || payload.errors?.length) {
    throw new Error(payload.errors?.[0]?.message ?? `GraphQL failed (${response.status})`);
  }
  if (!payload.data) {
    throw new Error('GraphQL returned no data');
  }
  return payload.data;
}

/** Trip shape from GraphQL includes mapped fields the REST list does not. */
export interface GraphQlTrip extends Trip {
  chaosBand: string;
  packingProgress: number;
  daysUntil: number | null;
}

export interface TravelerDashboard {
  userId: string;
  headline: string;
  moodLine: string;
  tripCount: number;
  averageChaos: number;
  nextTrip: GraphQlTrip | null;
  trips: GraphQlTrip[];
  hops: string[];
  featuredStory: {
    id: string;
    title: string;
    topics: string[];
    vibeIndex: number | null;
  } | null;
}

const TRIPS_QUERY = `
  query Trips($userId: ID!) {
    trips(userId: $userId) {
      id
      userId
      title
      destination
      destinationKey
      startDate
      endDate
      status
      vibe
      notes
      chaosScore
      chaosBand
      stampEarned
      packingProgress
      daysUntil
      packingList { id label packed absurdity }
      itinerary { day title detail }
      createdAt
      updatedAt
    }
  }
`;

const DASHBOARD_QUERY = `
  query TravelerDashboard($userId: ID!) {
    travelerDashboard(userId: $userId) {
      userId
      headline
      moodLine
      tripCount
      averageChaos
      hops
      nextTrip {
        id
        title
        destination
        chaosScore
        chaosBand
        daysUntil
        packingProgress
      }
      trips {
        id
        userId
        title
        destination
        destinationKey
        startDate
        endDate
        status
        vibe
        notes
        chaosScore
        chaosBand
        stampEarned
        packingProgress
        daysUntil
        packingList { id label packed absurdity }
        itinerary { day title detail }
        createdAt
        updatedAt
      }
      featuredStory {
        id
        title
        topics
        vibeIndex
      }
    }
  }
`;

const CREATE_TRIP_MUTATION = `
  mutation CreateTrip($input: CreateTripInput!) {
    createTrip(input: $input) {
      id
      userId
      title
      destination
      destinationKey
      startDate
      endDate
      status
      vibe
      notes
      chaosScore
      chaosBand
      stampEarned
      packingProgress
      daysUntil
      packingList { id label packed absurdity }
      itinerary { day title detail }
      createdAt
      updatedAt
    }
  }
`;

const ROLL_CHAOS_MUTATION = `
  mutation RollChaos($id: ID!) {
    rollChaosDice(id: $id) {
      roll
      event
      narration
      trip {
        id
        userId
        title
        destination
        destinationKey
        startDate
        endDate
        status
        vibe
        notes
        chaosScore
        chaosBand
        stampEarned
        packingProgress
        daysUntil
        packingList { id label packed absurdity }
        itinerary { day title detail }
        createdAt
        updatedAt
      }
    }
  }
`;

export const gql = {
  listTrips(userId: string) {
    return graphqlRequest<{ trips: GraphQlTrip[] }>(TRIPS_QUERY, { userId }).then(
      (data) => data.trips
    );
  },

  travelerDashboard(userId: string) {
    return graphqlRequest<{ travelerDashboard: TravelerDashboard }>(DASHBOARD_QUERY, {
      userId,
    }).then((data) => data.travelerDashboard);
  },

  createTrip(input: Record<string, unknown>) {
    return graphqlRequest<{ createTrip: GraphQlTrip }>(CREATE_TRIP_MUTATION, { input }).then(
      (data) => data.createTrip
    );
  },

  rollChaosDice(id: string) {
    return graphqlRequest<{
      rollChaosDice: {
        roll: number;
        event: string;
        narration: string;
        trip: GraphQlTrip;
      };
    }>(ROLL_CHAOS_MUTATION, { id }).then((data) => data.rollChaosDice);
  },

  me(token: string) {
    return graphqlRequest<{ me: UserProfile | null }>(
      `query { me { id username displayName email homeBase jetLagTolerance preferredChaos passportColor bio notifications { serendipityPings luggageLottery weatherWeirdness } } }`,
      undefined,
      token
    ).then((data) => data.me);
  },
};
