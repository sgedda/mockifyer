/**
 * Whether `/api/proxy` should run the generic record-on-miss writer after an upstream call.
 *
 * When a live-refresh capture (`refreshOnNextRequest` / `alwaysRefreshFromLive` / refreshable
 * passthrough) already persisted the refreshed mock for this request, a second write would
 * clobber that capture — typically with a request-only placeholder when `recordResponses` is false.
 */
export function shouldWriteProxyRecordOnMiss(
  effectiveRecord: boolean,
  persistedLiveCapture: boolean
): boolean {
  return effectiveRecord === true && !persistedLiveCapture;
}
