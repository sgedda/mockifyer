import type { MockData } from '../types';

/**
 * When `alwaysUseRealApi` is true on a mock file, Mockifyer must not serve that mock:
 * the HTTP client performs a real request instead. The file remains for reference or
 * for updating when recording.
 */
export function mockPassesThroughToRealApi(mockData: MockData): boolean {
  return mockData.alwaysUseRealApi === true;
}
