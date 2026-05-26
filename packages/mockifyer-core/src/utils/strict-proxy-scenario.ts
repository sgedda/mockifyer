import type { MockifyerConfig } from '../types';
import { ENV_VARS } from '../types';

/** True when MOCKIFYER_STRICT_SCENARIO implies strict proxy scenario gating at the SDK. */
export function resolveStrictScenarioResolutionFromEnv(
  env: Record<string, string | undefined> | undefined
): boolean | undefined {
  if (!env) return undefined;
  const raw = env[ENV_VARS.MOCK_STRICT_SCENARIO];
  if (raw === undefined || raw === '') return undefined;
  const v = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return undefined;
}

/**
 * Strict proxy scenario: when Mockifyer routes through the dashboard proxy (Redis mode), require an explicit lane
 * or an app-level scenario override (`proxy.scenario`) before intercepting. Otherwise skip Mockifyer (plain HTTP passthrough).
 *
 * Activation is gated by **`strictScenarioResolution: true`** in config or **`MOCKIFYER_STRICT_SCENARIO=true`** env.
 *
 * Intended for teams that rely on **`client_scenario:{clientId}`** in Redis and do not want traffic without a mapped lane.
 */
export function resolveStrictScenarioResolution(config: Pick<MockifyerConfig, 'strictScenarioResolution'>): boolean {
  const fromEnv = resolveStrictScenarioResolutionFromEnv(typeof process !== 'undefined' ? process.env : undefined);
  if (fromEnv !== undefined) return fromEnv;
  return config.strictScenarioResolution === true;
}

/**
 * When strict resolution is enabled and `proxy.baseUrl` is set, returns false unless `clientId` or `proxy.scenario` is set.
 *
 * RN / fetch: **`clientId`** is the resolved lane after launch args (see setup flow).
 */
export function isExplicitProxyScenarioContext(
  config: Pick<MockifyerConfig, 'strictScenarioResolution' | 'proxy' | 'clientId'>
): boolean {
  if (!resolveStrictScenarioResolution(config)) return true;
  const baseUrl = config.proxy?.baseUrl;
  if (!baseUrl || typeof baseUrl !== 'string' || baseUrl.trim() === '') return true;

  const lane = typeof config.clientId === 'string' ? config.clientId.trim() : '';
  const proxyScenario =
    typeof config.proxy?.scenario === 'string' ? config.proxy.scenario.trim() : '';
  return Boolean(lane) || Boolean(proxyScenario);
}

/**
 * When strict scenario resolution is on and {@link MockifyerConfig.intendedProxyBaseUrl} is set,
 * local mock saves (filesystem, hybrid, Metro) must not run — recording belongs on the dashboard proxy only.
 */
export function shouldBlockLocalMockRecording(
  config: Pick<MockifyerConfig, 'strictScenarioResolution' | 'intendedProxyBaseUrl'>
): boolean {
  if (!resolveStrictScenarioResolution(config)) return false;
  return Boolean(config.intendedProxyBaseUrl?.trim());
}
