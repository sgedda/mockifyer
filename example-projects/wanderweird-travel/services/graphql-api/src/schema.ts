export const typeDefs = /* GraphQL */ `
  enum TripStatus {
    dreaming
    booked
    in_progress
    legendary
  }

  type NotificationPrefs {
    serendipityPings: Boolean!
    luggageLottery: Boolean!
    weatherWeirdness: Boolean!
  }

  type User {
    id: ID!
    username: String!
    displayName: String!
    email: String!
    homeBase: String!
    jetLagTolerance: Int!
    preferredChaos: String!
    passportColor: String!
    bio: String!
    notifications: NotificationPrefs!
  }

  type PackingItem {
    id: ID!
    label: String!
    packed: Boolean!
    absurdity: Int!
  }

  type ItineraryDay {
    day: Int!
    title: String!
    detail: String!
  }

  type Trip {
    id: ID!
    userId: ID!
    title: String!
    destination: String!
    destinationKey: String!
    startDate: String!
    endDate: String!
    status: TripStatus!
    vibe: String!
    notes: String!
    chaosScore: Int!
    """Mapped band derived from chaosScore (calm → existential)."""
    chaosBand: String!
    stampEarned: Boolean!
    packingList: [PackingItem!]!
    """0–100 percent of packing list marked packed."""
    packingProgress: Int!
    daysUntil: Int
    itinerary: [ItineraryDay!]!
    createdAt: String!
    updatedAt: String!
  }

  type Destination {
    key: String!
    name: String!
    vibe: String!
  }

  type DiscoverDestination {
    key: String!
    name: String!
    blurb: String!
  }

  type Advice {
    source: String!
    advice: String!
    id: Int
  }

  type DelayActivity {
    source: String!
    headline: String!
    activity: String!
    type: String!
    participants: Int!
  }

  type NearbyPlace {
    xid: ID!
    name: String!
    kinds: String!
    distanceMeters: Int
    rate: Int
  }

  type NearbyPlaces {
    source: String!
    note: String
    radiusMeters: Int!
    places: [NearbyPlace!]!
  }

  type CountryVignette {
    source: String!
    name: String!
    capital: String!
    region: String!
    population: Int
    flagEmoji: String
    languages: [String!]!
    fictionalBridge: String!
  }

  type Discover {
    destination: DiscoverDestination!
    advice: Advice!
    country: CountryVignette
    delayActivity: DelayActivity
    nearby: NearbyPlaces
    serendipityScore: Int!
    temperatureC: Float
    weatherSummary: String!
    currencyNote: String!
    generatedAt: String!
    rawWeatherJson: String!
  }

  type PassportStamp {
    tripId: ID!
    destination: String!
    destinationKey: String!
    vibe: String!
    earnedAt: String!
  }

  type Passport {
    userId: ID!
    tripsLogged: Int!
    legendaryCount: Int!
    averageChaos: Float!
    stamps: [PassportStamp!]!
  }

  type CmsPage {
    id: ID!
    slug: String!
    title: String!
    bodyText: String!
    imageUrl: String!
    ctaLabel: String!
    featured: Boolean!
    readingMinutes: Int!
    chaosHint: Int!
    topics: [String!]!
    accentColor: String!
    highlights: [String!]!
    vibeIndex: Int
    enrichmentHops: [String!]!
    children: [CmsPage!]!
  }

  type CmsTab {
    id: ID!
    slug: String!
    screenKey: String!
    title: String!
    iconGlyph: String!
    heroTitle: String!
    heroSubtitle: String!
    heroImageUrl: String!
    sortOrder: Int!
    featured: Boolean!
    accentColor: String
    children: [CmsPage!]!
  }

  type CmsNavigation {
    appTitle: String!
    tagline: String!
    source: String!
    tabs: [CmsTab!]!
  }

  type LuggagePrize {
    title: String!
    rarity: String!
    note: String!
  }

  type LuggageLottery {
    drawnAt: String!
    ticketStub: String!
    disclaimer: String!
    prize: LuggagePrize!
  }

  """Aggregated traveler home — maps trips + wander + passport + featured CMS."""
  type TravelerDashboard {
    userId: ID!
    headline: String!
    moodLine: String!
    tripCount: Int!
    averageChaos: Float!
    nextTrip: Trip
    trips: [Trip!]!
    discover: Discover
    passport: Passport
    featuredStory: CmsPage
    hops: [String!]!
  }

  type AuthPayload {
    token: String!
    welcomeMessage: String!
    user: User!
  }

  type ChaosDiceResult {
    roll: Int!
    event: String!
    narration: String!
    trip: Trip!
  }

  type DeleteResult {
    ok: Boolean!
    id: ID!
  }

  input CreateTripInput {
    userId: ID!
    title: String
    destinationKey: String!
    startDate: String
    endDate: String
    notes: String
    vibe: String
  }

  input UpdateTripInput {
    title: String
    status: TripStatus
    notes: String
    vibe: String
    startDate: String
    endDate: String
  }

  input UpdateProfileInput {
    displayName: String
    email: String
    homeBase: String
    jetLagTolerance: Int
    preferredChaos: String
    passportColor: String
    bio: String
  }

  type Query {
    health: String!
    me: User
    trips(userId: ID!): [Trip!]!
    trip(id: ID!): Trip
    destinations: [Destination!]!
    discover(destinationKey: String): Discover
    passport(userId: ID!): Passport
    luggageLottery: LuggageLottery
    cmsNavigation: CmsNavigation
    cmsPage(screenKey: String!, slugPath: String!): CmsPage
    travelerDashboard(userId: ID!): TravelerDashboard!
  }

  type Mutation {
    login(username: String!, password: String!): AuthPayload!
    updateProfile(input: UpdateProfileInput!): User!
    createTrip(input: CreateTripInput!): Trip!
    updateTrip(id: ID!, input: UpdateTripInput!): Trip!
    deleteTrip(id: ID!): DeleteResult!
    rollChaosDice(id: ID!): ChaosDiceResult!
  }
`;
