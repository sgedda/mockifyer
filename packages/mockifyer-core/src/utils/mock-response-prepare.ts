import type { MockData } from '../types';
import {
  applyDeviceFieldOverlaysToData,
  type ApplyDeviceFieldOverlaysLookup,
} from './device-field-overlays';
import { applyResponseDateOverridesToData } from './mock-response-date-overrides';
import { applyResponseFieldOverridesToData } from './mock-response-field-overrides';
import {
  arePoolRefsEnabled,
  containsPoolRefs,
  PoolRefResolveError,
  resolvePoolRefsInData,
  type LoadPoolResponseFn,
} from './fixture-pool/resolve-pool-refs';

export interface PrepareMockResponseOptions {
  /**
   * Load a promoted pool response by id. Required when `response.data` contains `$pool`
   * refs and pool refs are enabled (`MOCKIFYER_POOL_REFS` not `false`).
   */
  loadPoolResponse?: LoadPoolResponseFn;
  /**
   * Optional lookup for in-memory **device** field overlays (never written to Redis).
   * Applied last so local tweaks win over persisted mock field/date overlays.
   */
  deviceOverlayLookup?: string | ApplyDeviceFieldOverlaysLookup | null;
}

/**
 * Returns response body for a mock hit:
 * 1. Resolve `$pool` refs (when enabled)
 * 2. Field overrides (persisted on mock)
 * 3. Date overrides
 * 4. Device field overlays (in-memory only, when {@link PrepareMockResponseOptions.deviceOverlayLookup} is set)
 *
 * Stored `response.data` is never mutated.
 */
export function prepareMockResponseBody(
  mockData: MockData,
  getNow: () => Date,
  options?: PrepareMockResponseOptions
): unknown {
  let data: unknown = mockData.response.data;

  if (arePoolRefsEnabled() && containsPoolRefs(data)) {
    if (!options?.loadPoolResponse) {
      throw new PoolRefResolveError(
        'Mock response contains $pool refs but no loadPoolResponse was provided'
      );
    }
    data = resolvePoolRefsInData(data, options.loadPoolResponse);
  }

  if (mockData.responseFieldOverrides?.length) {
    data = applyResponseFieldOverridesToData(data, mockData.responseFieldOverrides);
  }

  const dateOverrides = mockData.responseDateOverrides;
  if (dateOverrides?.length) {
    data = applyResponseDateOverridesToData(data, dateOverrides, getNow);
  }

  if (options?.deviceOverlayLookup != null) {
    data = applyDeviceFieldOverlaysToData(data, options.deviceOverlayLookup);
  }

  return data;
}
