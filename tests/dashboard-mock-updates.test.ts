import { applyMockUpdates, hasAnyMockUpdateField } from '../packages/mockifyer-dashboard/src/utils/mock-updates';

describe('dashboard mock update helpers', () => {
  it('applies alwaysUseRealApi without rewriting response data or overrides', () => {
    const existingMock = {
      response: {
        status: 200,
        headers: {},
        data: { user: { id: 'stored-latest', name: 'Stored Latest' } },
      },
      responseDateOverrides: [{ path: 'user.expiresAt', offsetDays: 1 }],
    };

    const error = applyMockUpdates(existingMock, { alwaysUseRealApi: true });

    expect(error).toBeNull();
    expect(existingMock.response.data).toEqual({ user: { id: 'stored-latest', name: 'Stored Latest' } });
    expect(existingMock.responseDateOverrides).toEqual([{ path: 'user.expiresAt', offsetDays: 1 }]);
    expect((existingMock as any).alwaysUseRealApi).toBe(true);
  });

  it('requires at least one supported update field', () => {
    expect(hasAnyMockUpdateField({})).toBe(false);
    expect(hasAnyMockUpdateField({ alwaysUseRealApi: false })).toBe(true);
  });
});
