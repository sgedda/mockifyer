import { logger } from './logger';

/** Default launch-argument key for E2E scenario override (`LaunchArguments.value().scenario`). */
export const MOCKIFYER_LAUNCH_ARGUMENT_SCENARIO_KEY = 'scenario';

/**
 * Reads scenario from Maestro / native launch arguments (optional peer `react-native-launch-arguments`).
 * Returns `undefined` when the package is missing or the key is empty.
 */
export function tryGetScenarioFromLaunchArguments(
  key: string = MOCKIFYER_LAUNCH_ARGUMENT_SCENARIO_KEY
): string | undefined {
  const trimmedKey = typeof key === 'string' ? key.trim() : '';
  if (!trimmedKey) {
    return undefined;
  }

  try {
    // Optional peer — not a hard dependency so Node/tests work without RN.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(/* webpackIgnore: true */ 'react-native-launch-arguments') as {
      LaunchArguments?: { value?: () => Record<string, unknown> };
    };
    const LaunchArguments = mod?.LaunchArguments;
    if (!LaunchArguments || typeof LaunchArguments.value !== 'function') {
      return undefined;
    }

    const raw = LaunchArguments.value() as Record<string, unknown>;
    const v = raw?.[trimmedKey];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return String(v).trim();
    }
    return undefined;
  } catch (error) {
    logger.debug(
      '[Mockifyer] tryGetScenarioFromLaunchArguments: optional module missing or error',
      error
    );
    return undefined;
  }
}
