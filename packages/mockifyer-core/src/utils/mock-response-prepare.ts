import type { MockData } from '../types';
import { applyResponseDateOverridesToData } from './mock-response-date-overrides';
import { applyResponseFieldOverridesToData } from './mock-response-field-overrides';

/**
 * Returns response body for a mock hit: field overrides first, then date overrides.
 * Stored `response.data` is never mutated.
 */
export function prepareMockResponseBody(mockData: MockData, getNow: () => Date): unknown {
  let data = mockData.response.data;

  if (mockData.responseFieldOverrides?.length) {
    data = applyResponseFieldOverridesToData(data, mockData.responseFieldOverrides);
  }

  const dateOverrides = mockData.responseDateOverrides;
  if (!dateOverrides?.length) {
    if (mockData.responseFieldOverrides?.length) {
      return data;
    }
    return mockData.response.data;
  }

  return applyResponseDateOverridesToData(data, dateOverrides, getNow);
}
