import {
  getDateOverridePreview,
  getFieldOverridePreview,
  getListOverrideFields,
} from '../packages/mockifyer-dashboard/src/utils/mock-override-preview';

describe('dashboard override list previews', () => {
  it('does not treat field-only mocks as date overrides', () => {
    const mockData = {
      responseFieldOverrides: [{ path: 'bookings.0.status', value: 'CONFIRMED' }],
    };

    const date = getDateOverridePreview(mockData);
    const field = getFieldOverridePreview(mockData);
    const listed = getListOverrideFields(mockData);

    expect(date.hasOverrides).toBe(false);
    expect(field.hasOverrides).toBe(true);
    expect(listed.hasResponseDateOverrides).toBe(false);
    expect(listed.hasResponseFieldOverrides).toBe(true);
    expect(listed.responseFieldOverridesPreview).toEqual([
      { path: 'bookings.0.status', summary: '"CONFIRMED"' },
    ]);
  });

  it('summarizes extend and remove field modes', () => {
    const listed = getListOverrideFields({
      responseFieldOverrides: [
        { path: 'bookings', value: { id: '2' }, mode: 'extend' },
        { path: 'bookings.0', mode: 'remove' },
      ],
    });

    expect(listed.responseFieldOverridesPreview).toEqual([
      { path: 'bookings', summary: 'extend {"id":"2"}' },
      { path: 'bookings.0', summary: 'remove' },
    ]);
  });

  it('includes both field and date overlays on the same mock', () => {
    const listed = getListOverrideFields({
      responseFieldOverrides: [{ path: 'bookings.0.status', value: 'CONFIRMED' }],
      responseDateOverrides: [{ path: 'bookings.0.checkInOpensAt', offsetHours: 10 }],
    });

    expect(listed.hasResponseFieldOverrides).toBe(true);
    expect(listed.hasResponseDateOverrides).toBe(true);
    expect(listed.responseDateOverridesPreview[0]).toEqual({
      path: 'bookings.0.checkInOpensAt',
      summary: '10h',
    });
  });
});
