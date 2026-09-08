import type { MockData } from '../types';
import { applyResponseDateOverridesToData } from './mock-response-date-overrides';
import { applyResponseFieldOverridesToData } from './mock-response-field-overrides';
import { applyActiveOverrideGroupOverlays } from './override-group-runtime';
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
   * Scenario-relative mock filename. When set, applies active override-group overlays
   * after mock-level field/date overrides.
   */
  filename?: string;
  /**
   * Absolute scenario path. When set with `filename`, applies override-group overlays
   * scoped to this scenario (prevents race conditions with concurrent multi-scenario requests).
   */
  scenarioPath?: string;
  /**
   * Explicit override group id for this serve (per-lane / header). When omitted, uses the
   * runtime active group for `scenarioPath`.
   */
  overrideGroupId?: string | null;
}

/**
 * Returns response body for a mock hit:
 * 1. Resolve `$pool` refs (when enabled)
 * 2. Mock-level field overrides
 * 3. Mock-level date overrides
 * 4. Active override-group overlays (when `filename` is provided)
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

  return applyActiveOverrideGroupOverlays(
    data,
    options?.filename,
    getNow,
    options?.scenarioPath,
    options?.overrideGroupId
  );
}
