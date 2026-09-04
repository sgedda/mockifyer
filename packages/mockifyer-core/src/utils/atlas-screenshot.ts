/**
 * Opt-in Atlas screen screenshots — dependency-free core with app-injected capturer.
 * Node: writes PNG under `{htmlOutputPath}/screenshots/`.
 * React Native: POSTs base64 to Metro `/mockifyer-atlas-screenshot`.
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

const DEFAULT_METRO_PORT = 8081;
const METRO_UPLOAD_TIMEOUT_MS = 4_000;
/** Wait after paint so CMS/skeleton content can settle before capture. */
const DEFAULT_SCREENSHOT_SETTLE_MS = 600;
const DEFAULT_SCREENSHOT_MAX_ATTEMPTS = 4;
const DEFAULT_SCREENSHOT_RETRY_MS = 400;

/** Result from an app-registered capturer (RN tmpfile URI, base64, or raw PNG bytes). */
export interface AtlasScreenshotCaptureResult {
  /** PNG/JPEG/WebP bytes — preferred on web/Node when capturer returns data directly. */
  data?: Uint8Array | Buffer;
  /** Base64 image (no data-URL prefix) — preferred on React Native. */
  base64?: string;
  /** Temporary file URI (React Native `react-native-view-shot` tmpfile). */
  tmpUri?: string;
  platform?: 'web' | 'react-native';
  viewport?: { width?: number; height?: number; scale?: number };
  /** File format for persistence. Default `png`. Prefer `jpg` for smaller Atlas captures. */
  format?: 'png' | 'jpg' | 'jpeg' | 'webp';
}

export type AtlasScreenshotCapturer = () => Promise<AtlasScreenshotCaptureResult | undefined>;

let registeredCapturer: AtlasScreenshotCapturer | null = null;
let captureEnabled = false;
let settleMs = DEFAULT_SCREENSHOT_SETTLE_MS;
let maxAttempts = DEFAULT_SCREENSHOT_MAX_ATTEMPTS;
let retryMs = DEFAULT_SCREENSHOT_RETRY_MS;
/** `on-flush` = buffer in memory until Dev Menu render / crash export (default). */
let persistMode: 'immediate' | 'on-flush' = 'on-flush';
/** Dedupe: one screenshot per sessionId + screen per runtime. */
const capturedKeys = new Set<string>();
const pendingKeys = new Set<string>();

interface BufferedScreenshot {
  relativePath: string;
  bytes: Uint8Array;
  sessionId: string;
  screen: string;
  scenario?: string;
  pageId?: string;
  capturedAt: string;
  /** False until written to disk / Metro. */
  flushed: boolean;
}

/** In-memory PNGs — flushed on Dev Menu render / crash export. */
const screenshotBuffer = new Map<string, BufferedScreenshot>();

/**
 * Register an app-provided screenshot function (e.g. html2canvas, react-native-view-shot).
 * Return `undefined` to skip this attempt (core will retry a few times after settle).
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
  settleMs?: number;
  maxAttempts?: number;
  retryMs?: number;
  /** Default `on-flush` — write PNGs when {@link flushAtlasScreenshotsAsync} runs. */
  persistMode?: 'immediate' | 'on-flush';
}): void {
  captureEnabled = options.enabled;
  if (typeof options.settleMs === 'number' && Number.isFinite(options.settleMs) && options.settleMs >= 0) {
    settleMs = options.settleMs;
  } else {
    settleMs = DEFAULT_SCREENSHOT_SETTLE_MS;
  }
  if (typeof options.maxAttempts === 'number' && options.maxAttempts >= 1) {
    maxAttempts = Math.floor(options.maxAttempts);
  } else {
    maxAttempts = DEFAULT_SCREENSHOT_MAX_ATTEMPTS;
  }
  if (typeof options.retryMs === 'number' && options.retryMs >= 0) {
    retryMs = options.retryMs;
  } else {
    retryMs = DEFAULT_SCREENSHOT_RETRY_MS;
  }
  if (options.persistMode === 'immediate' || options.persistMode === 'on-flush') {
    persistMode = options.persistMode;
  } else {
    persistMode = 'on-flush';
  }
  if (!options.enabled) {
    capturedKeys.clear();
    pendingKeys.clear();
    screenshotBuffer.clear();
  }
}

export function resetAtlasScreenshotRuntime(): void {
  registeredCapturer = null;
  captureEnabled = false;
  settleMs = DEFAULT_SCREENSHOT_SETTLE_MS;
  maxAttempts = DEFAULT_SCREENSHOT_MAX_ATTEMPTS;
  retryMs = DEFAULT_SCREENSHOT_RETRY_MS;
  persistMode = 'on-flush';
  capturedKeys.clear();
  pendingKeys.clear();
  screenshotBuffer.clear();
}

/** How many captured screenshots are waiting to be written to disk. */
export function getPendingAtlasScreenshotFlushCount(): number {
  let n = 0;
  for (const entry of screenshotBuffer.values()) {
    if (!entry.flushed) n += 1;
  }
  return n;
}

function safeSegment(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'screen';
}

function dedupeKey(sessionId: string, screen: string, phase?: string): string {
  const p = phase?.trim() || 'default';
  return `${sessionId.trim()}::${screen.trim()}::${p}`;
}

function relativeScreenshotPath(
  sessionId: string,
  screen: string,
  phase?: string,
  format?: string
): string {
  const phaseSeg = phase?.trim() ? `__${safeSegment(phase)}` : '';
  const ext =
    format === 'jpg' || format === 'jpeg' ? 'jpg' : format === 'webp' ? 'webp' : 'png';
  const file = `${safeSegment(sessionId)}__${safeSegment(screen)}${phaseSeg}.${ext}`;
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

function resolveMetroPort(): number {
  if (typeof process !== 'undefined') {
    const fromEnv = process.env.METRO_PORT?.trim();
    if (fromEnv) {
      const n = Number.parseInt(fromEnv, 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return DEFAULT_METRO_PORT;
}

function stripDataUrlPrefix(value: string): string {
  const trimmed = value.trim();
  const comma = trimmed.indexOf(',');
  if (trimmed.startsWith('data:') && comma >= 0) {
    return trimmed.slice(comma + 1);
  }
  return trimmed;
}

function decodeBase64ToBytes(base64: string): Uint8Array | undefined {
  const cleaned = stripDataUrlPrefix(base64);
  if (!cleaned) return undefined;
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(cleaned, 'base64');
    }
    if (typeof atob === 'function') {
      const binary = atob(cleaned);
      const out = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        out[i] = binary.charCodeAt(i);
      }
      return out;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function encodeBytesToBase64(bytes: Uint8Array): string | undefined {
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(bytes).toString('base64');
    }
    if (typeof btoa === 'function') {
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]!);
      }
      return btoa(binary);
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function readCaptureBytes(result: AtlasScreenshotCaptureResult): Promise<Uint8Array | undefined> {
  if (result.base64?.trim()) {
    return decodeBase64ToBytes(result.base64);
  }
  if (result.data) {
    return result.data instanceof Uint8Array ? result.data : new Uint8Array(result.data);
  }
  const tmpUri = result.tmpUri?.trim();
  if (!tmpUri) return undefined;

  if (fs) {
    try {
      const filePath = tmpUri.startsWith('file://') ? tmpUri.slice('file://'.length) : tmpUri;
      return fs.readFileSync(filePath);
    } catch {
      // fall through to fetch
    }
  }

  if (typeof fetch !== 'function') return undefined;
  try {
    const res = await fetch(tmpUri);
    if (!res.ok) return undefined;
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    // Fall back to XMLHttpRequest for file:// URIs on React Native
    if (typeof XMLHttpRequest !== 'undefined') {
      try {
        const bytes = await new Promise<Uint8Array | undefined>((resolve) => {
          const xhr = new XMLHttpRequest();
          xhr.onload = () => {
            if (xhr.status === 200 || xhr.status === 0) {
              resolve(new Uint8Array(xhr.response));
            } else {
              resolve(undefined);
            }
          };
          xhr.onerror = () => resolve(undefined);
          xhr.responseType = 'arraybuffer';
          xhr.open('GET', tmpUri, true);
          xhr.send();
        });
        if (bytes) return bytes;
      } catch {
        // XMLHttpRequest failed too
      }
    }
    return undefined;
  }
}

function writeScreenshotPng(rootDir: string, relPath: string, bytes: Uint8Array): boolean {
  if (!fs || !pathMod) return false;
  try {
    const abs = pathMod.join(rootDir, relPath);
    fs.mkdirSync(pathMod.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, Buffer.from(bytes));
    return true;
  } catch {
    return false;
  }
}

async function uploadScreenshotViaMetro(
  relPath: string,
  bytes: Uint8Array,
  metadata: {
    sessionId: string;
    screen: string;
    scenario?: string;
    pageId?: string;
    capturedAt: string;
  }
): Promise<boolean> {
  if (typeof fetch !== 'function') return false;
  const base64 = encodeBytesToBase64(bytes);
  if (!base64) return false;

  const metroPort = resolveMetroPort();
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const timeout = controller
      ? setTimeout(() => controller.abort(), METRO_UPLOAD_TIMEOUT_MS)
      : undefined;
    const res = await fetch(`http://localhost:${metroPort}/mockifyer-atlas-screenshot`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ relativePath: relPath, base64, ...metadata }),
      signal: controller?.signal,
    });
    if (timeout) clearTimeout(timeout);
    return res.ok;
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
  /** Override configured settle delay (ms after paint). */
  settleMs?: number;
  /**
   * Capture phase for multi-shot per screen (e.g. `early` on focus, `ready` after content).
   * Dedupe key and filename include phase so both can coexist.
   */
  phase?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Schedule a one-per-(sessionId+screen+phase) screenshot after layout paint + settle delay.
 * Prefer {@link requestAtlasScreenshotCapture} once the screen content is ready (not on mount).
 * Capturer may return `undefined` to retry (skeleton still showing).
 *
 * By default PNGs stay in memory until {@link flushAtlasScreenshotsAsync}
 * (Dev Menu “Render Atlas docs” / crash export) — same model as other Atlas artifacts.
 */
export function scheduleAtlasScreenshotCapture(input: ScheduleAtlasScreenshotInput): void {
  if (!isAtlasEnabled() || !captureEnabled || !registeredCapturer) return;

  const screen = input.screen?.trim();
  if (!screen) return;

  const sessionId = input.sessionId?.trim() || getAtlasSessionId()?.trim() || 'session';
  const phase = input.phase?.trim() || undefined;
  const key = dedupeKey(sessionId, screen, phase);
  if (capturedKeys.has(key) || pendingKeys.has(key)) return;

  pendingKeys.add(key);
  const waitMs = input.settleMs ?? settleMs;

  afterLayoutPaint(() => {
    void (async () => {
      try {
        if (waitMs > 0) {
          await sleep(waitMs);
        }
        if (capturedKeys.has(key)) return;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          if (attempt > 0 && retryMs > 0) {
            await sleep(retryMs);
          }
          if (capturedKeys.has(key)) return;

          const result = await registeredCapturer!();
          if (!result) continue;

          const bytes = await readCaptureBytes(result);
          if (!bytes?.length) continue;

          const relPath = relativeScreenshotPath(sessionId, screen, phase, result.format);
          const capturedAt = input.timestamp ?? new Date().toISOString();
          const meta = {
            sessionId,
            screen,
            scenario: input.scenario,
            pageId: input.pageId,
            capturedAt,
          };

          screenshotBuffer.set(relPath, {
            relativePath: relPath,
            bytes,
            ...meta,
            flushed: false,
          });

          capturedKeys.add(key);
          setAtlasDocScreenshot({
            scenario: input.scenario,
            screen,
            sessionId,
            screenshotPath: relPath,
            capturedAt,
            pageId: input.pageId,
            phase,
          });

          if (persistMode === 'immediate') {
            await persistBufferedScreenshot(relPath);
          }
          return;
        }
      } catch {
        // Observability must not break the app
      } finally {
        pendingKeys.delete(key);
      }
    })();
  });
}

async function persistBufferedScreenshot(relPath: string): Promise<boolean> {
  const entry = screenshotBuffer.get(relPath);
  if (!entry || entry.flushed) return entry?.flushed === true;

  const htmlRoot = getAtlasDocHtmlOutputPath()?.trim();
  let persisted = false;
  if (htmlRoot && fs) {
    persisted = writeScreenshotPng(htmlRoot, entry.relativePath, entry.bytes);
  }
  if (!persisted) {
    persisted = await uploadScreenshotViaMetro(entry.relativePath, entry.bytes, {
      sessionId: entry.sessionId,
      screen: entry.screen,
      scenario: entry.scenario,
      pageId: entry.pageId,
      capturedAt: entry.capturedAt,
    });
  }
  if (persisted) {
    entry.flushed = true;
  }
  return persisted;
}

/**
 * Write buffered Atlas screenshots to `atlas-html/screenshots/` (Node fs or Metro).
 * Call from Dev Menu render and crash export — same “save later” model as Atlas HTML.
 */
export async function flushAtlasScreenshotsAsync(): Promise<{ flushed: number; failed: number }> {
  let flushed = 0;
  let failed = 0;
  for (const [relPath, entry] of screenshotBuffer) {
    if (entry.flushed) continue;
    const ok = await persistBufferedScreenshot(relPath);
    if (ok) flushed += 1;
    else failed += 1;
  }
  return { flushed, failed };
}

/**
 * App-facing alias: call when the screen has finished loading (not on first mount).
 * Example: after `isLoading === false` and first content paint.
 * PNG bytes are buffered until {@link flushAtlasScreenshotsAsync}.
 */
export function requestAtlasScreenshotCapture(input: ScheduleAtlasScreenshotInput): void {
  scheduleAtlasScreenshotCapture(input);
}
