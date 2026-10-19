import { toNetworkLogBodyPreview, type MockData, type NetworkEvent } from '@sgedda/mockifyer-core';
import type { DashboardContextConfig } from './dashboard-context';
import { createDashboardMockStore } from './create-dashboard-mock-store';
import { isCentralizedDashboardProvider } from './dashboard-provider';

export interface MockResponseReader {
  getByHashInScenario(hash: string, scenarioName: string): Promise<MockData | null | undefined>;
}

function needsResponseHydration(event: NetworkEvent): boolean {
  return (
    event.kind !== 'incident' &&
    !event.responseBodyPreview &&
    typeof event.requestHash === 'string' &&
    event.requestHash.length > 0
  );
}

function mockLookupKey(scenario: string, hash: string): string {
  return `${scenario}\n${hash}`;
}

/**
 * Fill `responseBodyPreview` on hops that were logged without one, using the recorded
 * mock for the hop's `requestHash`. The hop log keeps only request data; the response
 * body already lives in the mock, so it is read on demand instead of stored per hop.
 *
 * Hops with no stored mock, or a mock still waiting for its response, stay without a body.
 * The preview reflects the mock as it is now, which can differ from the original response
 * after a refresh or an override.
 */
export async function hydrateResponsePreviewsFromMocks(
  events: NetworkEvent[],
  reader: MockResponseReader,
  fallbackScenario: string
): Promise<NetworkEvent[]> {
  const lookups = new Map<string, Promise<MockData | null | undefined>>();
  for (const event of events) {
    if (!needsResponseHydration(event)) continue;
    const scenario = event.scenario || fallbackScenario;
    const key = mockLookupKey(scenario, event.requestHash!);
    if (!lookups.has(key)) {
      lookups.set(
        key,
        reader.getByHashInScenario(event.requestHash!, scenario).catch(() => null)
      );
    }
  }
  if (lookups.size === 0) return events;

  const resolved = new Map<string, MockData | null | undefined>();
  await Promise.all(
    [...lookups].map(async ([key, pending]) => {
      resolved.set(key, await pending);
    })
  );

  return events.map((event) => {
    if (!needsResponseHydration(event)) return event;
    const mock = resolved.get(mockLookupKey(event.scenario || fallbackScenario, event.requestHash!));
    if (!mock || mock.responsePending === true) return event;
    const responseBodyPreview = toNetworkLogBodyPreview(mock.response?.data);
    return responseBodyPreview ? { ...event, responseBodyPreview } : event;
  });
}

/** {@link hydrateResponsePreviewsFromMocks} against the dashboard mock store; no-op on filesystem. */
export async function hydrateResponsePreviewsForDashboard(
  events: NetworkEvent[],
  config: DashboardContextConfig,
  mockDataPath: string,
  scenario: string
): Promise<NetworkEvent[]> {
  if (!isCentralizedDashboardProvider(config.provider)) return events;
  const store = createDashboardMockStore(config, mockDataPath);
  try {
    return await hydrateResponsePreviewsFromMocks(events, store, scenario);
  } finally {
    await store.close().catch(() => undefined);
  }
}
