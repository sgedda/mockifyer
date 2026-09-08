import type { MockData } from '../types';
import { applyResponseDateOverridesToData } from './mock-response-date-overrides';
import { applyResponseFieldOverridesToData } from './mock-response-field-overrides';
import {
  arePoolRefsEnabled,
  containsPoolRefs,
  PoolRefResolveError,
  resolvePoolRefsInData,
  type LoadPoolResponseFn,
} from './fixture-pool/resolve-pool-refs';
import { applyActiveAtlasPackToData } from './atlas-pack-runtime';

export interface PrepareMockResponseOptions {
  /**
   * Load a promoted pool response by id. Required when `response.data` contains `$pool`
   * refs and pool refs are enabled (`MOCKIFYER_POOL_REFS` not `false`).
   */
  loadPoolResponse?: LoadPoolResponseFn;
  /** Request body for Atlas pack operation matching (GraphQL operationName). */
  requestBody?: unknown;
  /** Atlas datasource id for pack overlay matching. */
  datasourceId?: string | null;
  /** Skip active Atlas pack overlays (default false). */
  skipAtlasPack?: boolean;
}

/**
 * Returns response body for a mock hit:
 * 1. Resolve `$pool` refs (when enabled)
 * 2. Field overrides
 * 3. Date overrides
 * 4. Active Atlas pack overlays (select + pins + field/date)
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

  if (options?.skipAtlasPack === true) {
    return data;
  }

  return applyActiveAtlasPackToData(data, {
    requestBody: options?.requestBody ?? mockData.request?.data,
    datasourceId: options?.datasourceId,
    getNow,
  }).data;
}
