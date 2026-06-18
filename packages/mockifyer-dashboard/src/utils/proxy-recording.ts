/**
 * The proxy can persist a live upstream response through either a replay-mode refresh
 * of an existing mock or the generic record-on-miss path. When refresh persistence
 * has already written the mock, the later record write would rebuild the mock shell
 * and drop replay metadata/overrides.
 */
export function shouldRunProxyRecordWrite(
  effectiveRecord: boolean,
  liveCapturePersisted: boolean
): boolean {
  return effectiveRecord && !liveCapturePersisted;
}
