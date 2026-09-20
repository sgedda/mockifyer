import {
  applyRuntimeDateManipulationFromProxyPayload,
  getCurrentDate,
  resetDateManipulation,
  syncRuntimeDateManipulationFromDashboard,
} from '@sgedda/mockifyer-core';

describe('runtime date sync from dashboard', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    resetDateManipulation();
    jest.restoreAllMocks();
  });

  it('applyRuntimeDateManipulationFromProxyPayload updates getCurrentDate()', () => {
    applyRuntimeDateManipulationFromProxyPayload({
      dateManipulation: { fixedDate: '2024-07-04T00:00:00.000Z' },
      scenarioResolution: { scenario: 'check-in-open' },
      clientId: 'dev-alice',
    });
    expect(getCurrentDate().toISOString()).toBe('2024-07-04T00:00:00.000Z');
  });

  it('applyRuntimeDateManipulationFromProxyPayload treats null as real time', () => {
    applyRuntimeDateManipulationFromProxyPayload({
      dateManipulation: { fixedDate: '2024-07-04T00:00:00.000Z' },
    });
    applyRuntimeDateManipulationFromProxyPayload({ dateManipulation: null });
    const result = getCurrentDate();
    expect(Math.abs(result.getTime() - Date.now())).toBeLessThan(2000);
  });

  it('syncRuntimeDateManipulationFromDashboard loads GET /api/date-config', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        dateManipulation: { fixedDate: '2021-07-01T00:00:00.000Z' },
        scenario: 'beta',
      }),
    });
    (globalThis as { fetch: typeof fetch }).fetch = fetchFn as unknown as typeof fetch;

    const ok = await syncRuntimeDateManipulationFromDashboard({
      dashboardBaseUrl: 'http://localhost:3002',
      scenario: 'alpha',
      clientId: 'dev-alice',
    });

    expect(ok).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchFn.mock.calls[0][0]);
    expect(calledUrl).toContain('/api/date-config');
    expect(calledUrl).toContain('scenario=alpha');
    expect(calledUrl).toContain('clientId=dev-alice');
    expect(getCurrentDate().toISOString()).toBe('2021-07-01T00:00:00.000Z');
  });
});
