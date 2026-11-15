/**
 * Authentication detection for Atlas endpoints.
 * Detects auth from static code and traffic, with proper redaction (never stores secrets).
 */

import type { NetworkEvent } from './network-event-types';
import type { ScannedEndpoint } from './atlas-code-scanner';
import { normalizeUrlToTemplate } from './atlas-url-normalizer';
import { extractHost } from './atlas-endpoint-inventory';

export type AuthScheme = 'none' | 'bearer' | 'api-key' | 'basic' | 'cookie' | 'oauth' | 'unknown';

export interface AuthSource {
  /** Where the auth value comes from */
  sourceType: 'env' | 'const' | 'function' | 'config' | 'interceptor' | 'unknown';
  /** Name of env var, function, or config key (not the value!) */
  identifier?: string;
  /** File and line where auth is configured */
  location?: { file: string; line: number };
}

export interface EndpointAuthInfo {
  scheme: AuthScheme;
  /** Static sources found in code */
  staticSources: AuthSource[];
  /** Observed in traffic (presence only, no values) */
  observedInTraffic: boolean;
  /** 401/403 errors seen */
  authFailures: number;
  /** WWW-Authenticate header schemes seen */
  challengeSchemes: string[];
  /** Token/login endpoint detected before this endpoint */
  precededByAuthFlow: boolean;
}

export interface HostAuthSummary {
  host: string;
  primaryScheme: AuthScheme;
  schemes: AuthScheme[];
  authSources: AuthSource[];
  requiresAuth: boolean;
}

/**
 * Common auth header patterns (case-insensitive).
 */
const AUTH_HEADER_PATTERNS = {
  bearer: /^authorization$/i,
  apiKey: /^(x-api-key|api-key|apikey|x-rapidapi-key)$/i,
  basic: /^authorization$/i, // Will check value for "Basic"
  cookie: /^cookie$/i,
  oauth: /^authorization$/i, // Will check value for "OAuth"
};

/**
 * Query param patterns for API keys.
 */
const API_KEY_QUERY_PARAMS = /^(api[-_]?key|apikey|key|token|access[-_]?token)$/i;

/**
 * Environment variable patterns for auth.
 */
const AUTH_ENV_PATTERNS = /^([A-Z_]*)(API[-_]?KEY|TOKEN|SECRET|AUTH|PASSWORD|BEARER)([A-Z_]*)$/i;

/**
 * Redact a secret value to show only scheme + source type.
 */
export function redactAuthValue(value: string): string {
  if (!value) return '[empty]';
  
  // Never return the actual value
  if (value.toLowerCase().startsWith('bearer ')) {
    return 'Bearer [redacted]';
  }
  if (value.toLowerCase().startsWith('basic ')) {
    return 'Basic [redacted]';
  }
  if (value.toLowerCase().startsWith('oauth ')) {
    return 'OAuth [redacted]';
  }
  
  // For other values, show first 4 chars if it looks like a key
  if (value.length > 20) {
    return `${value.slice(0, 4)}...[redacted]`;
  }
  
  return '[redacted]';
}

/**
 * Detect auth scheme from header name and value (redacted).
 */
function detectSchemeFromHeader(headerName: string, headerValue: string): AuthScheme {
  const lowerName = headerName.toLowerCase();
  const lowerValue = headerValue.toLowerCase();
  
  if (lowerName === 'authorization') {
    if (lowerValue.startsWith('bearer ')) return 'bearer';
    if (lowerValue.startsWith('basic ')) return 'basic';
    if (lowerValue.startsWith('oauth ')) return 'oauth';
    return 'unknown';
  }
  
  if (AUTH_HEADER_PATTERNS.apiKey.test(headerName)) {
    return 'api-key';
  }
  
  if (lowerName === 'cookie') {
    return 'cookie';
  }
  
  return 'unknown';
}

/**
 * Detect authentication from network traffic.
 */
export function detectAuthFromTraffic(events: NetworkEvent[]): Map<string, EndpointAuthInfo> {
  const authByEndpoint = new Map<string, EndpointAuthInfo>();
  
  // Group events by composite key (host::method::template) for consistent lookup
  const eventsByKey = new Map<string, NetworkEvent[]>();
  for (const event of events) {
    if (!event.url) continue;
    const host = extractHost(event.url);
    const normalized = normalizeUrlToTemplate(event.url);
    const method = event.method?.toUpperCase() || 'GET';
    const key = `${host}::${method}::${normalized.template}`;
    if (!eventsByKey.has(key)) {
      eventsByKey.set(key, []);
    }
    eventsByKey.get(key)!.push(event);
  }
  
  // Detect potential auth/login endpoints
  const authEndpoints = new Set<string>();
  for (const [key, keyEvents] of eventsByKey.entries()) {
    // Check if any URL in this group matches auth patterns
    const hasAuthUrl = keyEvents.some(e => e.url && e.url.match(/\/(auth|login|token|oauth|signin|session)/i));
    if (hasAuthUrl) {
      authEndpoints.add(key);
    }
  }
  
  for (const [key, keyEvents] of eventsByKey.entries()) {
    const schemes = new Set<AuthScheme>();
    let authFailures = 0;
    const challengeSchemes = new Set<string>();
    let precededByAuthFlow = false;
    
    for (const event of keyEvents) {
      // Check request headers for auth
      if (event.requestHeaders) {
        for (const [headerName, headerValue] of Object.entries(event.requestHeaders)) {
          const scheme = detectSchemeFromHeader(headerName, headerValue);
          if (scheme !== 'unknown') {
            schemes.add(scheme);
          }
        }
      }
      
      // Check for auth failures
      if (event.status === 401 || event.status === 403) {
        authFailures++;
        
        // Check WWW-Authenticate response header
        if (event.responseHeaders?.['www-authenticate']) {
          const wwwAuth = event.responseHeaders['www-authenticate'].toLowerCase();
          if (wwwAuth.includes('bearer')) challengeSchemes.add('bearer');
          if (wwwAuth.includes('basic')) challengeSchemes.add('basic');
          if (wwwAuth.includes('oauth')) challengeSchemes.add('oauth');
        }
      }
      
      // Check if preceded by auth endpoint
      if (event.parentRequestId && events.some(e => 
        e.requestId === event.parentRequestId && 
        e.url && 
        authEndpoints.has(e.url)
      )) {
        precededByAuthFlow = true;
      }
    }
    
    // Determine primary scheme
    let primaryScheme: AuthScheme = 'none';
    if (schemes.size > 0) {
      // Prefer bearer, then api-key, then others
      if (schemes.has('bearer')) primaryScheme = 'bearer';
      else if (schemes.has('api-key')) primaryScheme = 'api-key';
      else if (schemes.has('basic')) primaryScheme = 'basic';
      else if (schemes.has('cookie')) primaryScheme = 'cookie';
      else primaryScheme = Array.from(schemes)[0];
    } else if (authFailures > 0 || challengeSchemes.size > 0) {
      primaryScheme = 'unknown';
    }
    
    authByEndpoint.set(key, {
      scheme: primaryScheme,
      staticSources: [],
      observedInTraffic: schemes.size > 0,
      authFailures,
      challengeSchemes: Array.from(challengeSchemes),
      precededByAuthFlow
    });
  }
  
  return authByEndpoint;
}

/**
 * Detect authentication from static code analysis.
 * Returns auth sources found in code (never actual values).
 */
export function detectAuthFromCode(
  endpoint: ScannedEndpoint,
  sourceCode: string,
  envVars?: Record<string, string>
): AuthSource[] {
  const sources: AuthSource[] = [];
  const lines = sourceCode.split('\n');
  const endpointLine = Math.max(0, endpoint.line - 1);
  
  // Look at surrounding context (20 lines before the call)
  const contextStart = Math.max(0, endpointLine - 20);
  const contextEnd = Math.min(lines.length, endpointLine + 5);
  const context = lines.slice(contextStart, contextEnd).join('\n');
  
  // Check for headers in axios config - need to handle nested braces
  const headersMatches = context.matchAll(/headers\s*:\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gs);
  for (const headersMatch of headersMatches) {
    const headersBlock = headersMatch[1];
    
    // Authorization header with env var
    const authEnvMatches = headersBlock.matchAll(/['"]?authorization['"]?\s*:\s*.*?process\.env\.([A-Z_0-9]+)/gi);
    for (const match of authEnvMatches) {
      sources.push({
        sourceType: 'env',
        identifier: match[1],
        location: { file: endpoint.filePath, line: endpointLine + 1 }
      });
    }
    
    // Bearer token pattern (even without env var)
    if (headersBlock.match(/['"]?authorization['"]?\s*:.*?Bearer/i)) {
      const envMatch = headersBlock.match(/Bearer.*?process\.env\.([A-Z_0-9]+)/i);
      if (envMatch && !sources.some(s => s.identifier === envMatch[1])) {
        sources.push({
          sourceType: 'env',
          identifier: envMatch[1],
          location: { file: endpoint.filePath, line: endpointLine + 1 }
        });
      } else if (!sources.some(s => s.sourceType === 'const')) {
        sources.push({
          sourceType: 'const',
          identifier: 'Bearer token',
          location: { file: endpoint.filePath, line: endpointLine + 1 }
        });
      }
    }
    
    // API key headers with env vars
    for (const headerPattern of ['x-api-key', 'x-rapidapi-key', 'api-key', 'apikey']) {
      const regex = new RegExp(`['"]?${headerPattern}['"]?\\s*:.*?process\\.env\\.([A-Z_0-9]+)`, 'gi');
      const matches = headersBlock.matchAll(regex);
      for (const match of matches) {
        if (!sources.some(s => s.identifier === match[1])) {
          sources.push({
            sourceType: 'env',
            identifier: match[1],
            location: { file: endpoint.filePath, line: endpointLine + 1 }
          });
        }
      }
    }
  }
  
  // Check for credentials: 'include'
  if (context.match(/credentials\s*:\s*['"]include['"]/)) {
    sources.push({
      sourceType: 'config',
      identifier: 'credentials: include',
      location: { file: endpoint.filePath, line: endpointLine + 1 }
    });
  }
  
  // Check for API key in query params
  const urlMatch = context.match(/\?.*?(api[-_]?key|apikey|key|token)/i);
  if (urlMatch) {
    sources.push({
      sourceType: 'config',
      identifier: 'API key query param',
      location: { file: endpoint.filePath, line: endpointLine + 1 }
    });
  }
  
  return sources;
}

/**
 * Merge auth info from traffic and code.
 */
export function mergeAuthInfo(
  trafficAuth: EndpointAuthInfo,
  staticSources: AuthSource[]
): EndpointAuthInfo {
  return {
    ...trafficAuth,
    staticSources: [...trafficAuth.staticSources, ...staticSources]
  };
}

/**
 * Generate host-level auth summary.
 */
export function generateHostAuthSummary(
  host: string,
  endpoints: Array<{ auth: EndpointAuthInfo }>
): HostAuthSummary {
  const allSchemes = new Set<AuthScheme>();
  const allSources: AuthSource[] = [];
  
  for (const endpoint of endpoints) {
    if (endpoint.auth.scheme !== 'none') {
      allSchemes.add(endpoint.auth.scheme);
    }
    allSources.push(...endpoint.auth.staticSources);
  }
  
  // Determine primary scheme
  let primaryScheme: AuthScheme = 'none';
  if (allSchemes.has('bearer')) primaryScheme = 'bearer';
  else if (allSchemes.has('api-key')) primaryScheme = 'api-key';
  else if (allSchemes.has('basic')) primaryScheme = 'basic';
  else if (allSchemes.has('cookie')) primaryScheme = 'cookie';
  else if (allSchemes.size > 0) primaryScheme = Array.from(allSchemes)[0];
  
  return {
    host,
    primaryScheme,
    schemes: Array.from(allSchemes),
    authSources: allSources,
    requiresAuth: allSchemes.size > 0 && primaryScheme !== 'none'
  };
}

/**
 * Generate OpenAPI securitySchemes from auth info.
 */
export function generateSecuritySchemes(hostAuthSummaries: HostAuthSummary[]): Record<string, unknown> {
  const schemes: Record<string, unknown> = {};
  
  for (const summary of hostAuthSummaries) {
    if (!summary.requiresAuth) continue;
    
    const hostKey = summary.host.replace(/[^a-zA-Z0-9]/g, '_');
    
    if (summary.schemes.includes('bearer')) {
      schemes[`${hostKey}_bearer`] = {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      };
    }
    
    if (summary.schemes.includes('api-key')) {
      // Try to determine if header or query
      const hasHeaderSource = summary.authSources.some(s => 
        s.identifier?.toLowerCase().includes('header') ||
        s.identifier?.toLowerCase().includes('x-api-key')
      );
      
      schemes[`${hostKey}_apiKey`] = {
        type: 'apiKey',
        in: hasHeaderSource ? 'header' : 'query',
        name: hasHeaderSource ? 'X-API-Key' : 'api_key'
      };
    }
    
    if (summary.schemes.includes('basic')) {
      schemes[`${hostKey}_basic`] = {
        type: 'http',
        scheme: 'basic'
      };
    }
    
    if (summary.schemes.includes('cookie')) {
      schemes[`${hostKey}_cookie`] = {
        type: 'apiKey',
        in: 'cookie',
        name: 'sessionid'
      };
    }
  }
  
  return schemes;
}
