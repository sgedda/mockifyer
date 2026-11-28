/**
 * Browser / Metro stub for network-body-spill.
 *
 * Metro remaps `./dist/utils/network-body-spill.js` → this stub via the
 * package.json `"browser"` field. `configureAtlas` calls
 * `setNetworkBodySpillEnabled` unconditionally, so that export (and the rest of
 * the real module’s function surface) must exist here as no-ops.
 */

export const NETWORK_LOG_INLINE_BODY_PREVIEW_BYTES = 512_000;
export const NETWORK_BODY_SPILL_MAX_BYTES = 2_000_000;

export interface NetworkBodySpillRefs {
  requestBodyRef?: string;
  responseBodyRef?: string;
  requestBodyTruncated?: boolean;
  responseBodyTruncated?: boolean;
}

export interface ScheduleNetworkBodySpillInput {
  eventId: string;
  requestId?: string | null;
  requestBodyText?: string;
  responseBodyText?: string;
  outputDir?: string;
  metroPort?: number;
  metroBaseUrl?: string;
}

export function setNetworkBodySpillEnabled(_enabled: boolean): void {
  // Browser stub: spill disabled
}

export function isNetworkBodySpillEnabled(): boolean {
  return false;
}

export function getNetworkBodySpillSnapshot(): Record<string, string> {
  return {};
}

export function resetNetworkBodySpillRuntime(): void {
  // Browser stub: nothing to reset
}

export function serializeBodyText(_value: unknown): string | undefined {
  return undefined;
}

export function serializeBodyForSpill(_value: unknown): string | undefined {
  return undefined;
}

export function safeSpillKey(eventId: string, requestId?: string | null): string {
  const id = String(eventId || 'event').replace(/[^a-zA-Z0-9._-]+/g, '_');
  const req = requestId ? String(requestId).replace(/[^a-zA-Z0-9._-]+/g, '_') : '';
  return req ? `${id}_${req}` : id;
}

export function networkBodySpillRelPath(
  eventId: string,
  side: 'request' | 'response',
  requestId?: string | null
): string {
  return `bodies/${safeSpillKey(eventId, requestId)}_${side}.txt`;
}

export function resolveNetworkEventBodyRelPaths(_event: {
  id?: string;
  requestId?: string | null;
  requestBodyRef?: string;
  responseBodyRef?: string;
}): NetworkBodySpillRefs {
  return {};
}

export function flushNetworkBodySpillsToDir(_atlasHtmlDir: string): number {
  return 0;
}

export function bufferNetworkBodySpill(
  _relativePath: string,
  _text: string
): string | undefined {
  return undefined;
}

export function writeNetworkBodySpillMap(
  _atlasHtmlDir: string,
  _map?: Record<string, string>
): number {
  return 0;
}

export function scheduleNetworkBodySpill(
  _input: ScheduleNetworkBodySpillInput
): NetworkBodySpillRefs {
  return {};
}
