/**
 * Pure activation gate for {@link setupMockifyerForReactNative}.
 * Exported for unit tests.
 */
export function shouldActivateMockifyerForReactNative(input: {
  runtimeMode: 'off' | 'on' | 'launch_client' | 'manual';
  hasLaunchClientId: boolean;
  hasLaunchScenario: boolean;
}): boolean {
  if (input.runtimeMode === 'off') {
    return false;
  }
  if (input.runtimeMode === 'on' || input.runtimeMode === 'manual') {
    return true;
  }
  // launch_client
  return input.hasLaunchClientId || input.hasLaunchScenario;
}
