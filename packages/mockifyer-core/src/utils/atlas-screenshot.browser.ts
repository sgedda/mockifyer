/**
 * Browser / Metro stub for atlas-screenshot.
 *
 * Metro (Expo web and React Native) applies the package.json `"browser"` field
 * remap of `./dist/utils/atlas-screenshot.js` → this stub. The real module is
 * Node/RN-capable (fs + Metro upload). This stub must export every function the
 * real module exports so `configureAtlas` and Atlas callers do not throw
 * `undefined is not a function` when the remap is active.
 *
 * Screenshot capture is a no-op here (no fs / no capturer pipeline).
 */

export interface AtlasScreenshotCaptureResult {
  data?: Uint8Array | Buffer;
  base64?: string;
  tmpUri?: string;
  platform?: 'web' | 'react-native';
  viewport?: { width?: number; height?: number; scale?: number };
  format?: 'png' | 'jpg' | 'jpeg' | 'webp';
}

export type AtlasScreenshotCapturer = () => Promise<AtlasScreenshotCaptureResult | undefined>;

export interface ScheduleAtlasScreenshotInput {
  screen?: string;
  sessionId?: string;
  scenario?: string;
  pageId?: string;
  phase?: string;
  settleMs?: number;
  timestamp?: string;
}

export function registerAtlasScreenshotCapturer(
  _capturer: AtlasScreenshotCapturer | null
): void {
  // Browser stub: no capturer registry
}

export function getAtlasScreenshotCapturer(): AtlasScreenshotCapturer | null {
  return null;
}

export function isAtlasScreenshotCaptureEnabled(): boolean {
  return false;
}

export function resolveAtlasCaptureScreenshots(
  _config?: { captureScreenshots?: boolean } | null
): boolean {
  return false;
}

/** Called from {@link configureAtlas} — must remain a callable no-op on this stub. */
export function configureAtlasScreenshotCapture(_options: {
  enabled: boolean;
  htmlOutputPath?: string;
  settleMs?: number;
  maxAttempts?: number;
  retryMs?: number;
  persistMode?: 'immediate' | 'on-flush';
}): void {
  // Browser stub: ignore screenshot runtime config
}

export function resetAtlasScreenshotRuntime(): void {
  // Browser stub: nothing to reset
}

export function getPendingAtlasScreenshotFlushCount(): number {
  return 0;
}

export function getAtlasScreenshotBufferCount(): number {
  return 0;
}

export function scheduleAtlasScreenshotCapture(
  _input: ScheduleAtlasScreenshotInput
): void {
  // Browser stub: no capture
}

export function requestAtlasScreenshotCapture(
  _input: ScheduleAtlasScreenshotInput
): void {
  // Browser stub: no capture
}

export async function flushAtlasScreenshotsAsync(): Promise<{
  flushed: number;
  failed: number;
}> {
  return { flushed: 0, failed: 0 };
}
