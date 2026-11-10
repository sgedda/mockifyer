/**
 * Pure activation gate for {@link setupMockifyerForReactNative}.
 * Exported for unit tests.
 *
 * Under `launch_client`, either a launch client id **or** a launch `scenario` activates Mockifyer
 * (E2E can pin a scenario without mapping a lane in the dashboard). `off` never activates.
 */
export function shouldActivateMockifyerForReactNative(input: {
  runtimeMode: 'off' | 'on' | 'launch_client' | 'manual';
  hasLaunchClientId: boolean;
  hasLaunchScenario?: boolean;
}): boolean {
  if (input.runtimeMode === 'off') {
    return false;
  }
  if (input.runtimeMode === 'on' || input.runtimeMode === 'manual') {
    return true;
  }
  return input.hasLaunchClientId || input.hasLaunchScenario === true;
}
