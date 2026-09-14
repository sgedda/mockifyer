#!/usr/bin/env ts-node

/**
 * Interactive Atlas hop stream against Metro (no dashboard GUI).
 *
 * Prerequisites: Metro with `createMockSyncMiddleware`, app emitting hops
 * (`MOCKIFYER_METRO_STREAM=on` or `METRO_PORT` / React Native auto).
 *
 * Usage:
 *   mockifyer-atlas
 *   mockifyer-atlas --port 8081
 *   mockifyer-atlas --no-color
 *   npx @sgedda/mockifyer-core mockifyer-atlas
 *
 * Keys (interactive session):
 *   click  expand/collapse a ▸ nested row (mouse reporting)
 *   a  analyze buffer
 *   s  snapshot hops → mock-data/atlas-html/{atlas-events.json,atlas.ndjson,atlas.har}
 *   r  generate Atlas HTML → atlas-html/index.html
 *   o  generate Atlas HTML, then open index.html from disk
 *   e  expand/collapse all nested groups
 *   p / Space  pause/resume live hops
 *   wheel / ↑↓ / PgUp / PgDn  scroll history (pauses live stream)
 *   m  toggle mouse (starts on for click + wheel; off = select/copy)
 *   g  toggle default collapse for new nested hops
 *   d  toggle collapse duplicate consecutive roots (×N)
 *   f  toggle errors-only filter
 *   c  clear Metro ring buffer
 *   h  help
 *   q  quit
 */

import http from "http";
import path from "path";
import { pathToFileURL } from "url";
import fs from "fs";
import { exec } from "child_process";
import type { NetworkEvent } from "../utils/network-event-types";
import {
  resolveMetroNetworkStreamPort,
  type MetroNetworkStreamAnalysis,
} from "../utils/metro-network-stream";
import {
  formatAtlasStreamAnalysisRich,
  MetroAtlasStreamView,
  createAtlasStreamColorTheme,
  shouldUseAtlasStreamColor,
  writeAtlasStreamPaint,
  AtlasStreamHitTracker,
  enableAtlasStreamMouseTracking,
  disableAtlasStreamMouseTracking,
  consumeAtlasStreamMouseInput,
  resolveAtlasStreamHopOpenUrl,
} from "../utils/metro-network-stream-tty";
import type { AtlasStreamPaint } from "../utils/metro-network-stream-tty";
import { createEmptyAtlasDocMap } from "../utils/atlas-doc";
import { writeAtlasDocHtml } from "../utils/atlas-doc-html";
import { flushNetworkBodySpillsToDir } from "../utils/network-body-spill";

interface CliOptions {
  port?: number;
  host?: string;
  backlog?: boolean;
  help?: boolean;
  color?: boolean;
  expand?: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = { backlog: true };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--port" || arg === "-p") {
      options.port = Number.parseInt(args[++i] ?? "", 10);
    } else if (arg === "--host") {
      options.host = args[++i];
    } else if (arg === "--no-backlog") {
      options.backlog = false;
    } else if (arg === "--no-color") {
      options.color = false;
    } else if (arg === "--color") {
      options.color = true;
    } else if (arg === "--expand") {
      options.expand = true;
    }
  }
  return options;
}

function showHelp(theme = createAtlasStreamColorTheme(false)): void {
  console.log(`
${theme.bold("Mockifyer Atlas")} — interactive Metro hop stream

Usage:
  mockifyer-atlas [--port 8081] [--host localhost] [--no-backlog] [--no-color] [--expand]

Streams raw traffic from Metro's in-memory hop buffer (POST /mockifyer-network-events).
Does not require the dashboard GUI.

Keys:
  ${theme.info("click")}  Expand/collapse a ▸ nested row (Terminal / iTerm mouse)
  ${theme.info("e")}  Expand/collapse all nested groups
  ${theme.info("p")}/${theme.info("Space")}  Pause/resume live hops
  ${theme.info("wheel")}/${theme.info("↑↓")}/${theme.info("PgUp")}/${theme.info("PgDn")}  Scroll hop history (pauses live stream)
  ${theme.info("m")}  Toggle mouse (starts on) — on = click req/res/html + wheel; off = select/copy
  ${theme.info("g")}  Toggle default collapse for new nested hops
  ${theme.info("d")}  Toggle collapse duplicate consecutive roots (×N)
  ${theme.info("f")}  Toggle errors-only filter
  ${theme.info("a")}  Analyze buffer (counts, slow, errors)
  ${theme.info("s")}  Snapshot → atlas-html/atlas-events.json + .ndjson + .har
  ${theme.info("r")}  Generate Atlas HTML from buffer hops → atlas-html/index.html
  ${theme.info("o")}  Generate Atlas HTML + open index.html
  ${theme.info("c")}  Clear Metro hop buffer
  ${theme.info("h")}  Show this help
  ${theme.info("q")}  Quit

Env:
  METRO_PORT                 Metro port (default 8081)
  MOCKIFYER_METRO_STREAM     on|off (app-side ingest; auto on RN / when METRO_PORT set)
  NO_COLOR / FORCE_COLOR     standard color controls
`);
}

function metroBase(options: CliOptions): string {
  const host = options.host?.trim() || "localhost";
  const port = resolveMetroNetworkStreamPort(options.port);
  return `http://${host}:${port}`;
}

function jsonGet<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) =>
          chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)),
        );
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if ((res.statusCode ?? 500) >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${text.slice(0, 200)}`));
            return;
          }
          try {
            resolve(JSON.parse(text) as T);
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        });
      })
      .on("error", reject);
  });
}

function jsonPost<T>(url: string, body?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? "" : JSON.stringify(body);
    const req = http.request(
      url,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) =>
          chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)),
        );
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if ((res.statusCode ?? 500) >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${text.slice(0, 200)}`));
            return;
          }
          try {
            resolve(text ? (JSON.parse(text) as T) : ({} as T));
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        });
      },
    );
    req.on("error", reject);
    req.end(payload);
  });
}

function openUrl(target: string): void {
  const platform = process.platform;
  // Prefer a real filesystem path so `open`/`xdg-open` load index.html from disk
  // (Metro may not expose /atlas-html/ depending on how the server is wired).
  const cmd =
    platform === "darwin"
      ? `open ${JSON.stringify(target)}`
      : platform === "win32"
        ? `start "" ${JSON.stringify(target)}`
        : `xdg-open ${JSON.stringify(target)}`;
  exec(cmd, (err) => {
    if (err) {
      console.error(`[atlas] could not open: ${err.message}`);
      console.log(`[atlas] open manually: ${target}`);
    }
  });
}


/** Absolute file:// URL for terminal click-to-open (iTerm / VS Code / many TTYs). */
function toFileUrl(absPath: string): string {
  return pathToFileURL(absPath).href;
}


function resolveAtlasIndexPath(options: {
  indexPath?: string;
  outputDir?: string;
}): string | undefined {
  const candidates: string[] = [];
  if (options.indexPath?.trim()) {
    candidates.push(path.resolve(options.indexPath.trim()));
  }
  if (options.outputDir?.trim()) {
    const dir = path.resolve(options.outputDir.trim());
    candidates.push(path.join(dir, "index.html"));
    if (dir.endsWith(`${path.sep}index.html`) || dir.endsWith("index.html")) {
      candidates.push(dir);
    }
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

function bannerPaint(base: string, view: MetroAtlasStreamView): AtlasStreamPaint {
  const theme = createAtlasStreamColorTheme(view.colorEnabled);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const coreVersion = require("../../package.json").version as string;
  const lines = [
    `${theme.bold("[atlas]")} ${theme.muted(`v${coreVersion}`)} streaming ${theme.info(`${base}/mockifyer-network-events/stream`)}`,
    theme.muted(
      "mouse on · click req·res·html · m off to select/copy · ↑↓/PgUp scroll · e all · p pause · g/d/f · a/s/r/o · c · h · q",
    ),
    view.statusLine(),
    "",
  ];
  return {
    lines,
    lineHits: lines.map(() => ({ kind: "none" as const })),
  };
}

async function runAnalyze(
  base: string,
  view: MetroAtlasStreamView,
): Promise<void> {
  const json = await jsonGet<{ analysis: MetroNetworkStreamAnalysis }>(
    `${base}/mockifyer-network-events/analyze`,
  );
  const theme = createAtlasStreamColorTheme(view.colorEnabled);
  console.log("");
  console.log(theme.bold("── analyze ──"));
  console.log(
    formatAtlasStreamAnalysisRich(json.analysis, {
      color: theme,
    }),
  );
  console.log(theme.muted("─────────────"));
  view.invalidateRewrite();
}

async function runSnapshot(
  base: string,
  view: MetroAtlasStreamView,
): Promise<void> {
  const json = await jsonPost<{
    count: number;
    jsonPath?: string;
    ndjsonPath?: string;
    harPath?: string;
  }>(`${base}/mockifyer-network-events/snapshot`);
  console.log("");
  console.log(
    `[atlas] snapshot ${json.count} hop(s) → ${json.jsonPath ?? "atlas-events.json"} · ${json.harPath ?? "atlas.har"}`,
  );
  view.invalidateRewrite();
}

/** Fetch hops from Metro and write Atlas HTML under mock-data/atlas-html/. */
async function renderAtlasHtmlLocally(
  base: string,
  view: MetroAtlasStreamView,
): Promise<string | undefined> {
  const json = await jsonGet<{
    success?: boolean;
    events?: NetworkEvent[];
    size?: number;
  }>(`${base}/mockifyer-network-events?limit=2000`);
  const events = Array.isArray(json.events) ? json.events : [];
  const outDir = path.resolve(process.cwd(), "mock-data", "atlas-html");
  const map = createEmptyAtlasDocMap(events[0]?.scenario?.trim() || "default");
  flushNetworkBodySpillsToDir(outDir);
  const written = writeAtlasDocHtml(outDir, map, events);
  const indexPath = path.join(outDir, "index.html");
  if (written <= 0 || !fs.existsSync(indexPath)) {
    console.error(
      `[atlas] local HTML write failed (${written} file(s)) → ${outDir}`,
    );
    view.invalidateRewrite();
    return undefined;
  }
  console.log("");
  console.log(
    `[atlas] generated ${events.length} hop(s) locally → ${path.relative(process.cwd(), outDir) || outDir}`,
  );
  {
    const url = toFileUrl(indexPath);
    const osc = `\u001b]8;;${url}\u0007${indexPath}\u001b]8;;\u0007`;
    console.log(`[atlas] open ${osc}`);
  }
  view.invalidateRewrite();
  return indexPath;
}

/**
 * Always regenerate Atlas HTML (Metro render, with local fallback), then
 * return the on-disk index.html path.
 */
async function runRender(
  base: string,
  view: MetroAtlasStreamView,
): Promise<string | undefined> {
  try {
    const json = await jsonPost<{
      success: boolean;
      hopCount?: number;
      browseUrl?: string;
      outputDir?: string;
      indexPath?: string;
      error?: string;
    }>(`${base}/mockifyer-network-events/render`, {});
    if (json.success) {
      const indexPath = resolveAtlasIndexPath({
        indexPath: json.indexPath,
        outputDir: json.outputDir,
      });
      if (indexPath && fs.existsSync(indexPath)) {
        console.log("");
        console.log(
          `[atlas] generated ${json.hopCount ?? 0} hop(s) → ${json.outputDir ?? "atlas-html"}`,
        );
        {
          const url = toFileUrl(indexPath);
          const osc = `\u001b]8;;${url}\u0007${indexPath}\u001b]8;;\u0007`;
          console.log(`[atlas] open ${osc}`);
        }
        view.invalidateRewrite();
        return indexPath;
      }
      console.warn(
        "[atlas] Metro render returned success but index.html missing — trying local write",
      );
    } else {
      console.warn(
        `[atlas] Metro render failed (${json.error ?? "unknown"}) — trying local write`,
      );
    }
  } catch (e) {
    console.warn(
      `[atlas] Metro render error (${(e as Error).message}) — trying local write`,
    );
  }
  return renderAtlasHtmlLocally(base, view);
}

/** Generate fresh HTML, then open it from disk. */
async function runOpen(
  base: string,
  view: MetroAtlasStreamView,
): Promise<void> {
  const indexPath = await runRender(base, view);
  if (indexPath) openUrl(indexPath);
}

async function runClear(
  base: string,
  view: MetroAtlasStreamView,
): Promise<void> {
  await jsonPost(`${base}/mockifyer-network-events/clear`);
  console.log("[atlas] buffer cleared");
  view.invalidateRewrite();
}

function atlasMouseCoreButton(button: number): number {
  // Strip shift/meta/ctrl modifier bits (4/8/16) from SGR button codes.
  return button & ~0x1c;
}

function isAtlasWheelUp(button: number): boolean {
  // xterm SGR: 64 = wheel up (+ mods); some terminals report button 4.
  const core = atlasMouseCoreButton(button);
  return core === 64 || core === 4;
}

function isAtlasWheelDown(button: number): boolean {
  const core = atlasMouseCoreButton(button);
  return core === 65 || core === 5;
}

function attachInputHandlers(
  base: string,
  view: MetroAtlasStreamView,
  hits: AtlasStreamHitTracker,
  applyPaint: (paint: AtlasStreamPaint) => void,
  onQuit: () => void,
): void {
  if (!process.stdin.isTTY) {
    console.log(
      "[atlas] stdin is not a TTY — streaming only (no click/keys)",
    );
    return;
  }

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  let busy = false;
  let pending = "";
  /** Mouse reporting starts on so click-to-open / expand works. Press m to select/copy. */
  let mouseEnabled = true;
  /** Lines above the live tip currently shown (in-app scrollback). */
  let scrollBack = 0;
  const WHEEL_LINES = 3;

  const screenRows = (): number => process.stdout.rows || 24;

  const setMouseEnabled = (enabled: boolean, message?: string): void => {
    mouseEnabled = enabled;
    if (enabled) {
      enableAtlasStreamMouseTracking();
      console.log(
        message ??
          "[atlas] mouse on — click expand · wheel scroll · m off to select/copy",
      );
    } else {
      disableAtlasStreamMouseTracking();
      console.log(
        message ??
          "[atlas] mouse off — select/copy text · ↑↓/PgUp still scroll · m on for click/wheel",
      );
    }
    view.invalidateRewrite();
  };

  // Default: mouse on so click expand / req·res·html open work out of the box.
  setMouseEnabled(
    true,
    "[atlas] mouse on (default) — click expand · req·res·html · wheel scroll · m off to select/copy",
  );

  const run = async (fn: () => Promise<void>): Promise<void> => {
    if (busy) return;
    busy = true;
    try {
      await fn();
    } catch (e) {
      console.error(`[atlas] ${(e as Error).message}`);
    } finally {
      busy = false;
    }
  };

  const paintScrollWindow = (): void => {
    const rows = screenRows();
    const paint = hits.scrollWindow(scrollBack, rows);
    if (scrollBack > 0) {
      const maxBack = hits.maxScrollBack(rows);
      const status = `[atlas] scrolled up ${scrollBack}/${maxBack} · wheel/↑↓/PgUp/PgDn · p resume`;
      // Replace last viewport row with a sticky status so scroll is obvious.
      if (paint.lines.length > 0) {
        paint.lines[paint.lines.length - 1] = status;
        if (paint.lineHits && paint.lineHits.length > 0) {
          paint.lineHits[paint.lineHits.length - 1] = { kind: "none" };
        }
      } else {
        paint.lines = [status];
        paint.lineHits = [{ kind: "none" }];
      }
    }
    applyPaint(paint);
  };

  const scrollBy = (delta: number): void => {
    const maxBack = hits.maxScrollBack(screenRows());
    if (maxBack <= 0 && delta > 0) {
      if (!view.paused) {
        view.paused = true;
        view.skippedWhilePaused = 0;
        console.log(
          "[atlas] paused — more hops needed before history can scroll",
        );
        view.invalidateRewrite();
      }
      return;
    }
    const next = Math.max(0, Math.min(maxBack, scrollBack + delta));
    if (next === scrollBack && view.paused && delta !== 0) return;
    if (!view.paused) {
      view.paused = true;
      view.skippedWhilePaused = 0;
      console.log(
        "[atlas] paused — wheel/↑↓/PgUp/PgDn scroll history · p/Space resume",
      );
    }
    scrollBack = next;
    paintScrollWindow();
  };

  const setPaused = (paused: boolean, message?: string): void => {
    const wasPaused = view.paused;
    view.paused = paused;
    if (paused) {
      if (!wasPaused) view.skippedWhilePaused = 0;
      // Keep mouse tracking on so wheel events drive in-app history scroll.
      // Cursor/VS Code do not reliably scroll terminal scrollback under mouse
      // reporting, and disabling tracking leaves the user stuck.
      console.log(
        message ??
          "[atlas] paused — wheel/↑↓/PgUp/PgDn scroll history · p/Space to resume",
      );
    } else {
      const skipped = view.skippedWhilePaused;
      view.skippedWhilePaused = 0;
      scrollBack = 0;
      paintScrollWindow();
      console.log(
        message ??
          (skipped > 0
            ? `[atlas] live · skipped ${skipped} while paused`
            : "[atlas] live"),
      );
    }
    view.invalidateRewrite();
  };

  const handleKey = (ch: string): void => {
    if (ch === "\u0003") {
      onQuit();
      return;
    }
    const key = ch.toLowerCase();
    if (key === "q" || ch === "\u001b") {
      onQuit();
      return;
    }
    if (key === "h") {
      showHelp(createAtlasStreamColorTheme(view.colorEnabled));
      view.invalidateRewrite();
      return;
    }
    if (key === "e") {
      scrollBack = 0;
      applyPaint(view.toggleAllExpanded());
      return;
    }
    if (key === "p" || ch === " ") {
      setPaused(!view.paused);
      return;
    }
    if (key === "m") {
      setMouseEnabled(!mouseEnabled);
      return;
    }
    if (key === "g") {
      view.collapseChildren = !view.collapseChildren;
      console.log(view.statusLine());
      view.invalidateRewrite();
      return;
    }
    if (key === "d") {
      view.collapseDuplicates = !view.collapseDuplicates;
      console.log(view.statusLine());
      view.invalidateRewrite();
      return;
    }
    if (key === "f") {
      view.errorsOnly = !view.errorsOnly;
      console.log(view.statusLine());
      view.invalidateRewrite();
      return;
    }
    if (key === "a") {
      void run(() => runAnalyze(base, view));
      return;
    }
    if (key === "s") {
      void run(() => runSnapshot(base, view));
      return;
    }
    if (key === "r") {
      void run(async () => {
        await runRender(base, view);
      });
      return;
    }
    if (key === "o") {
      void run(async () => {
        await runOpen(base, view);
      });
      return;
    }
    if (key === "c") {
      void run(() => runClear(base, view));
    }
  };

  const handleClicks = (
    clicks: ReturnType<typeof consumeAtlasStreamMouseInput>["clicks"],
  ): void => {
    for (const click of clicks) {
      if (click.release) continue;
      if (isAtlasWheelUp(click.button)) {
        scrollBy(WHEEL_LINES);
        continue;
      }
      if (isAtlasWheelDown(click.button)) {
        scrollBy(-WHEEL_LINES);
        continue;
      }
      if (click.button !== 0) continue;
      if (view.paused && scrollBack === 0) continue;
      const hit = hits.hitAtScreenRow(click.row, screenRows());
      if (hit?.kind === "collapse" || hit?.kind === "expand-footer") {
        scrollBack = 0;
        applyPaint(view.toggleParentExpanded(hit.parentId));
        continue;
      }
      if (hit?.kind === "hop-open") {
        const url = resolveAtlasStreamHopOpenUrl(hit, click.col);
        if (url) {
          console.log(`[atlas] opening ${url}`);
          openUrl(url);
        }
      }
    }
  };

    const handleMoves = (
    moves: ReturnType<typeof consumeAtlasStreamMouseInput>["moves"],
  ): void => {
    // Hover mid-screen rewrites are disabled (CUP is unsafe once the buffer
    // fills). Still honor wheel reports if a terminal marks them as motion.
    for (const move of moves) {
      if (move.release) continue;
      if (isAtlasWheelUp(move.button)) scrollBy(WHEEL_LINES);
      else if (isAtlasWheelDown(move.button)) scrollBy(-WHEEL_LINES);
    }
  };

  process.stdin.on("data", (chunk: string) => {
    pending += chunk;
    const { clicks, moves, rest } = consumeAtlasStreamMouseInput(pending);
    handleMoves(moves);
    handleClicks(clicks);

    let keys = rest;
    // Arrow up/down and PageUp/PageDown scroll hop history in-app.
    if (
      /\u001b\[A/.test(keys) ||
      /\u001b\[B/.test(keys) ||
      /\u001b\[5~/.test(keys) ||
      /\u001b\[6~/.test(keys)
    ) {
      keys = keys.replace(/\u001b\[A/g, () => {
        scrollBy(1);
        return "";
      });
      keys = keys.replace(/\u001b\[B/g, () => {
        scrollBy(-1);
        return "";
      });
      keys = keys.replace(/\u001b\[5~/g, () => {
        scrollBy(Math.max(1, screenRows() - 2));
        return "";
      });
      keys = keys.replace(/\u001b\[6~/g, () => {
        scrollBy(-Math.max(1, screenRows() - 2));
        return "";
      });
    }

    const incomplete = keys.match(/\u001b\[<?[\d;]*$/);
    if (incomplete) {
      pending = incomplete[0]!;
      const ready = keys.slice(0, keys.length - pending.length);
      for (const ch of ready) handleKey(ch);
      return;
    }
    pending = "";
    for (const ch of keys) handleKey(ch);
  });
}


function startSseStream(
  base: string,
  backlog: boolean,
  onHop: (event: NetworkEvent) => void,
  onError: (err: Error) => void,
): http.ClientRequest {
  const url = `${base}/mockifyer-network-events/stream?backlog=${backlog ? "1" : "0"}`;
  const req = http.get(url, (res) => {
    if ((res.statusCode ?? 500) >= 400) {
      onError(new Error(`SSE HTTP ${res.statusCode}`));
      return;
    }
    let buf = "";
    res.setEncoding("utf8");
    res.on("data", (chunk: string) => {
      buf += chunk;
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const block of parts) {
        const lines = block.split("\n");
        let eventName = "message";
        const dataLines: string[] = [];
        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trim());
          }
        }
        if (eventName !== "hop" || dataLines.length === 0) continue;
        try {
          onHop(JSON.parse(dataLines.join("\n")) as NetworkEvent);
        } catch {
          // ignore malformed
        }
      }
    });
    res.on("error", (e) => onError(e));
    res.on("end", () =>
      onError(new Error("SSE stream ended — is Metro still running?")),
    );
  });
  req.on("error", onError);
  return req;
}

async function main(): Promise<void> {
  const options = parseArgs();
  const color = shouldUseAtlasStreamColor({
    color: options.color,
    isTTY: process.stdout.isTTY === true,
  });

  if (options.help) {
    showHelp(createAtlasStreamColorTheme(color));
    return;
  }

  const atlasHtmlDir = path.resolve(process.cwd(), "mock-data", "atlas-html");
  const view = new MetroAtlasStreamView({
    color,
    isTTY: process.stdout.isTTY === true,
    collapseChildren: options.expand !== true,
    bodyLinksDir: atlasHtmlDir,
    bodyLinksOpenBaseUrl: metroBase(options),
  });

  const base = metroBase(options);
  const hits = new AtlasStreamHitTracker(
    Math.max(200, (process.stdout.rows || 24) * 4),
  );

  const applyPaint = (paint: AtlasStreamPaint): void => {
    hits.notePaint(paint, process.stdout.rows || 24);
    writeAtlasStreamPaint(paint);
  };

  try {
    await jsonGet(`${base}/mockifyer-network-events?limit=0`);
  } catch (e) {
    console.error(
      `[atlas] cannot reach Metro at ${base} — start Metro with createMockSyncMiddleware.\n  ${(e as Error).message}`,
    );
    process.exit(1);
  }

  // Clear so mouse row → hit mapping starts at the top of the screen.
  if (process.stdout.isTTY) {
    process.stdout.write("\u001b[2J\u001b[H");
  }
  applyPaint(bannerPaint(base, view));

  // Keep hit rows aligned when key handlers print via console.log / error.
  const origLog = console.log.bind(console);
  const origErr = console.error.bind(console);
  console.log = (...args: unknown[]): void => {
    const rendered = args.map((a) => String(a)).join(" ");
    const lines = rendered.length === 0 ? [""] : rendered.split("\n");
    hits.notePaint(
      {
        lines,
        lineHits: lines.map(() => ({ kind: "none" as const })),
      },
      process.stdout.rows || 24,
    );
    origLog(...args);
  };
  console.error = (...args: unknown[]): void => {
    const rendered = args.map((a) => String(a)).join(" ");
    const lines = rendered.length === 0 ? [""] : rendered.split("\n");
    hits.notePaint(
      {
        lines,
        lineHits: lines.map(() => ({ kind: "none" as const })),
      },
      process.stdout.rows || 24,
    );
    origErr(...args);
  };

  let sseReq: http.ClientRequest | null = null;
  const quit = (): void => {
    disableAtlasStreamMouseTracking();
    console.log("\n[atlas] bye");
    try {
      sseReq?.destroy();
    } catch {
      // ignore
    }
    if (process.stdin.isTTY) {
      try {
        process.stdin.setRawMode(false);
      } catch {
        // ignore
      }
    }
    process.exit(0);
  };

  attachInputHandlers(base, view, hits, applyPaint, quit);

  let linkTipShown = false;
  sseReq = startSseStream(
    base,
    options.backlog !== false,
    (event) => {
      if (view.paused) {
        view.skippedWhilePaused += 1;
        return;
      }
      {
        if (!linkTipShown && view.bodyLinksOpenBaseUrl) {
          linkTipShown = true;
          console.log(
            "[atlas] tip: click underlined req·res·html (mouse on). Press m to select/copy text.",
          );
        }
        applyPaint(view.push(event));
      }
    },
    (err) => {
      console.error(`[atlas] stream: ${err.message}`);
      quit();
    },
  );
}

void main();
