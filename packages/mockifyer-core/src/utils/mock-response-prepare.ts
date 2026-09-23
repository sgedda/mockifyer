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
 * Parse JSON-string response roots the same way field/date overrides do, so
 * `$pool` nodes embedded inside a stringified body are visible to resolve.
 */
function normalizeResponseDataRootForPoolRefs(data: unknown): {
  root: unknown;
  wasJsonString: boolean;
} {
  if (typeof data !== 'string') {
    return { root: data, wasJsonString: false };
  }
  try {
    return { root: JSON.parse(data), wasJsonString: true };
  } catch {
    return { root: data, wasJsonString: false };
  }
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

  if (arePoolRefsEnabled()) {
    const { root, wasJsonString } = normalizeResponseDataRootForPoolRefs(data);
    if (containsPoolRefs(root)) {
      if (!options?.loadPoolResponse) {
        throw new PoolRefResolveError(
          'Mock response contains $pool refs but no loadPoolResponse was provided'
        );
      }
      const resolved = resolvePoolRefsInData(root, options.loadPoolResponse);
      data = wasJsonString ? JSON.stringify(resolved) : resolved;
    }
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
