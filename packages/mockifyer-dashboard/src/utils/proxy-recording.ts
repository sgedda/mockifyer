export interface ProxyRecordingWriteDecision {
  effectiveRecord: boolean;
  shouldPersistLiveCapture: boolean;
}

/**
 * The proxy may persist live-capture updates for an existing mock before considering
 * record-on-miss. A second recording write would clobber refresh metadata.
 */
export function shouldWriteProxyRecordingAfterUpstream(
  decision: ProxyRecordingWriteDecision
): boolean {
  return decision.effectiveRecord === true && decision.shouldPersistLiveCapture !== true;
}
