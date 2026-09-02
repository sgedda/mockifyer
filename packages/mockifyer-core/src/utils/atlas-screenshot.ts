/**
 * Opt-in Atlas screen screenshots — dependency-free core with app-injected capturer.
 * PNG files are written under `{htmlOutputPath}/screenshots/` on Node when configured.
 */

import { ENV_VARS } from '../types';
import { getAtlasSessionId, isAtlasEnabled } from './atlas';
import { setAtlasDocScreenshot } from './atlas-doc';
import { getAtlasDocHtmlOutputPath } from './atlas-doc-html';

let fs: typeof import('fs') | undefined;
let pathMod: typeof import('path') | undefined;

try {
  fs = require('fs');
  pathMod = require('path');
} catch {
  fs = undefined;
  pathMod = undefined;
}

/** Result from an app-registered capturer (RN tmpfile URI or raw PNG bytes). */
export interface AtlasScreenshotCaptureResult {
  /** PNG bytes — preferred on web/Node when capturer returns data directly. */
  data?: Uint8Array | Buffer;
  /** Temporary file URI (React Native `react-native-view-shot` tmpfile). */
  tmpUri?: string;
  platform?: 'web' | 'react-native';
  viewport?: { width?: number; height?: number; scale?: number };
}

export type AtlasScreenshotCapturer = () => Promise<AtlasScreenshotCaptureResult | undefined>;

let registeredCapturer: AtlasScreenshotCapturer | null = null;
let captureEnabled = false;
/** Dedupe: one screenshot per sessionId + screen per runtime. */
const capturedKeys = new Set<string>();
const pendingKeys = new Set<string>();

/**
 * Register an app-provided screenshot function (e.g. html2canvas, react-native-view-shot).
 * Pass `null` to unregister.
 */
export function registerAtlasScreenshotCapturer(capturer: AtlasScreenshotCapturer | null): void {
  registeredCapturer = capturer;
}

export function getAtlasScreenshotCapturer(): AtlasScreenshotCapturer | null {
  return registeredCapturer;
}

/** Whether screenshot capture is enabled (config + env, capturer may still be unset). */
export function isAtlasScreenshotCaptureEnabled(): boolean {
  return captureEnabled;
}

/**
 * Resolve opt-in screenshot capture from env kill switch + atlas config.
 * Env `MOCKIFYER_ATLAS_SCREENSHOTS=false` always disables; `true` enables when capturer is wired.
 */
export function resolveAtlasCaptureScreenshots(
  config?: { captureScreenshots?: boolean } | null
): boolean {
  if (typeof process !== 'undefined') {
    const raw = process.env[ENV_VARS.MOCK_ATLAS_SCREENSHOTS]?.trim().toLowerCase();
    if (raw === 'false' || raw === '0' || raw === 'off' || raw === 'no') return false;
    if (raw === 'true' || raw === '1' || raw === 'on' || raw === 'yes') return true;
  }
  return config?.captureScreenshots === true;
}

/** Called from {@link configureAtlas} when atlas runtime is configured. */
export function configureAtlasScreenshotCapture(options: {
  enabled: boolean;
  htmlOutputPath?: string;
}): void {
  captureEnabled = options.enabled;
  if (!options.enabled) {
    capturedKeys.clear();
    pendingKeys.clear();
  }
}

export function resetAtlasScreenshotRuntime(): void {
  registeredCapturer = null;
  captureEnabled = false;
  capturedKeys.clear();
  pendingKeys.clear();
}

function safeSegment(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'screen';
}

function dedupeKey(sessionId: string, screen: string): string {
  return `${sessionId.trim()}::${screen.trim()}`;
}

function relativeScreenshotPath(sessionId: string, screen: string): string {
  const file = `${safeSegment(sessionId)}__${safeSegment(screen)}.png`;
  return `screenshots/${file}`;
}

function afterLayoutPaint(run: () => void): void {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      requestAnimationFrame(run);
    });
    return;
  }
  setTimeout(run, 100);
}

async function readCaptureBytes(result: AtlasScreenshotCaptureResult): Promise<Buffer | undefined> {
  if (result.data) {
    return Buffer.isBuffer(result.data) ? result.data : Buffer.from(result.data);
  }
  const tmpUri = result.tmpUri?.trim();
  if (!tmpUri || !fs) return undefined;
  try {
    const filePath = tmpUri.startsWith('file://') ? tmpUri.slice('file://'.length) : tmpUri;
    return fs.readFileSync(filePath);
  } catch {
    return undefined;
  }
}

function writeScreenshotPng(rootDir: string, relPath: string, bytes: Buffer): boolean {
  if (!fs || !pathMod) return false;
  try {
    const abs = pathMod.join(rootDir, relPath);
    fs.mkdirSync(pathMod.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, bytes);
    return true;
  } catch {
    return false;
  }
}

export interface ScheduleAtlasScreenshotInput {
  screen: string;
  sessionId?: string | null;
  scenario?: string;
  pageId?: string;
  timestamp?: string;
}

/**
 * Schedule a one-per-(sessionId+screen) screenshot after layout paint.
 * No-op when atlas is off, capture disabled, capturer unset, or already captured.
 */
export function scheduleAtlasScreenshotCapture(input: ScheduleAtlasScreenshotInput): void {
  if (!isAtlasEnabled() || !captureEnabled || !registeredCapturer) return;

  const screen = input.screen?.trim();
  if (!screen) return;

  const sessionId = input.sessionId?.trim() || getAtlasSessionId()?.trim() || 'session';
  const key = dedupeKey(sessionId, screen);
  if (capturedKeys.has(key) || pendingKeys.has(key)) return;

  pendingKeys.add(key);

  afterLayoutPaint(() => {
    void (async () => {
      try {
        if (capturedKeys.has(key)) return;

        const result = await registeredCapturer!();
        if (!result) return;

        const bytes = await readCaptureBytes(result);
        if (!bytes?.length) return;

        const htmlRoot = getAtlasDocHtmlOutputPath()?.trim();
        const relPath = relativeScreenshotPath(sessionId, screen);
        const capturedAt = input.timestamp ?? new Date().toISOString();

        if (htmlRoot) {
          const written = writeScreenshotPng(htmlRoot, relPath, bytes);
          if (!written) return;
        } else if (!fs) {
          // RN / no HTML path — skip persistence until Metro sync (future).
          return;
        } else {
          return;
        }

        capturedKeys.add(key);
        setAtlasDocScreenshot({
          scenario: input.scenario,
          screen,
          sessionId,
          screenshotPath: relPath,
          capturedAt,
          pageId: input.pageId,
        });
      } catch {
        // Observability must not break the app
      } finally {
        pendingKeys.delete(key);
      }
    })();
  });
}
