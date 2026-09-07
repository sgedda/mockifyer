/**
 * Spill full network bodies so hops only keep short previews.
 * Texts are buffered in memory and flushed to `atlas-html/bodies/` on Render
 * (and best-effort async to disk/Metro during capture).
 */

import { utf8ByteLength } from './crypto-digest';
import { getAtlasDocHtmlOutputPath } from './atlas-doc-html';
import { prettyPrintJsonText } from './json-pretty';
import { resolveUnpatchedFetch } from './unpatched-global-fetch';

let fs: typeof import('fs') | undefined;
let pathMod: typeof import('path') | undefined;

try {
  fs = require('fs');
  pathMod = require('path');
} catch {
  fs = undefined;
  pathMod = undefined;
}

/** Inline preview size kept on the hop (UTF-8 bytes). */
export const NETWORK_LOG_INLINE_BODY_PREVIEW_BYTES = 2_048;

/** Do not spill bodies larger than this (UTF-8 bytes). */
export const NETWORK_BODY_SPILL_MAX_BYTES = 2_000_000;

const DEFAULT_METRO_PORT = 8081;
const METRO_UPLOAD_TIMEOUT_MS = 8_000;
const MAX_IN_FLIGHT = 2;
/** Soft caps so the in-memory spill buffer stays bounded until Render flush. */
const MAX_BUFFER_ENTRIES = 200;
const MAX_BUFFER_BYTES = 15_000_000;

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
  /** Override atlas-html root (Node). Default: {@link getAtlasDocHtmlOutputPath}. */
  outputDir?: string;
  metroPort?: number;
}

interface SpillJob {
  relativePath: string;
  text: string;
  outputDir?: string;
  metroPort?: number;
}

let spillEnabled = true;
let inFlight = 0;
const queue: SpillJob[] = [];
/** relativePath → full body text (survives failed async writes until Render flush). */
const spillBuffer = new Map<string, string>();
let bufferBytes = 0;

/** Enable/disable body spill (default on). Spill still only runs when captureBodies + oversized body. */
export function setNetworkBodySpillEnabled(enabled: boolean): void {
  spillEnabled = enabled;
}

export function isNetworkBodySpillEnabled(): boolean {
  return spillEnabled;
}

/** Snapshot of buffered spills for Metro render POST / diagnostics. */
export function getNetworkBodySpillSnapshot(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of spillBuffer) {
    out[k] = v;
  }
  return out;
}

/** Reset queue / buffer / flags (tests). */
export function resetNetworkBodySpillRuntime(): void {
  spillEnabled = true;
  inFlight = 0;
  queue.length = 0;
  spillBuffer.clear();
  bufferBytes = 0;
}

/**
 * Serialize a request/response value for spill / preview (capped at {@link NETWORK_BODY_SPILL_MAX_BYTES}).
 */
export function serializeBodyForSpill(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  let text: string;
  if (typeof value === 'string') {
    text = value;
  } else {
    try {
      text = JSON.stringify(value);
    } catch {
      text = String(value);
    }
  }
  if (!text) return undefined;
  const len = utf8ByteLength(text);
  if (len <= NETWORK_BODY_SPILL_MAX_BYTES) return text;
  // Prefer spill failure over OOM — caller keeps truncated preview only.
  return undefined;
}

function safeSpillKey(eventId: string, requestId?: string | null): string {
  const raw = (requestId?.trim() || eventId || 'hop').slice(0, 80);
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || 'hop';
}

function resolveMetroPort(explicit?: number): number {
  if (explicit != null && Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }
  if (typeof process !== 'undefined') {
    const fromEnv = process.env.METRO_PORT?.trim();
    if (fromEnv) {
      const n = Number.parseInt(fromEnv, 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return DEFAULT_METRO_PORT;
}

function writeSpillLocal(outputDir: string, relativePath: string, text: string): boolean {
  if (!fs || !pathMod) return false;
  try {
    const abs = pathMod.join(outputDir, relativePath);
    fs.mkdirSync(pathMod.dirname(abs), { recursive: true });
    // Pretty JSON on disk for browser tabs; extension is .json (same payload, readable).
    const body = relativePath.endsWith('.json') ? prettyPrintJsonText(text) : text;
    fs.writeFileSync(abs, body, 'utf8');
    return true;
  } catch {
    return false;
  }
}

function rememberInBuffer(relativePath: string, text: string): void {
  const prev = spillBuffer.get(relativePath);
  if (prev !== undefined) {
    bufferBytes -= utf8ByteLength(prev);
  }
  while (
    spillBuffer.size >= MAX_BUFFER_ENTRIES ||
    bufferBytes + utf8ByteLength(text) > MAX_BUFFER_BYTES
  ) {
    const oldest = spillBuffer.keys().next().value as string | undefined;
    if (!oldest) break;
    const oldText = spillBuffer.get(oldest);
    spillBuffer.delete(oldest);
    if (oldText) bufferBytes -= utf8ByteLength(oldText);
    if (oldest === relativePath) break;
  }
  spillBuffer.set(relativePath, text);
  bufferBytes += utf8ByteLength(text);
}

/**
 * Write all buffered spills under `atlasHtmlDir` (creates `bodies/`).
 * @returns number of files written
 */
export function flushNetworkBodySpillsToDir(atlasHtmlDir: string): number {
  const root = atlasHtmlDir.trim();
  if (!root || !fs || !pathMod) return 0;
  let written = 0;
  for (const [relativePath, text] of spillBuffer) {
    if (writeSpillLocal(root, relativePath, text)) {
      written += 1;
    }
  }
  return written;
}

/**
 * Apply a spill map onto disk (Metro render payload).
 */
export function writeNetworkBodySpillMap(
  atlasHtmlDir: string,
  spills: Record<string, string> | undefined
): number {
  const root = atlasHtmlDir.trim();
  if (!root || !spills || !fs || !pathMod) return 0;
  let written = 0;
  for (const [relativePath, text] of Object.entries(spills)) {
    const rel = relativePath.trim().replace(/^\/+/, '').replace(/\\/g, '/');
    if (!rel || rel.includes('..') || !rel.startsWith('bodies/') || !/\.(json|txt)$/.test(rel)) {
      continue;
    }
    if (typeof text !== 'string') continue;
    if (writeSpillLocal(root, rel, text)) {
      written += 1;
      rememberInBuffer(rel, text);
    }
  }
  return written;
}

async function writeSpillViaMetro(
  relativePath: string,
  text: string,
  metroPort?: number
): Promise<boolean> {
  const fetchFn = resolveUnpatchedFetch();
  if (!fetchFn) return false;
  const port = resolveMetroPort(metroPort);
  const url = `http://localhost:${port}/mockifyer-atlas-body-spill`;
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timeout =
    ctrl &&
    setTimeout(() => {
      try {
        ctrl.abort();
      } catch {
        /* ignore */
      }
    }, METRO_UPLOAD_TIMEOUT_MS);
  try {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ relativePath, text }),
      signal: ctrl?.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function pumpQueue(): void {
  while (inFlight < MAX_IN_FLIGHT && queue.length > 0) {
    const job = queue.shift()!;
    inFlight += 1;
    void (async () => {
      try {
        const dir = job.outputDir?.trim() || getAtlasDocHtmlOutputPath()?.trim();
        let ok = false;
        if (dir && fs) {
          ok = writeSpillLocal(dir, job.relativePath, job.text);
        }
        if (!ok) {
          await writeSpillViaMetro(job.relativePath, job.text, job.metroPort);
        }
      } catch {
        // Observability must not break the app — buffer still held for Render flush
      } finally {
        inFlight -= 1;
        pumpQueue();
      }
    })();
  }
}

function enqueueSpill(job: SpillJob): void {
  // Drop oldest queued IO if backlog grows (buffer Map still keeps text for Render).
  if (queue.length >= 100) {
    queue.shift();
  }
  queue.push(job);
  pumpQueue();
}

/**
 * If a body exceeds the inline preview budget, buffer full text + return a relative ref.
 * Async disk/Metro write is best-effort; {@link flushNetworkBodySpillsToDir} on Render is authoritative.
 */
export function scheduleNetworkBodySpill(input: ScheduleNetworkBodySpillInput): NetworkBodySpillRefs {
  const refs: NetworkBodySpillRefs = {};
  if (!spillEnabled) return refs;

  const key = safeSpillKey(input.eventId, input.requestId);
  const outputDir = input.outputDir?.trim() || getAtlasDocHtmlOutputPath()?.trim();

  const maybeSpill = (side: 'req' | 'res', text: string | undefined): void => {
    if (!text) return;
    const len = utf8ByteLength(text);
    if (len <= NETWORK_LOG_INLINE_BODY_PREVIEW_BYTES) return;

    const relativePath = `bodies/${key}-${side}.json`;
    if (side === 'req') {
      refs.requestBodyRef = relativePath;
      refs.requestBodyTruncated = true;
    } else {
      refs.responseBodyRef = relativePath;
      refs.responseBodyTruncated = true;
    }
    rememberInBuffer(relativePath, text);
    enqueueSpill({
      relativePath,
      text,
      outputDir,
      metroPort: input.metroPort,
    });
  };

  maybeSpill('req', input.requestBodyText);
  maybeSpill('res', input.responseBodyText);
  return refs;
}
