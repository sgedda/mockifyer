import {
  arrayItemGroupLabel,
  arrayPathFromItemPath,
  groupOverridesByTopLevelArray,
  pathRelativeToArrayItem,
  summarizeOverrideArrayItem,
  topLevelArrayItemPath,
} from '@/lib/override-path-groups';
import {
  formatGraphqlRequestBodyForEditor,
  graphqlQueryPreviewText,
  graphqlVariablesPreviewText,
} from '@/lib/graphql-request-preview';

describe('override-path-groups', () => {
  it('finds the first array item in a nested GraphQL path', () => {
    expect(topLevelArrayItemPath('data.myAccount.bookings.0.booking.bookedDate')).toBe(
      'data.myAccount.bookings.0'
    );
    expect(arrayPathFromItemPath('data.myAccount.bookings.0')).toBe('data.myAccount.bookings');
    expect(arrayItemGroupLabel('data.myAccount.bookings.0')).toBe('bookings[0]');
    expect(pathRelativeToArrayItem('data.myAccount.bookings.0.booking.bookedDate', 'data.myAccount.bookings.0')).toBe(
      'booking.bookedDate'
    );
  });

  it('returns null when the path has no array index', () => {
    expect(topLevelArrayItemPath('data.user.createdAt')).toBeNull();
    expect(topLevelArrayItemPath('')).toBeNull();
  });

  it('groups overrides per top-level array item and keeps ungrouped rows in first-seen order', () => {
    const rows = [
      { path: 'data.myAccount.bookings.1.booking.bookedDate' },
      { path: 'expiresAt' },
      { path: 'data.myAccount.bookings.0.booking.bookedDate' },
      { path: 'data.myAccount.bookings.0.booking.accommodations.0.checkoutDateUtc' },
      { path: 'data.reservations.0.id' },
    ];
    const sections = groupOverridesByTopLevelArray(rows);
    expect(sections).toHaveLength(3);
    expect(sections[0]).toMatchObject({ kind: 'array', label: 'bookings' });
    if (sections[0]!.kind !== 'array') throw new Error('expected bookings section');
    expect(sections[0].itemGroups.map((g) => g.arrayItemPath)).toEqual([
      'data.myAccount.bookings.0',
      'data.myAccount.bookings.1',
    ]);
    expect(sections[0].itemGroups[0]!.children.map((child) => child.kind)).toEqual([
      'ungrouped',
      'array',
    ]);
    const nested = sections[0].itemGroups[0]!.children[1];
    expect(nested).toMatchObject({ kind: 'array', label: 'accommodations' });
    if (nested?.kind !== 'array') throw new Error('expected nested accommodations');
    expect(nested.itemGroups.map((g) => g.arrayItemPath)).toEqual([
      'data.myAccount.bookings.0.booking.accommodations.0',
    ]);
    expect(sections[0].itemGroups[1]!.children).toHaveLength(1);
    expect(sections[0].itemGroups[1]!.children[0]).toMatchObject({ kind: 'ungrouped', index: 0 });
    expect(sections[1]).toMatchObject({ kind: 'ungrouped', index: 1 });
    expect(sections[2]).toMatchObject({ kind: 'array', label: 'reservations' });
  });

  it('nests a second array under the parent item', () => {
    const sections = groupOverridesByTopLevelArray([
      { path: 'data.bookings.0.booking.bookedDate' },
      { path: 'data.bookings.0.booking.accommodations.1.checkIn' },
      { path: 'data.bookings.0.booking.accommodations.0.checkOut' },
    ]);
    expect(sections).toHaveLength(1);
    if (sections[0]?.kind !== 'array') throw new Error('expected bookings');
    const item = sections[0].itemGroups[0];
    expect(item?.arrayItemPath).toBe('data.bookings.0');
    expect(item?.children[0]).toMatchObject({ kind: 'ungrouped', index: 0 });
    const acc = item?.children[1];
    expect(acc).toMatchObject({ kind: 'array', label: 'accommodations' });
    if (acc?.kind !== 'array') throw new Error('expected accommodations');
    expect(acc.itemGroups.map((g) => g.indexLabel)).toEqual(['[0]', '[1]']);
  });

  it('summarizes a GraphQL booking edge for identity', () => {
    const summary = summarizeOverrideArrayItem({
      __typename: 'BookingEdge',
      booking: {
        __typename: 'Booking',
        id: 'bkg_123',
        bookingNumber: '8K2P91',
        status: 'CONFIRMED',
        bookedDate: '2026-04-07T17:48:19.33Z',
      },
    });
    expect(summary).toContain('BookingEdge');
    expect(summary).toContain('bkg_123');
    expect(summary).toContain('8K2P91');
    expect(summary).toContain('CONFIRMED');
  });
});

describe('graphql-request-preview', () => {
  it('formats a GraphQL POST body with operation name, query, and variables', () => {
    const text = formatGraphqlRequestBodyForEditor({
      operationName: 'myAccountDeferredBookings',
      query: 'query myAccountDeferredBookings { myAccount { bookings { id } } }',
      variables: { timeFilter: 'UPCOMING' },
    });
    expect(text).toContain('# operationName: myAccountDeferredBookings');
    expect(text).toContain('query myAccountDeferredBookings');
    expect(text).toContain('# Variables');
    expect(text).toContain('UPCOMING');
  });

  it('prefers server queryPreview over the full query', () => {
    expect(
      graphqlQueryPreviewText({
        query: 'query Huge { '.padEnd(4000, 'x') + ' }',
        queryPreview: 'query Bookings {\n  myAccount { bookings }\n}',
      })
    ).toBe('query Bookings {\n  myAccount { bookings }\n}');
  });

  it('truncates client-side variables JSON', () => {
    const preview = graphqlVariablesPreviewText({
      variables: { huge: 'x'.repeat(2000) },
    });
    expect(preview).toBeTruthy();
    expect(preview!.length).toBeLessThan(500);
    expect(preview).toContain('…');
  });
});
