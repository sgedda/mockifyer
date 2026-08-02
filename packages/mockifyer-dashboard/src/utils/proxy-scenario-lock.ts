/**
 * Whether proxy should persist a live-captured mock body for the active scenario.
 * Locked scenarios skip store writes (record-on-miss already honors the same lock).
 */
export function shouldPersistProxyLiveCapture(
  shouldPersistLiveCapture: boolean,
  scenarioLocked: boolean
): boolean {
  return shouldPersistLiveCapture === true && scenarioLocked !== true;
}
