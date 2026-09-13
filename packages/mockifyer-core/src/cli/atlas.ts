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
 *   r  render Atlas HTML from buffer + print browse URL
 *   o  open rendered Atlas HTML in browser
 *   e  expand/collapse the last nested group
 *   g  toggle default collapse for new nested hops
 *   d  toggle collapse duplicate consecutive roots (×N)
 *   f  toggle errors-only filter
 *   c  clear Metro ring buffer
 *   h  help
 *   q  quit
 */

import http from "http";
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
  formatAtlasStreamHoverLine,
  rewriteAtlasStreamScreenRow,
} from "../utils/metro-network-stream-tty";
import type { AtlasStreamPaint } from "../utils/metro-network-stream-tty";

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
  ${theme.info("e")}  Expand/collapse the last nested group
  ${theme.info("g")}  Toggle default collapse for new nested hops
  ${theme.info("d")}  Toggle collapse duplicate consecutive roots (×N)
  ${theme.info("f")}  Toggle errors-only filter
  ${theme.info("a")}  Analyze buffer (counts, slow, errors)
  ${theme.info("s")}  Snapshot → atlas-html/atlas-events.json + .ndjson + .har
  ${theme.info("r")}  Render Atlas HTML from buffer hops
  ${theme.info("o")}  Open Atlas HTML in the default browser
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

function openUrl(url: string): void {
  const platform = process.platform;
  const cmd =
    platform === "darwin"
      ? `open "${url}"`
      : platform === "win32"
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) {
      console.error(`[atlas] could not open browser: ${err.message}`);
      console.log(`[atlas] open manually: ${url}`);
    }
  });
}

function bannerPaint(base: string, view: MetroAtlasStreamView): AtlasStreamPaint {
  const theme = createAtlasStreamColorTheme(view.colorEnabled);
  const lines = [
    `${theme.bold("[atlas]")} streaming ${theme.info(`${base}/mockifyer-network-events/stream`)}`,
    theme.muted(
      "click ▸ nested to expand · e last · g/d/f view · a/s/r/o · c clear · h help · q quit",
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

async function runRender(
  base: string,
  view: MetroAtlasStreamView,
): Promise<string | undefined> {
  const json = await jsonPost<{
    success: boolean;
    hopCount?: number;
    browseUrl?: string;
    outputDir?: string;
    error?: string;
  }>(`${base}/mockifyer-network-events/render`, {});
  if (!json.success) {
    console.error(`[atlas] render failed: ${json.error ?? "unknown"}`);
    view.invalidateRewrite();
    return undefined;
  }
  const browse = `${base}${json.browseUrl ?? "/mockifyer-atlas-html/"}`;
  console.log("");
  console.log(
    `[atlas] rendered ${json.hopCount ?? 0} hop(s) → ${json.outputDir ?? "atlas-html"}`,
  );
  console.log(`[atlas] browse ${browse}`);
  view.invalidateRewrite();
  return browse;
}

async function runClear(
  base: string,
  view: MetroAtlasStreamView,
): Promise<void> {
  await jsonPost(`${base}/mockifyer-network-events/clear`);
  console.log("[atlas] buffer cleared");
  view.invalidateRewrite();
}

function attachInputHandlers(
  base: string,
  view: MetroAtlasStreamView,
  hits: AtlasStreamHitTracker,
  applyPaint: (paint: AtlasStreamPaint) => void,
  clearHover: () => void,
  setHoverRow: (row: number | null) => void,
  getHoverRow: () => number | null,
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
  enableAtlasStreamMouseTracking();

  let busy = false;
  let pending = "";

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
      const parentId = view.getLastInteractiveParentId();
      if (parentId) {
        applyPaint(view.toggleParentExpanded(parentId));
      } else {
        view.collapseChildren = !view.collapseChildren;
        console.log(view.statusLine());
        view.invalidateRewrite();
      }
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
        const browse = await runRender(base, view);
        if (browse) openUrl(browse);
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
      if (click.release || click.button !== 0) continue;
      const hit = hits.hitAtScreenRow(click.row, process.stdout.rows || 24);
      if (hit?.kind === "collapse" || hit?.kind === "expand-footer") {
        applyPaint(view.toggleParentExpanded(hit.parentId));
      }
    }
  };

  const handleMoves = (
    moves: ReturnType<typeof consumeAtlasStreamMouseInput>["moves"],
  ): void => {
    if (moves.length === 0) return;
    const move = moves[moves.length - 1]!;
    const rows = process.stdout.rows || 24;
    const row = move.row;
    if (getHoverRow() === row) return;

    clearHover();

    const hit = hits.hitAtScreenRow(row, rows);
    if (hit?.kind !== "collapse" && hit?.kind !== "expand-footer") return;

    const original = hits.lineAtScreenRow(row, rows);
    if (original == null) return;
    rewriteAtlasStreamScreenRow(row, formatAtlasStreamHoverLine(original));
    setHoverRow(row);
  };

  process.stdin.on("data", (chunk: string) => {
    pending += chunk;
    const { clicks, moves, rest } = consumeAtlasStreamMouseInput(pending);
    handleMoves(moves);
    handleClicks(clicks);
    const incomplete = rest.match(/\u001b\[<?[\d;]*$/);
    if (incomplete) {
      pending = incomplete[0]!;
      const keys = rest.slice(0, rest.length - pending.length);
      for (const ch of keys) handleKey(ch);
      return;
    }
    pending = "";
    for (const ch of rest) handleKey(ch);
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

  const view = new MetroAtlasStreamView({
    color,
    isTTY: process.stdout.isTTY === true,
    collapseChildren: options.expand !== true,
  });

  const base = metroBase(options);
  const hits = new AtlasStreamHitTracker(
    Math.max(200, (process.stdout.rows || 24) * 4),
  );

  let hoverRow: number | null = null;
  const clearHover = (): void => {
    if (hoverRow == null) return;
    const rows = process.stdout.rows || 24;
    const original = hits.lineAtScreenRow(hoverRow, rows);
    if (original != null) {
      rewriteAtlasStreamScreenRow(hoverRow, original);
    }
    hoverRow = null;
  };

  const applyPaint = (paint: AtlasStreamPaint): void => {
    clearHover();
    hits.notePaint(paint);
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
    hits.notePaint({
      lines,
      lineHits: lines.map(() => ({ kind: "none" as const })),
    });
    origLog(...args);
  };
  console.error = (...args: unknown[]): void => {
    const rendered = args.map((a) => String(a)).join(" ");
    const lines = rendered.length === 0 ? [""] : rendered.split("\n");
    hits.notePaint({
      lines,
      lineHits: lines.map(() => ({ kind: "none" as const })),
    });
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

  attachInputHandlers(
    base,
    view,
    hits,
    applyPaint,
    clearHover,
    (row) => {
      hoverRow = row;
    },
    () => hoverRow,
    quit,
  );

  sseReq = startSseStream(
    base,
    options.backlog !== false,
    (event) => {
      applyPaint(view.push(event));
    },
    (err) => {
      console.error(`[atlas] stream: ${err.message}`);
      quit();
    },
  );
}

void main();
