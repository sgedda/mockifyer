import { logger } from './logger';

/**
 * Track which hosts have already received a request-only stub warning (one warning per host per process).
 */
const warnedHosts = new Set<string>();

/**
 * Reset the warning state (for testing).
 * @internal
 */
export function resetRequestOnlyWarnings(): void {
  warnedHosts.clear();
}

/**
 * Extract host from a URL for warning deduplication.
 */
function extractHost(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}

/**
 * Log a warning the first time a request-only stub is saved for a given host.
 * Explains that no response body was recorded and how to opt in.
 * 
 * @param url - The request URL
 * @param recordResponsesConfigExample - Example config snippet to show the user
 */
export function warnRequestOnlyStub(url: string, recordResponsesConfigExample?: string): void {
  const host = extractHost(url);
  if (!host || warnedHosts.has(host)) {
    return;
  }
  
  warnedHosts.add(host);
  
  const example = recordResponsesConfigExample ?? `['${host}']`;
  
  logger.warn(
    `[Mockifyer] ⚠️  Request-only stub saved for ${host} — no response body recorded.\n` +
    `  The request will continue hitting the live API until you activate the mock.\n` +
    `  To record full responses for this host, set:\n` +
    `    recordResponses: ${example}\n` +
    `  Or use the dashboard to activate replay after recording.`
  );
}

/**
 * Warn at setup time if recording is enabled but no interception will happen.
 * This catches the common mistake of enabling `recordMode` without `useGlobalFetch` or `useGlobalAxios`.
 * 
 * @param recordMode - Whether recording is enabled
 * @param useGlobalFetch - Whether global fetch is patched
 * @param useGlobalAxios - Whether global axios is patched
 * @param hasProxy - Whether dashboard proxy is configured
 * @param clientType - 'fetch' or 'axios' for the warning message
 */
export function warnSetupWithoutInterception(
  recordMode: boolean,
  useGlobalFetch: boolean | undefined,
  useGlobalAxios: boolean | undefined,
  hasProxy: boolean,
  clientType: 'fetch' | 'axios'
): void {
  if (!recordMode) {
    return;
  }
  
  // If using proxy, warnings don't apply (proxy intercepts everything)
  if (hasProxy) {
    return;
  }
  
  // Check if any interception is configured
  const hasInterception = useGlobalFetch === true || useGlobalAxios === true;
  
  if (hasInterception) {
    return;
  }
  
  // Recording is on but no interception configured
  const setupFlagName = clientType === 'fetch' ? 'useGlobalFetch' : 'useGlobalAxios';
  
  logger.warn(
    `[Mockifyer] ⚠️  Recording is enabled but ${setupFlagName} is not set.\n` +
    `  No requests will be intercepted or recorded.\n` +
    `  To fix: set ${setupFlagName}: true in setupMockifyer(), or use the returned\n` +
    `  wrapped ${clientType} instance for your API calls.`
  );
}
