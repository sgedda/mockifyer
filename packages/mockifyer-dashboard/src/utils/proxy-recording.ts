export function shouldWriteProxyRecordOnMiss(
  effectiveRecord: boolean,
  persistedLiveCapture: boolean
): boolean {
  return effectiveRecord === true && !persistedLiveCapture;
}
