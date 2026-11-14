/**
 * Post-record notice: log once per process when a request is recorded.
 * 
 * The first time a request is recorded, logs a concise line explaining:
 * - What was saved
 * - Where it was saved
 * - How to activate it (dashboard or domain-path rules)
 * 
 * Rate-limited to once per process. Disableable via config or env.
 */

let noticeShown = false;

export interface PostRecordNoticeOptions {
  /**
   * Disable the post-record notice entirely.
   * Env: MOCKIFYER_QUIET=1 also disables.
   */
  disableNotice?: boolean;
}

export function shouldShowPostRecordNotice(options?: PostRecordNoticeOptions): boolean {
  if (noticeShown) {
    return false;
  }

  if (options?.disableNotice) {
    return false;
  }

  const quietEnv = process.env.MOCKIFYER_QUIET;
  if (quietEnv === '1' || quietEnv === 'true') {
    return false;
  }

  return true;
}

export function markNoticeShown(): void {
  noticeShown = true;
}

export function resetNoticeForTesting(): void {
  noticeShown = false;
}

export function logPostRecordNotice(params: {
  method: string;
  url: string;
  filePath: string;
  scenario: string;
}): void {
  const { method, url, filePath, scenario } = params;
  
  const scenarioLabel = scenario === '_scratch' ? '_scratch (temporary)' : scenario;
  
  console.log('');
  console.log(`[Mockifyer] Recorded ${method} ${url}`);
  console.log(`  → Saved to: ${filePath}`);
  console.log(`  → Scenario: ${scenarioLabel}`);
  console.log('  → Activate: Open dashboard (npx mockifyer-dashboard) or add domain-path rule');
  console.log('');
  
  markNoticeShown();
}

export function maybeLogPostRecordNotice(
  params: {
    method: string;
    url: string;
    filePath: string;
    scenario: string;
  },
  options?: PostRecordNoticeOptions
): void {
  if (shouldShowPostRecordNotice(options)) {
    logPostRecordNotice(params);
  }
}
