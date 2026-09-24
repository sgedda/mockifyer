/**
 * Pure activation gate for {@link setupMockifyerForReactNative}.
 * Exported for unit tests.
 *
 * Note: a launch `scenario` does **not** activate by itself under `launch_client`
 * (client id is still required). Scenario only forces the runtime toggle **on**
 * after Mockifyer has already activated.
 */
export function shouldActivateMockifyerForReactNative(input: {
  runtimeMode: 'off' | 'on' | 'launch_client' | 'manual';
  hasLaunchClientId: boolean;
  /** Reserved for callers/docs; does not affect activation under launch_client. */
  hasLaunchScenario?: boolean;
}): boolean {
  if (input.runtimeMode === 'off') {
    return false;
  }
  if (input.runtimeMode === 'on' || input.runtimeMode === 'manual') {
    return true;
  }
  // launch_client — client lane id required (scenario alone is not enough)
  return input.hasLaunchClientId;
}
