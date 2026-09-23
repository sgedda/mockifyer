/**
 * Metro terminal key → Atlas capture session (start / stop + generate).
 *
 * Attaches alongside React Native / Expo CLI key handlers (`r` reload, `d` menu, …).
 * Default key is `a`:
 * - 1st press: start session (clear hop buffer, collect traffic)
 * - 2nd press: stop + generate Atlas HTML from hops collected during the session
 *
 * Opening `mockifyer-atlas` (SSE `/mockifyer-network-events/stream`) auto-starts
 * capture when idle — then press `a` once to stop & generate.
 *
 * Disable with `atlasKey: false`.
 */
import * as readline from "readline";
import { logger } from "@sgedda/mockifyer-core";

/** Keys already used by @react-native/community-cli-plugin (avoid stealing). */
const RESERVED_METRO_KEYS = new Set(["r", "d", "j", "i"]);

export const DEFAULT_METRO_ATLAS_KEY = "a";

/** Delay so RN/Expo CLI can own raw-mode stdin first. */
const ATTACH_DEFER_MS = 1000;

export type AtlasKeyOption = string | false;

export type MetroAtlasSessionPhase = "idle" | "capturing" | "rendering";

export type MetroAtlasSessionStartReason = "key" | "stream";

export interface AttachMetroAtlasKeyHandlerOptions {
  /**
   * Key that toggles Atlas capture (default `"a"`).
   * Pass `false` to disable.
   */
  atlasKey?: AtlasKeyOption;
  /** Called on session start (clear hop buffer, etc.). */
  onSessionStart: () => void;
  /** Called on session stop — generate Atlas HTML. */
  onSessionStop: () => void | Promise<void>;
  /** Override stdin (tests). */
  stdin?: NodeJS.ReadStream;
  /** Override defer delay in ms (tests). */
  deferMs?: number;
}

export interface AttachedMetroAtlasKeyHandler {
  /** Resolved key (lowercase), or null if disabled / failed. */
  key: string | null;
  /** Detach listener and clear module attach flag. */
  detach: () => void;
}

interface SessionCallbacks {
  key: string;
  onSessionStart: () => void;
  onSessionStop: () => void | Promise<void>;
}

let attached = false;
let weSetRawMode = false;
let activeHandler: ((str: string, key: readline.Key) => void) | null = null;
let activeStdin: NodeJS.ReadStream | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let sessionPhase: MetroAtlasSessionPhase = "idle";
let sessionStartedAt: number | null = null;
let sessionCallbacks: SessionCallbacks | null = null;
let streamSubscriberCount = 0;

/**
 * Normalize `atlasKey` option: default `"a"`, `false` → disabled, else single char.
 */
export function resolveAtlasKeyOption(
  atlasKey?: AtlasKeyOption,
): string | null {
  if (atlasKey === false) return null;
  const raw =
    atlasKey === undefined || atlasKey === null
      ? DEFAULT_METRO_ATLAS_KEY
      : String(atlasKey).trim();
  if (!raw) return null;
  const key = raw.length === 1 ? raw.toLowerCase() : raw.toLowerCase().charAt(0);
  return key || null;
}

/**
 * Whether a keypress should toggle the Atlas session.
 */
export function matchesAtlasKey(
  str: string | undefined,
  key: readline.Key | undefined,
  atlasKey: string,
): boolean {
  if (!atlasKey) return false;
  if (key?.ctrl || key?.meta) return false;
  if (key?.name === atlasKey) return true;
  if (typeof str === "string" && str.toLowerCase() === atlasKey) return true;
  return false;
}

/** Current session phase (idle / capturing / rendering). Exported for tests. */
export function getMetroAtlasSessionPhase(): MetroAtlasSessionPhase {
  return sessionPhase;
}

/** Active SSE stream subscriber count (tests / diagnostics). */
export function getMetroAtlasStreamSubscriberCount(): number {
  return streamSubscriberCount;
}

function formatSessionDuration(startedAt: number): string {
  const ms = Date.now() - startedAt;
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}m ${rem}s`;
}

/**
 * Start capture when idle. No-op if already capturing/rendering or key handler off.
 * @returns true if a new session was started
 */
export function startMetroAtlasSession(
  reason: MetroAtlasSessionStartReason = "key",
): boolean {
  if (!sessionCallbacks) return false;
  if (sessionPhase !== "idle") return false;

  const { key, onSessionStart } = sessionCallbacks;
  sessionPhase = "capturing";
  sessionStartedAt = Date.now();
  try {
    onSessionStart();
  } catch (err) {
    sessionPhase = "idle";
    sessionStartedAt = null;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Mockifyer] Atlas session start failed: ${message}`);
    return false;
  }

  if (reason === "stream") {
    console.log(
      `[Mockifyer] Atlas capture started (stream connected) — press ${key} to stop & generate HTML.`,
    );
  } else {
    console.log(
      `[Mockifyer] Atlas capture started — press ${key} again to stop & generate HTML.`,
    );
  }
  return true;
}

/**
 * Stop capture and generate Atlas HTML when capturing.
 * @returns true if stop/render was kicked off
 */
export function stopMetroAtlasSession(): boolean {
  if (!sessionCallbacks) return false;
  if (sessionPhase !== "capturing") return false;

  const { onSessionStop } = sessionCallbacks;
  const startedAt = sessionStartedAt ?? Date.now();
  const duration = formatSessionDuration(startedAt);
  sessionPhase = "rendering";
  console.log(
    `[Mockifyer] Atlas capture stopped (${duration}) — generating HTML…`,
  );
  Promise.resolve()
    .then(() => onSessionStop())
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Mockifyer] Atlas render failed: ${message}`);
    })
    .finally(() => {
      sessionPhase = "idle";
      sessionStartedAt = null;
    });
  return true;
}

/**
 * First SSE client for `/mockifyer-network-events/stream` auto-starts capture.
 */
export function notifyMetroAtlasStreamClientConnected(): void {
  streamSubscriberCount += 1;
  if (streamSubscriberCount === 1) {
    startMetroAtlasSession("stream");
  }
}

/**
 * SSE client disconnected — capture stays open until Metro `a` (or explicit stop).
 */
export function notifyMetroAtlasStreamClientDisconnected(): void {
  streamSubscriberCount = Math.max(0, streamSubscriberCount - 1);
}

function clearPendingTimer(): void {
  if (pendingTimer != null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
}

/**
 * Detach a previously attached handler (idempotent). Exported for tests.
 */
export function detachMetroAtlasKeyHandler(): void {
  clearPendingTimer();
  if (activeHandler && activeStdin) {
    activeStdin.removeListener("keypress", activeHandler);
  }
  if (weSetRawMode && activeStdin?.isTTY && typeof activeStdin.setRawMode === "function") {
    try {
      activeStdin.setRawMode(false);
    } catch {
      // ignore
    }
  }
  activeHandler = null;
  activeStdin = null;
  weSetRawMode = false;
  attached = false;
  sessionPhase = "idle";
  sessionStartedAt = null;
  sessionCallbacks = null;
  streamSubscriberCount = 0;
}

/**
 * Listen for a Metro terminal key to start/stop Atlas capture.
 * Safe to call once per process; subsequent calls are no-ops until detach.
 */
export function attachMetroAtlasKeyHandler(
  options: AttachMetroAtlasKeyHandlerOptions,
): AttachedMetroAtlasKeyHandler {
  const key = resolveAtlasKeyOption(options.atlasKey);
  if (key == null) {
    return { key: null, detach: () => undefined };
  }

  if (RESERVED_METRO_KEYS.has(key)) {
    logger.warn(
      `[Mockifyer] atlasKey "${key}" conflicts with Metro/RN CLI — pick another letter`,
    );
  }

  sessionCallbacks = {
    key,
    onSessionStart: options.onSessionStart,
    onSessionStop: options.onSessionStop,
  };

  if (attached) {
    return {
      key,
      detach: detachMetroAtlasKeyHandler,
    };
  }

  const stdin = options.stdin ?? process.stdin;
  const deferMs = options.deferMs ?? ATTACH_DEFER_MS;

  const onKeypress = (str: string, keyObj: readline.Key): void => {
    if (keyObj?.ctrl && keyObj.name === "c") {
      if (weSetRawMode) {
        try {
          if (typeof stdin.setRawMode === "function") stdin.setRawMode(false);
        } catch {
          // ignore
        }
        process.exit(0);
      }
      return;
    }
    if (!matchesAtlasKey(str, keyObj, key)) return;

    if (sessionPhase === "rendering") {
      console.log("[Mockifyer] Atlas render already in progress…");
      return;
    }

    if (sessionPhase === "idle") {
      startMetroAtlasSession("key");
      return;
    }

    stopMetroAtlasSession();
  };

  const doAttach = (): void => {
    if (attached) return;
    if (!stdin.isTTY) {
      logger.info(
        "[Mockifyer] Atlas key skipped (stdin is not a TTY — use mockifyer-atlas or Dev Menu)",
      );
      return;
    }

    readline.emitKeypressEvents(stdin);
    if (typeof stdin.setRawMode === "function" && stdin.isRaw !== true) {
      try {
        stdin.setRawMode(true);
        weSetRawMode = true;
      } catch (err) {
        logger.warn(
          "[Mockifyer] Could not enable raw stdin for Atlas key:",
          err,
        );
        return;
      }
    }

    if (typeof stdin.resume === "function") {
      stdin.resume();
    }

    activeHandler = onKeypress;
    activeStdin = stdin;
    stdin.on("keypress", onKeypress);
    attached = true;

    console.log(
      `[Mockifyer] info Press ${key} to start/stop Atlas capture (stop generates HTML). ` +
        `mockifyer-atlas stream auto-starts capture.`,
    );
  };

  clearPendingTimer();
  if (deferMs <= 0) {
    doAttach();
  } else {
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      doAttach();
    }, deferMs);
    // Don't keep the process alive solely for the defer timer.
    if (typeof pendingTimer === "object" && pendingTimer && "unref" in pendingTimer) {
      (pendingTimer as NodeJS.Timeout).unref();
    }
  }

  return {
    key,
    detach: detachMetroAtlasKeyHandler,
  };
}
