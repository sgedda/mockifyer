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

/** Result from an app-registered capturer (RN tmpfile URI, base64, or raw PNG bytes). */
export interface AtlasScreenshotCaptureResult {
  /** PNG bytes — preferred on web/Node when capturer returns data directly. */
  data?: Uint8Array | Buffer;
  /** Base64 PNG (no data-URL prefix) — preferred on React Native. */
  base64?: string;
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

async function uploadScreenshotViaMetro(relPath: string, bytes: Uint8Array): Promise<boolean> {
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
      body: JSON.stringify({ relativePath: relPath, base64 }),
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

        let persisted = false;
        if (htmlRoot && fs) {
          persisted = writeScreenshotPng(htmlRoot, relPath, bytes);
        }
        if (!persisted) {
          persisted = await uploadScreenshotViaMetro(relPath, bytes);
        }
        if (!persisted) return;

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
