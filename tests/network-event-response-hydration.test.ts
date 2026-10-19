import type { MockData, NetworkEvent } from '@sgedda/mockifyer-core';
import { hydrateResponsePreviewsFromMocks } from '../packages/mockifyer-dashboard/src/utils/network-event-response-hydration';

function hop(overrides: Partial<NetworkEvent>): NetworkEvent {
  return {
    id: 'e1',
    timestamp: '2026-09-28T18:00:00.000Z',
    scenario: 'default',
    transport: 'proxy',
    method: 'GET',
    url: 'https://api.example.com/x',
    source: 'mock-hit',
    ...overrides,
  };
}

function mock(data: unknown, extra: Partial<MockData> = {}): MockData {
  return {
    request: { method: 'GET', url: 'https://api.example.com/x', headers: {}, queryParams: {} },
    response: { status: 200, data, headers: {} },
    timestamp: '2026-09-28T18:00:00.000Z',
    ...extra,
  } as MockData;
}

describe('hydrateResponsePreviewsFromMocks', () => {
  it('fills the response preview from the mock for the hop hash, one lookup per hash', async () => {
    const getByHashInScenario = jest.fn(async () => mock({ ok: true }));
    const events = [
      hop({ id: 'a', requestHash: 'h1' }),
      hop({ id: 'b', requestHash: 'h1' }),
    ];
    const out = await hydrateResponsePreviewsFromMocks(events, { getByHashInScenario }, 'default');
    expect(out[0].responseBodyPreview).toContain('"ok": true');
    expect(out[1].responseBodyPreview).toContain('"ok": true');
    expect(getByHashInScenario).toHaveBeenCalledTimes(1);
    expect(getByHashInScenario).toHaveBeenCalledWith('h1', 'default');
  });

  it('keeps stored previews, skips pending mocks, and tolerates lookup errors', async () => {
    const getByHashInScenario = jest.fn(async (hash: string) => {
      if (hash === 'pending') return mock(null, { responsePending: true });
      if (hash === 'boom') throw new Error('redis down');
      return null;
    });
    const events = [
      hop({ id: 'stored', requestHash: 'h1', responseBodyPreview: 'kept' }),
      hop({ id: 'pending', requestHash: 'pending' }),
      hop({ id: 'boom', requestHash: 'boom' }),
      hop({ id: 'nohash' }),
    ];
    const out = await hydrateResponsePreviewsFromMocks(events, { getByHashInScenario }, 'default');
    expect(out.map((e) => e.responseBodyPreview)).toEqual(['kept', undefined, undefined, undefined]);
    expect(getByHashInScenario).toHaveBeenCalledTimes(2);
  });
});
