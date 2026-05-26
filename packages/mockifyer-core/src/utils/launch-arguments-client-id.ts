import { logger } from './logger';

const DEFAULT_LAUNCH_KEY = 'mockifyerClientId';

/**
 * Reads Mockifyer client lane id (`clientId`) from Maestro / XCTest / native launch arguments.
 * Uses optional peer `react-native-launch-arguments` when installed; otherwise returns `undefined`.
 *
 * Intended for E2E: pass `arguments.mockifyerClientId` (or a custom key) from Maestro `launchApp`,
 * keep scenario controlled via Redis / dashboard for the same lane.
 *
 * @see https://docs.maestro.dev/api-reference/commands/launchapp
 */
export function tryGetClientIdFromLaunchArguments(
  key: string = DEFAULT_LAUNCH_KEY
): string | undefined {
  const trimmedKey = typeof key === 'string' ? key.trim() : '';
  if (!trimmedKey) {
    return undefined;
  }

  try {
    // Optional peer — not a hard dependency so Node/tests work without RN.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(/* webpackIgnore: true */ 'react-native-launch-arguments') as {
      LaunchArguments?: { value: () => Record<string, unknown> };
    };
    const LaunchArguments = mod?.LaunchArguments;
    if (!LaunchArguments || typeof LaunchArguments.value !== 'function') {
      return undefined;
    }

    const raw = LaunchArguments.value() as Record<string, unknown>;
    const v = raw?.[trimmedKey];
    if (typeof v === 'string' && v.trim()) {
      return v.trim();
    }
    return undefined;
  } catch (error) {
    logger.debug(
      '[Mockifyer] tryGetClientIdFromLaunchArguments: optional module missing or error',
      error
    );
    return undefined;
  }
}

export { DEFAULT_LAUNCH_KEY as MOCKIFYER_LAUNCH_ARGUMENT_CLIENT_ID_KEY };
