import { mockHasCapturableResponse, type MockData } from '@sgedda/mockifyer-core';

/**
 * Whether `/api/proxy` should write a new mock document for this request.
 *
 * Existing snapshots must not be replaced on record-on-miss / auto-record.
 * Rebuilding the document from the live response drops dashboard replay-mode
 * flags (`alwaysUseRealApi`, `alwaysRefreshFromLive`, date overrides).
 * Pending (request-only) mocks still get a first capture.
 */
export function shouldWriteNewProxyRecording(existingMock: MockData | null | undefined): boolean {
  if (!existingMock) return true;
  return !mockHasCapturableResponse(existingMock);
}
