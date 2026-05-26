import {
  buildAiContext,
  getMockEndpointKey,
  normalizeAiFieldPath,
  type MockData,
} from '@sgedda/mockifyer-core';

function makeMock(
  url: string,
  responseData: unknown,
  status = 200,
  extra: Partial<MockData> = {}
): MockData {
  return {
    request: { method: 'GET', url, headers: {} },
    response: { status, data: responseData, headers: {} },
    timestamp: '2026-05-24T00:00:00.000Z',
    ...extra,
  };
}

describe('ai-context', () => {
  it('normalizeAiFieldPath collapses array indices', () => {
    expect(normalizeAiFieldPath('orders.0.status')).toBe('orders.*.status');
    expect(normalizeAiFieldPath('items.12.id')).toBe('items.*.id');
  });

  it('getMockEndpointKey groups by method and pathname', () => {
    const mock = makeMock('https://api.example.com/orders?page=1', { ok: true });
    expect(getMockEndpointKey(mock)).toBe('GET:https://api.example.com/orders');
  });

  it('buildAiContext profile mode returns selected fields and schema', () => {
    const primary = makeMock('https://api.example.com/orders', {
      orders: [
        { status: 'shipped', total: 42.5, id: 'uuid-123' },
      ],
      meta: { hasMore: false, traceId: 'abc-def-ghi-jkl-mno-pqr-stu-vwx-yz01' },
    });

    const result = buildAiContext(primary, [], { mode: 'profile', maxPaths: 10 });

    expect(result.mode).toBe('profile');
    expect(result.status).toBe(200);
    expect(result.endpoint.pathname).toBe('/orders');
    expect(result.profile.fields['orders.*.status']).toBe('shipped');
    expect(result.profile.fields['meta.hasMore']).toBe(false);
    expect(result.profile.schema['orders.*.status']?.type).toBe('string');
    expect(result.discovery.includedPaths).toBeGreaterThan(0);
    expect(result.discovery.omittedBytes).toBeGreaterThanOrEqual(0);
  });

  it('buildAiContext schema mode omits field values', () => {
    const primary = makeMock('https://api.example.com/user', {
      user: { status: 'active', email: 'a@example.com' },
    });

    const result = buildAiContext(primary, [], { mode: 'schema' });

    expect(result.profile.fields).toEqual({});
    expect(result.profile.schema['user.status']).toBeDefined();
  });

  it('buildAiContext suggest mode returns ranked suggestions', () => {
    const primary = makeMock('https://api.example.com/items', {
      items: [{ status: 'ok' }],
    });

    const result = buildAiContext(primary, [], { mode: 'suggest' });

    expect(result.suggestions?.length).toBeGreaterThan(0);
    expect(result.suggestions?.[0]?.path).toBeTruthy();
    expect(typeof result.suggestions?.[0]?.score).toBe('number');
  });

  it('uses cross-recording diff for state hints', () => {
    const primary = makeMock('https://api.example.com/orders', {
      orders: [{ status: 'pending' }],
    });
    const related = [
      makeMock('https://api.example.com/orders', { orders: [{ status: 'shipped' }] }),
      makeMock('https://api.example.com/orders', { orders: [{ status: 'cancelled' }] }),
    ];

    const result = buildAiContext(primary, related, { mode: 'profile', maxPaths: 5 });

    expect(result.discovery.sources).toContain('cross-recording-diff');
    const statusHint = result.profile.stateHints.find((h) => h.path === 'orders.*.status');
    expect(statusHint?.observed.length).toBeGreaterThanOrEqual(2);
  });

  it('boosts ui.consumers paths when present', () => {
    const primary = {
      ...makeMock('https://api.example.com/profile', {
        user: { email: 'a@b.com', internalId: 'x' },
      }),
      ui: {
        consumers: [{ fieldPath: 'user.email', component: 'UserHeader' }],
      },
    } as MockData & {
      ui?: { consumers?: Array<{ fieldPath: string; component?: string }> };
    };

    const result = buildAiContext(primary, [], { mode: 'suggest' });
    const email = result.suggestions?.find((s) => s.path === 'user.email');
    const internal = result.suggestions?.find((s) => s.path === 'user.internalId');

    expect(email?.score).toBeGreaterThan(internal?.score ?? 0);
    expect(email?.reasons.some((r) => r.includes('UserHeader'))).toBe(true);
  });

  it('respects explicit includePaths', () => {
    const primary = makeMock('https://api.example.com/data', {
      alpha: 1,
      beta: 2,
      gamma: 3,
    });

    const result = buildAiContext(primary, [], {
      mode: 'profile',
      includePaths: ['gamma'],
      maxPaths: 1,
    });

    expect(result.profile.fields.gamma).toBe(3);
    expect(result.profile.fields.alpha).toBeUndefined();
  });
});
