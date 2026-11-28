/**
 * Browser / Metro stub for atlas-doc-html.
 *
 * Metro remaps `./dist/utils/atlas-doc-html.js` → this stub via the package.json
 * `"browser"` field (Expo web and React Native). The real module is RN-safe
 * (try/catch around `fs`/`path`) but the remap still applies on device, so this
 * stub must export every function the real module exports — especially
 * `setAtlasDocHtmlOutputPath`, which `configureAtlas` calls unconditionally.
 */

export function buildAtlasBodiesSearchCorpus(
  _events: readonly unknown[],
  _options?: { readSpillText?: (relativePath: string) => string | undefined }
): Record<string, string> {
  return {};
}

export function setAtlasDocHtmlOutputPath(_dir: string | undefined): void {
  // Browser stub: ignore HTML output path
}

export function getAtlasDocHtmlOutputPath(): string | undefined {
  return undefined;
}

export function rememberAtlasHtmlNetworkEvent(_event: unknown): void {
  // Browser stub: no hop buffer
}

export function getAtlasHtmlNetworkEvents(): readonly unknown[] {
  return [];
}

export function clearAtlasHtmlNetworkEvents(): void {
  // Browser stub: nothing to clear
}

export function resetAtlasDocHtmlRuntime(): void {
  // Browser stub: nothing to reset
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function safeAtlasPageFileId(pageId: string): string {
  return String(pageId || 'page').replace(/[^a-zA-Z0-9._-]+/g, '_');
}

export function buildCrashIncidentHtml(_map: unknown, _input: unknown): string {
  return '<!DOCTYPE html><html><body>Atlas HTML requires Node.js</body></html>';
}

export function writeCrashIncidentHtmlFile(
  _map: unknown,
  _input: unknown
): string | undefined {
  return undefined;
}

export function buildAtlasDocHtmlFiles(_map: unknown): Record<string, string> {
  return {};
}

export function writeAtlasDocHtml(_map: unknown): string[] {
  return [];
}

export function scheduleAtlasDocHtmlRewrite(_map: unknown): void {
  // Browser stub: no rewrite
}

export function flushAtlasDocHtmlRewrite(): void {
  // Browser stub: no rewrite
}

/** Soft cap constant re-exported for callers that import it from this module. */
export const BODY_SEARCH_MAX_CHARS_PER_HOP = 512_000;
