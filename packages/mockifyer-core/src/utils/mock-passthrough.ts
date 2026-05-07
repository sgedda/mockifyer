import type { MockData } from '../types';

/**
 * Returns true if a recorded mock should never be served, and instead always
 * pass through to the real upstream API.
 */
export function mockPassesThroughToRealApi(mockData: MockData): boolean {
  return mockData.alwaysUseRealApi === true;
}
