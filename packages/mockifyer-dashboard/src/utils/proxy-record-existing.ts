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

/**
 * Whether a failed `/api/proxy` attempt may store a request-only placeholder.
 *
 * `inFlightMock` is the row this request loaded before calling upstream. A parallel
 * request for the same hash can store a full response while this one is still in
 * flight (timeouts finish later). `latestRow` is the store read immediately before
 * the write. Replacing that capture with a placeholder deletes the recorded body.
 */
export function shouldStoreProxyErrorPlaceholder(
  inFlightMock: MockData | null | undefined,
  latestRow: MockData | null | undefined
): boolean {
  if (!shouldWriteNewProxyRecording(inFlightMock)) {
    return false;
  }
  return shouldWriteNewProxyRecording(latestRow ?? inFlightMock);
}
