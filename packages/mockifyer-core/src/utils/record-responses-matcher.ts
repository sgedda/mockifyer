import { ENV_VARS } from '../types';

/**
 * Pattern matching for selective `recordResponses`.
 * 
 * - String patterns match host (with wildcard subdomain support) or host+path (glob).
 * - RegExp patterns match the full URL.
 */
export type RecordResponsesPattern = string | RegExp;

/**
 * Parse a string pattern into host and optional path glob.
 * Examples:
 * - `"api.example.com"` → { host: "api.example.com", pathGlob: undefined }
 * - `"*.example.com"` → { host: "*.example.com", pathGlob: undefined }
 * - `"api.example.com/v1/*"` → { host: "api.example.com", pathGlob: "/v1/*" }
 */
function parseStringPattern(pattern: string): { host: string; pathGlob?: string } {
  const trimmed = pattern.trim();
  const slashIdx = trimmed.indexOf('/');
  
  if (slashIdx === -1) {
    return { host: trimmed };
  }
  
  return {
    host: trimmed.substring(0, slashIdx),
    pathGlob: trimmed.substring(slashIdx),
  };
}

/**
 * Check if a host matches a pattern host.
 * Supports wildcard subdomains: `*.example.com` matches `api.example.com`, `staging.example.com`, etc.
 */
function hostMatches(requestHost: string, patternHost: string): boolean {
  if (patternHost === requestHost) {
    return true;
  }
  
  if (patternHost.startsWith('*.')) {
    const baseDomain = patternHost.substring(2);
    return requestHost === baseDomain || requestHost.endsWith(`.${baseDomain}`);
  }
  
  return false;
}

/**
 * Check if a path matches a glob pattern.
 * Supports `*` wildcards: `/v1/*` matches `/v1/users`, `/v1/posts`, etc.
 */
function pathMatchesGlob(requestPath: string, glob: string): boolean {
  const pattern = glob.replace(/\*/g, '.*');
  const regex = new RegExp(`^${pattern}$`);
  return regex.test(requestPath);
}

/**
 * Check if a URL matches a single pattern.
 */
function urlMatchesPattern(url: string, pattern: RecordResponsesPattern): boolean {
  if (pattern instanceof RegExp) {
    return pattern.test(url);
  }
  
  try {
    const parsedUrl = new URL(url);
    const { host, pathGlob } = parseStringPattern(pattern);
    
    if (!hostMatches(parsedUrl.hostname, host)) {
      return false;
    }
    
    if (pathGlob !== undefined) {
      return pathMatchesGlob(parsedUrl.pathname, pathGlob);
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a URL matches any pattern in the allowlist.
 * Returns `true` if at least one pattern matches.
 */
export function urlMatchesRecordResponsesPatterns(
  url: string,
  patterns: Array<RecordResponsesPattern>
): boolean {
  return patterns.some(pattern => urlMatchesPattern(url, pattern));
}

/**
 * Parse comma-separated hosts/patterns from environment variable.
 * Example: `"api.example.com,*.staging.com,auth.example.com/v1/*"`
 */
function parseEnvPatternList(raw: string | undefined): Array<string> | undefined {
  if (!raw || typeof raw !== 'string') {
    return undefined;
  }
  
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  
  return trimmed.split(',').map(s => s.trim()).filter(s => s);
}

/**
 * Resolve effective `recordResponses` from config and environment.
 * 
 * Precedence:
 * 1. Env `MOCKIFYER_RECORD_RESPONSES=true` (global capture-all)
 * 2. Env `MOCKIFYER_RECORD_RESPONSES_FOR=host1,host2` (selective)
 * 3. Config array (selective)
 * 4. Config boolean
 * 5. Default (false)
 * 
 * Returns normalized boolean or pattern array.
 */
export function resolveRecordResponsesConfig(
  configValue: boolean | Array<RecordResponsesPattern> | undefined,
  env: NodeJS.ProcessEnv | undefined = typeof process !== 'undefined' ? process.env : undefined
): boolean | Array<RecordResponsesPattern> {
  if (!env) {
    return typeof configValue === 'boolean' ? configValue : (configValue ?? false);
  }
  
  // 1. Check env boolean override
  const envBoolRaw = env[ENV_VARS.MOCK_RECORD_RESPONSES];
  if (envBoolRaw !== undefined && envBoolRaw !== '') {
    const v = String(envBoolRaw).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(v)) {
      return true;
    }
    if (['0', 'false', 'no', 'off'].includes(v)) {
      return false;
    }
  }
  
  // 2. Check env pattern list
  const envListRaw = env[ENV_VARS.MOCK_RECORD_RESPONSES_FOR];
  const envList = parseEnvPatternList(envListRaw);
  if (envList) {
    return envList;
  }
  
  // 3. Config value (array or boolean)
  if (Array.isArray(configValue)) {
    return configValue;
  }
  
  if (typeof configValue === 'boolean') {
    return configValue;
  }
  
  // 4. Default
  return false;
}

/**
 * Check if a URL should have full response bodies recorded.
 * 
 * @param url - The request URL to check
 * @param configValue - The `recordResponses` config value
 * @param env - Optional environment variables (defaults to process.env)
 * @returns `true` if full response body should be recorded
 */
export function shouldRecordResponseForUrl(
  url: string,
  configValue: boolean | Array<RecordResponsesPattern> | undefined,
  env?: NodeJS.ProcessEnv
): boolean {
  const resolved = resolveRecordResponsesConfig(configValue, env);
  
  if (typeof resolved === 'boolean') {
    return resolved;
  }
  
  // Array of patterns - check if URL matches
  return urlMatchesRecordResponsesPatterns(url, resolved);
}
