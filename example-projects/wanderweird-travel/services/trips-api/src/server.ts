import express from 'express';
import {
  createMockifyerCorrelationMiddleware,
  initializeMockifyerFromEnv,
} from '@wanderweird/mock-bootstrap';

const PORT = Number(process.env.PORT ?? '4202');

type TripStatus = 'dreaming' | 'booked' | 'in_progress' | 'legendary';

interface PackingItem {
  id: string;
  label: string;
  packed: boolean;
  absurdity: number;
}

interface Trip {
  id: string;
  userId: string;
  title: string;
  destination: string;
  destinationKey: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
  vibe: string;
  notes: string;
  chaosScore: number;
  stampEarned: boolean;
  packingList: PackingItem[];
  itinerary: Array<{ day: number; title: string; detail: string }>;
  createdAt: string;
  updatedAt: string;
}

const DESTINATION_CATALOG = [
  {
    key: 'atlantis',
    name: 'Atlantis Boardwalk',
    vibe: 'Submerged neon nostalgia',
    defaultItinerary: [
      { day: 1, title: 'Arrive via kelp shuttle', detail: 'Tip the merfolk or they rearrange your luggage alphabetically.' },
      { day: 2, title: 'Boardwalk arcade', detail: 'Win a plush kraken. Lose your sense of direction.' },
      { day: 3, title: 'Coral café brunch', detail: 'Order the pearl latte. Do not ask about the foam.' },
    ],
  },
  {
    key: 'moonbase',
    name: 'Moon Base Brunch Bar',
    vibe: 'Low-gravity mimosas',
    defaultItinerary: [
      { day: 1, title: 'Launch window selfie', detail: 'Helmet reflections count as passport photos.' },
      { day: 2, title: 'Regolith picnic', detail: 'Bring crumbs — the local dust mites appreciate culture.' },
      { day: 3, title: 'Earthrise yoga', detail: 'Downward dog floats. Literally.' },
    ],
  },
  {
    key: 'narnia',
    name: 'Narnia Customs Queue',
    vibe: 'Bureaucratic magic',
    defaultItinerary: [
      { day: 1, title: 'Wardrobe check-in', detail: 'Declare all Turkish Delight. Especially undeclared Turkish Delight.' },
      { day: 2, title: 'Stamp negotiation', detail: 'Talk to the beaver clerk about expedited prophecy processing.' },
      { day: 3, title: 'Lamppost landmark tour', detail: 'Photo ops every 7 minutes. Prophecy optional.' },
    ],
  },
  {
    key: 'upside',
    name: 'Upside-Down Farmers Market',
    vibe: 'Gravity-optional produce',
    defaultItinerary: [
      { day: 1, title: 'Ceiling entrance', detail: 'Mind the hanging tomatoes.' },
      { day: 2, title: 'Invertible cheese tasting', detail: 'Pairs well with confusion.' },
      { day: 3, title: 'Fall upward sundown', detail: 'Bring a net for your hat.' },
    ],
  },
  {
    key: 'bermuda',
    name: 'Bermuda Triangular Buffet',
    vibe: 'All-you-can-vanish',
    defaultItinerary: [
      { day: 1, title: 'Check into the vanishing suite', detail: 'Room key may dematerialize. That is normal.' },
      { day: 2, title: 'Buffet navigation drill', detail: 'If you find the dessert table twice, leave a trail of croutons.' },
      { day: 3, title: 'Exit strategy workshop', detail: 'Or don’t. The island understands.' },
    ],
  },
  {
    key: 'cloudnine',
    name: 'Cloud Nine B&B',
    vibe: 'Soft landings only',
    defaultItinerary: [
      { day: 1, title: 'Cumulus check-in', detail: 'Shoes off. Socks encouraged for traction.' },
      { day: 2, title: 'Fog spa', detail: 'Visibility optional. Vibes mandatory.' },
      { day: 3, title: 'Sunrise above weather', detail: 'Bring sunglasses and existential humility.' },
    ],
  },
] as const;

const DEFAULT_PACKING: Array<Omit<PackingItem, 'id' | 'packed'>> = [
  { label: 'Extra socks (dimensional)', absurdity: 40 },
  { label: 'Reusable reality filter', absurdity: 72 },
  { label: 'Snack that survives customs', absurdity: 25 },
  { label: 'Tiny umbrella for microclimates', absurdity: 55 },
  { label: 'Emergency joke for border agents', absurdity: 88 },
];

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function seedTrips(): Trip[] {
  const stamp = nowIso();
  return [
    {
      id: 'trip_atlantis_1',
      userId: 'u-wanderer',
      title: 'Weekend under the boardwalk',
      destination: 'Atlantis Boardwalk',
      destinationKey: 'atlantis',
      startDate: '2026-11-12',
      endDate: '2026-11-15',
      status: 'booked',
      vibe: 'Submerged neon nostalgia',
      notes: 'Bring waterproof glitter.',
      chaosScore: 67,
      stampEarned: false,
      packingList: DEFAULT_PACKING.map((item) => ({
        ...item,
        id: createId('pack'),
        packed: item.absurdity < 50,
      })),
      itinerary: [...DESTINATION_CATALOG[0].defaultItinerary],
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: 'trip_moon_1',
      userId: 'u-wanderer',
      title: 'Brunch beyond orbit',
      destination: 'Moon Base Brunch Bar',
      destinationKey: 'moonbase',
      startDate: '2027-01-10',
      endDate: '2027-01-13',
      status: 'dreaming',
      vibe: 'Low-gravity mimosas',
      notes: 'Ask for the Earthrise mimosa flight.',
      chaosScore: 81,
      stampEarned: false,
      packingList: DEFAULT_PACKING.map((item) => ({
        ...item,
        id: createId('pack'),
        packed: false,
      })),
      itinerary: [...DESTINATION_CATALOG[1].defaultItinerary],
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: 'trip_narnia_1',
      userId: 'u-jetlag',
      title: 'Express customs day trip',
      destination: 'Narnia Customs Queue',
      destinationKey: 'narnia',
      startDate: '2026-10-15',
      endDate: '2026-10-17',
      status: 'legendary',
      vibe: 'Bureaucratic magic',
      notes: 'Already earned the beaver stamp.',
      chaosScore: 44,
      stampEarned: true,
      packingList: DEFAULT_PACKING.map((item) => ({
        ...item,
        id: createId('pack'),
        packed: true,
      })),
      itinerary: [...DESTINATION_CATALOG[2].defaultItinerary],
      createdAt: stamp,
      updatedAt: stamp,
    },
  ];
}

const trips: Trip[] = seedTrips();

const CHAOS_EVENTS = [
  'Your suitcase briefly joins a parallel itinerary.',
  'Local birds rearrange your boarding pass into modern art.',
  'Hotel wifi only works if you hum in D minor.',
  'A complimentary map appears. It is for a different decade.',
  'Someone upgrades your chaos score for free. Suspicious.',
];

async function main(): Promise<void> {
  await initializeMockifyerFromEnv({ label: 'trips-api' });

  const app = express();
  app.use(express.json());
  app.use(createMockifyerCorrelationMiddleware());

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'trips-api' });
  });

  app.get('/destinations', (_req, res) => {
    res.json({
      destinations: DESTINATION_CATALOG.map((d) => ({
        key: d.key,
        name: d.name,
        vibe: d.vibe,
      })),
    });
  });

  app.get('/trips', (req, res) => {
    const userId = String(req.query.userId ?? '');
    const filtered = userId ? trips.filter((t) => t.userId === userId) : trips;
    res.json({ trips: filtered });
  });

  app.get('/trips/:id', (req, res) => {
    const trip = trips.find((t) => t.id === req.params.id);
    if (!trip) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ trip });
  });

  app.post('/trips', (req, res) => {
    const body = req.body ?? {};
    const destinationKey = String(body.destinationKey ?? 'atlantis');
    const catalog = DESTINATION_CATALOG.find((d) => d.key === destinationKey) ?? DESTINATION_CATALOG[0];
    const userId = String(body.userId ?? 'u-wanderer');
    const stamp = nowIso();

    const trip: Trip = {
      id: createId('trip'),
      userId,
      title: String(body.title ?? `Trip to ${catalog.name}`).trim() || `Trip to ${catalog.name}`,
      destination: catalog.name,
      destinationKey: catalog.key,
      startDate: String(body.startDate ?? '2026-12-01'),
      endDate: String(body.endDate ?? '2026-12-04'),
      status: (body.status as TripStatus) ?? 'dreaming',
      vibe: catalog.vibe,
      notes: String(body.notes ?? ''),
      chaosScore: typeof body.chaosScore === 'number' ? body.chaosScore : 50 + Math.floor(Math.random() * 40),
      stampEarned: false,
      packingList: DEFAULT_PACKING.map((item) => ({
        ...item,
        id: createId('pack'),
        packed: false,
      })),
      itinerary: [...catalog.defaultItinerary],
      createdAt: stamp,
      updatedAt: stamp,
    };

    trips.unshift(trip);
    res.status(201).json({ trip });
  });

  app.patch('/trips/:id', (req, res) => {
    const trip = trips.find((t) => t.id === req.params.id);
    if (!trip) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    const body = req.body ?? {};
    if (typeof body.title === 'string' && body.title.trim()) {
      trip.title = body.title.trim();
    }
    if (typeof body.notes === 'string') {
      trip.notes = body.notes;
    }
    if (typeof body.startDate === 'string') {
      trip.startDate = body.startDate;
    }
    if (typeof body.endDate === 'string') {
      trip.endDate = body.endDate;
    }
    if (body.status === 'dreaming' || body.status === 'booked' || body.status === 'in_progress' || body.status === 'legendary') {
      trip.status = body.status;
    }
    if (Array.isArray(body.packingList)) {
      trip.packingList = body.packingList;
    }
    if (typeof body.stampEarned === 'boolean') {
      trip.stampEarned = body.stampEarned;
    }
    if (typeof body.chaosScore === 'number') {
      trip.chaosScore = Math.max(0, Math.min(100, body.chaosScore));
    }

    trip.updatedAt = nowIso();
    res.json({ trip });
  });

  app.delete('/trips/:id', (req, res) => {
    const index = trips.findIndex((t) => t.id === req.params.id);
    if (index < 0) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const [removed] = trips.splice(index, 1);
    res.json({ ok: true, trip: removed });
  });

  app.post('/trips/:id/chaos-dice', (req, res) => {
    const trip = trips.find((t) => t.id === req.params.id);
    if (!trip) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    const roll = 1 + Math.floor(Math.random() * 6);
    const event = CHAOS_EVENTS[Math.floor(Math.random() * CHAOS_EVENTS.length)];
    trip.chaosScore = Math.max(0, Math.min(100, trip.chaosScore + (roll - 3) * 7));
    trip.notes = `${trip.notes}\n[Chaos ${roll}] ${event}`.trim();
    trip.updatedAt = nowIso();

    res.json({
      roll,
      event,
      trip,
      narration: `You rolled a ${roll}. ${event}`,
    });
  });

  app.get('/passport/:userId', (req, res) => {
    const userTrips = trips.filter((t) => t.userId === req.params.userId);
    const stamps = userTrips
      .filter((t) => t.stampEarned)
      .map((t) => ({
        tripId: t.id,
        destination: t.destination,
        destinationKey: t.destinationKey,
        vibe: t.vibe,
        earnedAt: t.updatedAt,
      }));

    res.json({
      userId: req.params.userId,
      stamps,
      tripsLogged: userTrips.length,
      legendaryCount: userTrips.filter((t) => t.status === 'legendary').length,
      averageChaos:
        userTrips.length === 0
          ? 0
          : Math.round(userTrips.reduce((sum, t) => sum + t.chaosScore, 0) / userTrips.length),
    });
  });

  app.listen(PORT, () => {
    console.log(`[trips-api] http://127.0.0.1:${PORT}`);
  });
}

main().catch((err) => {
  console.error('[trips-api] fatal', err);
  process.exit(1);
});
