/**
 * Web-specific client ID resolution.
 * 
 * Adds support for:
 * - EXPO_PUBLIC_MOCKIFYER_CLIENT_ID (Expo public env var, embedded in web bundle)
 * - URL query parameter: ?mockifyerClientId=your-lane
 * - localStorage persistence
 * 
 * Precedence:
 * 1) MOCKIFYER_CLIENT_ID env var (build-time, if available)
 * 2) EXPO_PUBLIC_MOCKIFYER_CLIENT_ID env var (Expo web builds)
 * 3) URL query parameter ?mockifyerClientId=... (runtime override)
 * 4) localStorage 'mockifyer-client-id' (persistent across sessions)
 * 5) config.clientId
 * 6) Fallback based on build metadata (MOCKIFYER_CLIENT_LANE or computed)
 */

import type { MockifyerConfig } from '../types';
import { ENV_VARS } from '../types';

function sanitizeSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function firstNonEmpty(...values: Array<string | undefined | null>): string | undefined {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

/**
 * Read client ID from URL query parameter.
 * Supports: ?mockifyerClientId=your-lane
 */
function getClientIdFromUrl(): string | undefined {
  if (typeof window === 'undefined' || !window.location) return undefined;
  
  try {
    const params = new URLSearchParams(window.location.search);
    const value = params.get('mockifyerClientId');
    return value?.trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Read client ID from localStorage.
 * Key: 'mockifyer-client-id'
 */
function getClientIdFromLocalStorage(): string | undefined {
  if (typeof window === 'undefined' || !window.localStorage) return undefined;
  
  try {
    const value = window.localStorage.getItem('mockifyer-client-id');
    return value?.trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Save client ID to localStorage for persistence.
 */
export function saveClientIdToLocalStorage(clientId: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  
  try {
    window.localStorage.setItem('mockifyer-client-id', clientId);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Lane id only when set via explicit sources (no build-metadata fallback).
 * Used with strict dashboard proxy so traffic stays direct until the app selects a lane.
 */
export function resolveExplicitClientIdOnly(
  config: Pick<MockifyerConfig, 'clientId'>
): string | undefined {
  // Check build-time env vars (may not be available in browser)
  const env = typeof process !== 'undefined' ? process.env : undefined;
  const mockifyerClientId = env?.[ENV_VARS.MOCK_CLIENT_ID];
  
  // Check Expo public env var (embedded in web bundle at build time)
  const expoPublicClientId = typeof process !== 'undefined' 
    ? process.env.EXPO_PUBLIC_MOCKIFYER_CLIENT_ID 
    : undefined;
  
  // Check URL query parameter
  const urlClientId = getClientIdFromUrl();
  
  // Check localStorage
  const storedClientId = getClientIdFromLocalStorage();
  
  return firstNonEmpty(
    mockifyerClientId,
    expoPublicClientId,
    urlClientId,
    storedClientId,
    config.clientId
  );
}

/**
 * Resolve the logical client lane id for web builds.
 *
 * Precedence:
 * 1) `MOCKIFYER_CLIENT_ID` env var
 * 2) `EXPO_PUBLIC_MOCKIFYER_CLIENT_ID` env var (Expo web builds)
 * 3) URL query parameter ?mockifyerClientId=...
 * 4) localStorage 'mockifyer-client-id'
 * 5) `config.clientId`
 * 6) deterministic fallback based on env-provided build metadata
 *
 * This intentionally does NOT generate per-device UUIDs or write dotfiles.
 */
export function resolveClientId(config: MockifyerConfig): string {
  const env = typeof process !== 'undefined' ? process.env : (undefined as any);

  // Check explicit sources first
  const mockifyerClientId = env?.[ENV_VARS.MOCK_CLIENT_ID];
  const expoPublicClientId = env?.EXPO_PUBLIC_MOCKIFYER_CLIENT_ID;
  const urlClientId = getClientIdFromUrl();
  const storedClientId = getClientIdFromLocalStorage();
  
  const explicit = firstNonEmpty(
    mockifyerClientId,
    expoPublicClientId,
    urlClientId,
    storedClientId,
    config.clientId
  );
  
  if (explicit) {
    // Persist URL param to localStorage for future sessions
    if (urlClientId && urlClientId === explicit) {
      saveClientIdToLocalStorage(urlClientId);
    }
    return explicit;
  }

  // Fallback to precomputed lane or build metadata
  const precomputedLane = firstNonEmpty(env?.MOCKIFYER_CLIENT_LANE);
  if (precomputedLane) {
    return precomputedLane;
  }

  const applicationId = firstNonEmpty(env?.MOCKIFYER_APPLICATION_ID, env?.APP_ID, env?.APPLICATION_ID) ?? 'app';
  const market = firstNonEmpty(env?.MOCKIFYER_MARKET, env?.MARKET) ?? 'default';
  const versionName = firstNonEmpty(env?.MOCKIFYER_VERSION_NAME, env?.VERSION_NAME, env?.APP_VERSION) ?? '0.0.0';
  const versionCode = firstNonEmpty(env?.MOCKIFYER_VERSION_CODE, env?.VERSION_CODE, env?.BUILD_NUMBER) ?? '0';

  const out = [
    sanitizeSegment(applicationId),
    sanitizeSegment(market),
    sanitizeSegment(versionName),
    sanitizeSegment(versionCode),
  ]
    .filter(Boolean)
    .join('-');

  return out || 'default';
}
