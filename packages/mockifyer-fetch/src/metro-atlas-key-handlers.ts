/**
 * Metro terminal keys for Mockifyer:
 * - `t` (default): start/stop Atlas capture (stop generates HTML) and activate Mockifyer
 * - `m` (default): open the Mockifyer dashboard in the browser
 *
 * Opening `mockifyer-atlas` (SSE `/mockifyer-network-events/stream`) auto-starts
 * capture when idle — then press `t` once to stop & generate.
 * Starting capture also signals the app to call `enableMockifyer()` (for `runtimeMode: 'manual'`).
 *
 * `a` is reserved by Metro for Android (`i` iOS, `r` reload, `d` Dev Menu, `j` DevTools).
 * Disable Atlas with `atlasKey: false`, dashboard with `dashboardKey: false`.
 */
import * as readline from "readline";
import { spawn } from "child_process";
import { logger } from "@sgedda/mockifyer-core";

/**
 * Keys already used by @react-native/community-cli-plugin (avoid stealing).
 * Value is the short reason shown when a binding collides.
 */
const RESERVED_METRO_KEYS: ReadonlyMap<string, string> = new Map([
  ["a", "Android"],
  ["d", "the Dev Menu"],
  ["i", "iOS"],
  ["j", "DevTools"],
  ["r", "reload"],
]);

/** `t` — `a` launches Android in the Metro / RN CLI. */
export const DEFAULT_METRO_ATLAS_KEY = "t";
export const DEFAULT_METRO_DASHBOARD_KEY = "m";
export const DEFAULT_METRO_DASHBOARD_URL = "http://localhost:3002";

/** Delay so RN/Expo CLI can own raw-mode stdin first. */
const ATTACH_DEFER_MS = 1000;

export type AtlasKeyOption = string | false;

export type MetroAtlasSessionPhase = "idle" | "capturing" | "rendering";

export type MetroAtlasSessionStartReason = "key" | "stream";

export interface AttachMetroAtlasKeyHandlerOptions {
  /**
   * Key that toggles Atlas capture (default `"t"`).
   * Pass `false` to disable. `a` is reserved by Metro for Android.
   */
  atlasKey?: AtlasKeyOption;
  /**
   * Key that opens the dashboard in the browser (default `"m"`).
   * Pass `false` to disable.
   */
  dashboardKey?: AtlasKeyOption;
  /**
   * Dashboard origin (default: `MOCKIFYER_DASHBOARD_URL` or `http://localhost:3002`).
   * Mount prefix from `MOCKIFYER_DASHBOARD_BASE` is appended when set.
   */
  dashboardUrl?: string;
  /** Called on session start (clear hop buffer, etc.). Required when Atlas key is enabled. */
  onSessionStart?: () => void;
  /** Called on session stop — generate Atlas HTML. Required when Atlas key is enabled. */
  onSessionStop?: () => void | Promise<void>;
  /** Override stdin (tests). */
  stdin?: NodeJS.ReadStream;
  /** Override defer delay in ms (tests). */
  deferMs?: number;
  /** Override URL opener (tests). */
  openUrl?: (url: string) => void;
}

export interface AttachedMetroAtlasKeyHandler {
  /** Resolved Atlas key (lowercase), or null if disabled. */
  key: string | null;
  /** Resolved dashboard key (lowercase), or null if disabled. */
  dashboardKey: string | null;
  /** Resolved dashboard browse URL. */
  dashboardUrl: string | null;
  /** Detach listener and clear module attach flag. */
  detach: () => void;
}

interface SessionCallbacks {
  key: string | null;
  dashboardKey: string | null;
  dashboardUrl: string | null;
  onSessionStart?: () => void;
  onSessionStop?: () => void | Promise<void>;
  openUrl: (url: string) => void;
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
 * Normalize a single-char key option: default when undefined, `false` → disabled.
 */
export function resolveKeyOption(
  value: AtlasKeyOption | undefined,
  defaultKey: string,
): string | null {
  if (value === false) return null;
  const raw =
    value === undefined || value === null ? defaultKey : String(value).trim();
  if (!raw) return null;
  const key = raw.length === 1 ? raw.toLowerCase() : raw.toLowerCase().charAt(0);
  return key || null;
}

/**
 * Normalize `atlasKey` option: default `"t"`, `false` → disabled, else single char.
 */
export function resolveAtlasKeyOption(
  atlasKey?: AtlasKeyOption,
): string | null {
  return resolveKeyOption(atlasKey, DEFAULT_METRO_ATLAS_KEY);
}

/**
 * Normalize `dashboardKey` option: default `"m"`, `false` → disabled.
 */
export function resolveDashboardKeyOption(
  dashboardKey?: AtlasKeyOption,
): string | null {
  return resolveKeyOption(dashboardKey, DEFAULT_METRO_DASHBOARD_KEY);
}

/**
 * Resolve dashboard browse URL for Metro `m`.
 * Precedence: explicit → `MOCKIFYER_DASHBOARD_URL` → `http://localhost:3002`,
 * then append `MOCKIFYER_DASHBOARD_BASE` when set.
 */
export function resolveMetroDashboardUrl(explicit?: string): string {
  const fromExplicit = explicit?.trim();
  const fromEnv =
    typeof process !== "undefined"
      ? process.env.MOCKIFYER_DASHBOARD_URL?.trim()
      : undefined;
  const base = (fromExplicit || fromEnv || DEFAULT_METRO_DASHBOARD_URL).replace(
    /\/+$/,
    "",
  );
  const mountRaw =
    typeof process !== "undefined"
      ? process.env.MOCKIFYER_DASHBOARD_BASE?.trim()
      : undefined;
  if (!mountRaw) return base;
  const mount = mountRaw.replace(/\/+$/, "");
  if (!mount || mount === "/") return base;
  return `${base}${mount.startsWith("/") ? mount : `/${mount}`}`;
}

/**
 * Open a URL with the OS default handler (browser / file).
 */
export function openMetroBrowseUrl(target: string): void {
  const platform = process.platform;
  const child =
    platform === "darwin"
      ? spawn("open", [target], { detached: true, stdio: "ignore" })
      : platform === "win32"
        ? spawn("cmd", ["/c", "start", "", target], {
            detached: true,
            stdio: "ignore",
            windowsVerbatimArguments: true,
          })
        : spawn("xdg-open", [target], { detached: true, stdio: "ignore" });
  child.once("error", (err) => {
    console.error(`[Mockifyer] could not open: ${err.message}`);
    console.log(`[Mockifyer] open manually: ${target}`);
  });
  child.unref();
}

/**
 * Whether a keypress matches a bound key (no ctrl/meta).
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
 * Start capture when idle. No-op if already capturing/rendering or Atlas key off.
 * @returns true if a new session was started
 */
export function startMetroAtlasSession(
  reason: MetroAtlasSessionStartReason = "key",
): boolean {
  if (!sessionCallbacks?.key || !sessionCallbacks.onSessionStart) return false;
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
      `[Mockifyer] Atlas capture started (stream connected) — Mockifyer activated (turns off again on stop if it was off). Press ${key} to stop & generate HTML.`,
    );
  } else {
    console.log(
      `[Mockifyer] Atlas capture started — Mockifyer activated (turns off again on stop if it was off). Press ${key} again to stop & generate HTML.`,
    );
  }
  return true;
}

/**
 * Stop capture and generate Atlas HTML when capturing.
 * @returns true if stop/render was kicked off
 */
export function stopMetroAtlasSession(): boolean {
  if (!sessionCallbacks?.onSessionStop) return false;
  if (sessionPhase !== "capturing") return false;

  const { onSessionStop } = sessionCallbacks;
  const startedAt = sessionStartedAt ?? Date.now();
  const duration = formatSessionDuration(startedAt);
  sessionPhase = "rendering";
  console.log(
    `[Mockifyer] Atlas capture stopped (${duration}) — generating HTML… (Mockifyer turns off again if it was off before press t)`,
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

/** Open the dashboard URL when the dashboard key is enabled. */
export function openMetroDashboard(): boolean {
  if (!sessionCallbacks?.dashboardKey || !sessionCallbacks.dashboardUrl) {
    return false;
  }
  const url = sessionCallbacks.dashboardUrl;
  console.log(`[Mockifyer] Opening dashboard → ${url}`);
  try {
    sessionCallbacks.openUrl(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Mockifyer] Could not open dashboard: ${message}`);
    return false;
  }
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

function warnIfReserved(key: string, label: string): void {
  const reason = RESERVED_METRO_KEYS.get(key);
  if (reason) {
    logger.warn(
      `[Mockifyer] ${label} "${key}" is reserved for ${reason} — pick another letter`,
    );
  }
}

/**
 * Listen for Metro terminal keys (Atlas capture + open dashboard).
 * Safe to call once per process; subsequent calls are no-ops until detach.
 */
export function attachMetroAtlasKeyHandler(
  options: AttachMetroAtlasKeyHandlerOptions,
): AttachedMetroAtlasKeyHandler {
  const atlasKey = resolveAtlasKeyOption(options.atlasKey);
  const dashboardKey = resolveDashboardKeyOption(options.dashboardKey);
  const dashboardUrl =
    dashboardKey != null
      ? resolveMetroDashboardUrl(options.dashboardUrl)
      : null;

  if (atlasKey == null && dashboardKey == null) {
    return {
      key: null,
      dashboardKey: null,
      dashboardUrl: null,
      detach: () => undefined,
    };
  }

  if (atlasKey != null) warnIfReserved(atlasKey, "atlasKey");
  if (dashboardKey != null) warnIfReserved(dashboardKey, "dashboardKey");

  if (
    atlasKey != null &&
    dashboardKey != null &&
    atlasKey === dashboardKey
  ) {
    logger.warn(
      `[Mockifyer] atlasKey and dashboardKey are both "${atlasKey}" — dashboard key ignored`,
    );
  }

  const effectiveDashboardKey =
    atlasKey != null && dashboardKey === atlasKey ? null : dashboardKey;

  sessionCallbacks = {
    key: atlasKey,
    dashboardKey: effectiveDashboardKey,
    dashboardUrl: effectiveDashboardKey != null ? dashboardUrl : null,
    onSessionStart: options.onSessionStart,
    onSessionStop: options.onSessionStop,
    openUrl: options.openUrl ?? openMetroBrowseUrl,
  };

  if (attached) {
    return {
      key: atlasKey,
      dashboardKey: effectiveDashboardKey,
      dashboardUrl: sessionCallbacks.dashboardUrl,
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

    if (
      effectiveDashboardKey &&
      matchesAtlasKey(str, keyObj, effectiveDashboardKey)
    ) {
      openMetroDashboard();
      return;
    }

    if (!atlasKey || !matchesAtlasKey(str, keyObj, atlasKey)) return;

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
        "[Mockifyer] Metro keys skipped (stdin is not a TTY — use mockifyer-atlas or Dev Menu)",
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
          "[Mockifyer] Could not enable raw stdin for Metro keys:",
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

    const parts: string[] = [];
    if (atlasKey) {
      parts.push(
        `Press ${atlasKey} to start/stop Atlas capture (activates Mockifyer if off, restores off on stop; stop generates HTML; stream auto-starts)`,
      );
    }
    if (effectiveDashboardKey && dashboardUrl) {
      parts.push(`Press ${effectiveDashboardKey} to open dashboard (${dashboardUrl})`);
    }
    if (parts.length > 0) {
      console.log(`[Mockifyer] info ${parts.join(". ")}.`);
    }
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
    key: atlasKey,
    dashboardKey: effectiveDashboardKey,
    dashboardUrl: sessionCallbacks.dashboardUrl,
    detach: detachMetroAtlasKeyHandler,
  };
}
