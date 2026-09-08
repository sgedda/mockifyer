import {
  applyAtlasPackToData,
  applyActiveAtlasPackToData,
  extractOperationNameFromRequestBody,
  normalizeAtlasPack,
  registerAtlasPacks,
  resetAtlasPackRuntime,
  setActiveAtlasPack,
  validateAtlasPack,
  mergeSelectedArrayItems,
  type AtlasPack,
} from '../packages/mockifyer-core/src';

describe('atlas packs', () => {
  beforeEach(() => {
    resetAtlasPackRuntime();
    delete process.env.MOCKIFYER_ATLAS_PACK;
  });

  afterEach(() => {
    resetAtlasPackRuntime();
    delete process.env.MOCKIFYER_ATLAS_PACK;
  });

  const samplePack = (): AtlasPack =>
    normalizeAtlasPack({
      id: 'check-in-open',
      label: 'Check-in open trips',
      updatedAt: '2026-01-01T00:00:00.000Z',
      overlays: [
        {
          datasourceId: 'trips-list',
          operation: 'GetTrips',
          path: 'trips',
          select: { field: 'id', values: ['trip-nyc', 'trip-rome'] },
          fieldOverrides: [{ path: 'status', value: 'CHECK_IN_OPEN' }],
          pins: [
            {
              id: 'trip-rome',
              data: { id: 'trip-rome', status: 'SCHEDULED', bookingNumber: 'BK-ROME' },
            },
          ],
        },
      ],
    });

  it('validateAtlasPack rejects bad ids', () => {
    expect(validateAtlasPack({ id: 'bad id', label: 'x', overlays: [] })).toMatch(/pack.id/);
  });

  it('mergeSelectedArrayItems prefers live then pins', () => {
    const { items, usedLiveIds, usedPinIds, pins } = mergeSelectedArrayItems({
      liveArray: [{ id: 'trip-nyc', status: 'SCHEDULED' }],
      select: { field: 'id', values: ['trip-nyc', 'trip-rome'] },
      pins: [
        { id: 'trip-rome', data: { id: 'trip-rome', status: 'SCHEDULED' } },
      ],
      fieldOverrides: [{ path: 'status', value: 'CHECK_IN_OPEN' }],
      getNow: () => new Date('2026-06-01T00:00:00.000Z'),
    });

    expect(usedLiveIds).toEqual(['trip-nyc']);
    expect(usedPinIds).toEqual(['trip-rome']);
    expect(items).toEqual([
      { id: 'trip-nyc', status: 'CHECK_IN_OPEN' },
      { id: 'trip-rome', status: 'CHECK_IN_OPEN' },
    ]);
    expect(pins.find((p) => p.id === 'trip-nyc')?.data).toEqual({
      id: 'trip-nyc',
      status: 'SCHEDULED',
    });
  });

  it('applyAtlasPackToData filters trips and applies field overrides', () => {
    const pack = samplePack();
    const result = applyAtlasPackToData(
      {
        trips: [
          { id: 'trip-nyc', status: 'SCHEDULED' },
          { id: 'trip-lax', status: 'SCHEDULED' },
        ],
      },
      pack,
      { datasourceId: 'trips-list', getNow: () => new Date('2026-06-01T00:00:00.000Z') }
    );

    expect(result.appliedOverlayCount).toBe(1);
    expect(result.usedPinCount).toBe(1);
    expect(result.data).toEqual({
      trips: [
        { id: 'trip-nyc', status: 'CHECK_IN_OPEN' },
        { id: 'trip-rome', status: 'CHECK_IN_OPEN', bookingNumber: 'BK-ROME' },
      ],
    });
    expect(result.pack?.overlays[0]?.pins?.some((p) => p.id === 'trip-nyc')).toBe(true);
  });

  it('applyActiveAtlasPackToData uses registered active pack', () => {
    registerAtlasPacks([samplePack()]);
    setActiveAtlasPack('check-in-open');

    const result = applyActiveAtlasPackToData(
      { trips: [{ id: 'trip-nyc', status: 'SCHEDULED' }] },
      { operation: 'GetTrips', getNow: () => new Date('2026-06-01T00:00:00.000Z') }
    );

    expect(result.packId).toBe('check-in-open');
    expect((result.data as { trips: unknown[] }).trips).toHaveLength(2);
  });

  it('extractOperationNameFromRequestBody reads GraphQL body', () => {
    expect(
      extractOperationNameFromRequestBody({
        operationName: 'GetTrips',
        query: 'query GetTrips { trips { id } }',
      })
    ).toBe('GetTrips');
  });

  it('skips missing ids without pins', () => {
    const pack = normalizeAtlasPack({
      id: 'only-live',
      label: 'Only live',
      updatedAt: '2026-01-01T00:00:00.000Z',
      overlays: [
        {
          path: 'bookings',
          select: { field: 'bookingNumber', values: ['BK-1', 'BK-missing'] },
        },
      ],
    });

    const result = applyAtlasPackToData(
      { bookings: [{ bookingNumber: 'BK-1', status: 'OK' }] },
      pack,
      {}
    );

    expect(result.data).toEqual({
      bookings: [{ bookingNumber: 'BK-1', status: 'OK' }],
    });
  });
});
