/**
 * Colored / collapsible terminal presentation for `mockifyer-atlas` hop stream.
 * Zero deps — raw ANSI (honors NO_COLOR / FORCE_COLOR).
 */

import type { NetworkEvent } from "./network-event-types";
import {
  DEFAULT_METRO_NETWORK_STREAM_SLOW_MS,
  formatMetroNetworkAnalysis,
  isMetroNetworkErrorHop,
  isMetroNetworkSlowHop,
  type MetroNetworkStreamAnalysis,
} from "./metro-network-stream";

const ESC = "\u001b[";

export interface AtlasStreamColorTheme {
  enabled: boolean;
  dim: (s: string) => string;
  bold: (s: string) => string;
  reset: string;
  method: (method: string) => string;
  status: (status: number | undefined, isError: boolean) => string;
  source: (source: string) => string;
  duration: (ms: number | undefined, slow: boolean) => string;
  path: (s: string, emphasize: boolean) => string;
  ok: (s: string) => string;
  warn: (s: string) => string;
  err: (s: string) => string;
  info: (s: string) => string;
  muted: (s: string) => string;
}

function wrap(enabled: boolean, code: string, s: string): string {
  if (!enabled || !s) return s;
  return `${ESC}${code}m${s}${ESC}0m`;
}

/** Resolve whether ANSI colors should be used. */
export function shouldUseAtlasStreamColor(options?: {
  color?: boolean;
  isTTY?: boolean;
}): boolean {
  if (options?.color === false) return false;
  if (options?.color === true) return true;
  if (typeof process !== "undefined") {
    const noColor = process.env.NO_COLOR;
    if (noColor != null && noColor !== "") return false;
    const force = process.env.FORCE_COLOR;
    if (force === "0") return false;
    if (force && force !== "") return true;
  }
  return options?.isTTY ?? false;
}

export function createAtlasStreamColorTheme(
  enabled: boolean,
): AtlasStreamColorTheme {
  const on = enabled;
  return {
    enabled: on,
    dim: (s) => wrap(on, "2", s),
    bold: (s) => wrap(on, "1", s),
    reset: on ? `${ESC}0m` : "",
    method: (method) => {
      const m = method.toUpperCase();
      if (m === "GET") return wrap(on, "36", m); // cyan
      if (m === "POST") return wrap(on, "33", m); // yellow
      if (m === "PUT" || m === "PATCH") return wrap(on, "35", m); // magenta
      if (m === "DELETE") return wrap(on, "31", m); // red
      return wrap(on, "37", m);
    },
    status: (status, isError) => {
      if (status == null) {
        return isError ? wrap(on, "31;1", "ERR") : wrap(on, "2", "  -");
      }
      const text = String(status).padStart(3);
      if (status >= 500 || isError) return wrap(on, "31;1", text);
      if (status >= 400) return wrap(on, "33;1", text);
      if (status >= 300) return wrap(on, "36", text);
      return wrap(on, "32", text);
    },
    source: (source) => {
      const s = source.padEnd(10);
      if (source === "mock-hit") return wrap(on, "32", s);
      if (source === "upstream") return wrap(on, "37", s);
      if (source === "error" || source === "blocked") return wrap(on, "31", s);
      if (source === "mock-miss") return wrap(on, "33", s);
      return wrap(on, "2", s);
    },
    duration: (ms, slow) => {
      if (ms == null || !Number.isFinite(ms)) return wrap(on, "2", "      -");
      const text = `${Math.round(ms)}ms`.padStart(7);
      if (slow) return wrap(on, "33;1", text);
      if (ms >= 1000) return wrap(on, "33", text);
      return wrap(on, "2", text);
    },
    path: (s, emphasize) => (emphasize ? wrap(on, "1", s) : s),
    ok: (s) => wrap(on, "32", s),
    warn: (s) => wrap(on, "33", s),
    err: (s) => wrap(on, "31;1", s),
    info: (s) => wrap(on, "36", s),
    muted: (s) => wrap(on, "2", s),
  };
}

export interface FormatAtlasStreamHopOptions {
  color?: AtlasStreamColorTheme;
  /** Tree depth (0 = root). */
  depth?: number;
  /** Show as last sibling branch (`└─`) vs `├─`. */
  isLast?: boolean;
  /** Appended after path, e.g. `×3` for collapsed duplicates. */
  repeatSuffix?: string;
  /** Max path columns before truncate. */
  maxPathCols?: number;
}

function firstUsageScreen(usage: NetworkEvent["usage"]): string | undefined {
  if (!usage) return undefined;
  if (Array.isArray(usage)) {
    for (const u of usage) {
      const s = u.screen?.trim();
      if (s) return s;
    }
    return undefined;
  }
  return usage.screen?.trim() || undefined;
}

function truncatePath(path: string, maxCols: number): string {
  if (maxCols < 12 || path.length <= maxCols) return path;
  return `…${path.slice(-(maxCols - 1))}`;
}

function treePrefix(
  depth: number,
  isLast: boolean,
  theme: AtlasStreamColorTheme,
): string {
  if (depth <= 0) return "";
  const indent = theme.muted("│  ".repeat(Math.max(0, depth - 1)));
  const branch = theme.muted(isLast ? "└─ " : "├─ ");
  return indent + branch;
}

/**
 * Rich single-hop line (colors + optional tree indent).
 * Plain {@link formatMetroNetworkHopLine} remains for non-TTY / tests.
 */
export function formatAtlasStreamHopLine(
  event: NetworkEvent,
  options?: FormatAtlasStreamHopOptions,
): string {
  const theme = options?.color ?? createAtlasStreamColorTheme(false);
  const depth = options?.depth ?? 0;
  const isLast = options?.isLast ?? true;
  const maxPathCols = options?.maxPathCols ?? 72;
  const err = isMetroNetworkErrorHop(event);
  const slow = isMetroNetworkSlowHop(event);

  const ts = theme.muted(
    event.timestamp ? event.timestamp.slice(11, 23) : "--:--:--.---",
  );
  const methodRaw = (event.method || "?").toUpperCase();
  const methodCol = theme.method(methodRaw.padEnd(6));
  const statusCol = theme.status(event.status, err);
  const msCol = theme.duration(
    typeof event.durationMs === "number" ? event.durationMs : undefined,
    slow,
  );
  const sourceCol = theme.source(event.source || "");
  const pathRaw = truncatePath(event.path || event.url || "/", maxPathCols);
  const pathCol = theme.path(pathRaw, err || slow);

  const badges: string[] = [];
  if (err) badges.push(theme.err("ERR"));
  if (slow) badges.push(theme.warn("SLOW"));
  const screen = firstUsageScreen(event.usage);
  if (screen) badges.push(theme.info(screen));
  if (options?.repeatSuffix) badges.push(theme.bold(options.repeatSuffix));

  const badgeStr = badges.length ? `  ${badges.join(" ")}` : "";
  const prefix = treePrefix(depth, isLast, theme);

  return `${prefix}${ts}  ${methodCol} ${statusCol}  ${msCol}  ${sourceCol}  ${pathCol}${badgeStr}`;
}

/** Collapsed nested-hops summary under a parent. */
export function formatAtlasStreamCollapseSummary(
  parent: NetworkEvent,
  children: readonly NetworkEvent[],
  options?: { color?: AtlasStreamColorTheme; expandedHint?: boolean },
): string {
  const theme = options?.color ?? createAtlasStreamColorTheme(false);
  const n = children.length;
  let errors = 0;
  let slow = 0;
  let totalMs = 0;
  for (const c of children) {
    if (isMetroNetworkErrorHop(c)) errors += 1;
    if (isMetroNetworkSlowHop(c)) slow += 1;
    if (typeof c.durationMs === "number") totalMs += c.durationMs;
  }
  const parts = [`${n} nested`];
  if (errors) parts.push(theme.err(`${errors} err`));
  if (slow) parts.push(theme.warn(`${slow} slow`));
  if (totalMs > 0) parts.push(theme.muted(`${Math.round(totalMs)}ms`));
  const hint =
    options?.expandedHint === false ? "" : theme.muted("  · click/e expand");
  const glyph = theme.muted("▸");
  return `${theme.muted("│  └─ ")}${glyph} ${parts.join(" · ")}${hint}`;
}


/** Footer under an expanded child list (click to collapse). */
export function formatAtlasStreamExpandFooter(
  _parentId: string,
  childCount: number,
  options?: { color?: AtlasStreamColorTheme },
): string {
  const theme = options?.color ?? createAtlasStreamColorTheme(false);
  return `${theme.muted("│  └─ ")}${theme.muted("▾")} ${theme.muted(
    `${childCount} nested · click/e collapse`,
  )}`;
}

export function formatAtlasStreamAnalysisRich(
  analysis: MetroNetworkStreamAnalysis,
  options?: { color?: AtlasStreamColorTheme; slowMs?: number },
): string {
  const theme = options?.color ?? createAtlasStreamColorTheme(false);
  const plain = formatMetroNetworkAnalysis(analysis, {
    slowMs: options?.slowMs,
  });
  if (!theme.enabled) return plain;

  const lines = plain.split("\n");
  return lines
    .map((line, i) => {
      if (i === 0) {
        return line
          .replace(/errors=(\d+)/, (_, n) =>
            Number(n) > 0 ? theme.err(`errors=${n}`) : theme.ok(`errors=${n}`),
          )
          .replace(/slow\([^)]+\)=(\d+)/, (m, n) =>
            Number(n) > 0 ? theme.warn(m) : theme.muted(m),
          );
      }
      if (line.startsWith("slowest:") || line.startsWith("recent errors:")) {
        return theme.bold(line);
      }
      return theme.muted(line.startsWith("  ") ? line : line);
    })
    .join("\n");
}

export interface AtlasStreamViewOptions {
  color?: boolean;
  isTTY?: boolean;
  /** Default collapse for parents that are not click-expanded (default true). */
  collapseChildren?: boolean;
  /** Collapse consecutive identical root hops into ×N (default true). */
  collapseDuplicates?: boolean;
  /** Only show error hops (and their parents). */
  errorsOnly?: boolean;
  maxPathCols?: number;
  slowMs?: number;
}

export type AtlasStreamLineHit =
  | { kind: "none" }
  | { kind: "collapse"; parentId: string }
  | { kind: "expand-footer"; parentId: string };

export interface AtlasStreamPaint {
  /** Full lines to write (caller should print each with newline, except rewrite). */
  lines: string[];
  /**
   * When > 0, move cursor up and clear that many lines before printing `lines`
   * (used to refresh a collapse / duplicate summary in place).
   */
  erasePreviousLines?: number;
  /** Parallel to `lines` — mouse click targets. */
  lineHits?: AtlasStreamLineHit[];
  /**
   * Clear the terminal and paint from the top. Used when expanding/collapsing a
   * mid-screen row so children appear under the clicked parent (not at the cursor).
   */
  clearScreen?: boolean;
}

interface DuplicateStreak {
  key: string;
  count: number;
  event: NetworkEvent;
}

/**
 * Stateful stream presenter with per-parent expand/collapse (click or `e` on last).
 */
export class MetroAtlasStreamView {
  private theme: AtlasStreamColorTheme;
  collapseChildren: boolean;
  collapseDuplicates: boolean;
  errorsOnly: boolean;
  maxPathCols: number;
  slowMs: number;

  private readonly childrenByParent = new Map<string, NetworkEvent[]>();
  private readonly eventsByRequestId = new Map<string, NetworkEvent>();
  /** Root request ids in paint order (for full redraw on mid-screen toggle). */
  private readonly rootOrder: string[] = [];
  private static readonly MAX_ROOTS = 200;
  /** Per-parent override; when unset, falls back to `!collapseChildren`. */
  private readonly expandOverride = new Map<string, boolean>();
  private readonly expandedBlocks = new Map<
    string,
    { childLines: number; hasFooter: boolean }
  >();
  private duplicate: DuplicateStreak | null = null;
  /** Last paint was a rewritable summary (collapse, duplicate, or expand footer). */
  private lastRewritable: "collapse" | "duplicate" | "expand-footer" | null =
    null;
  private lastCollapseParentId: string | null = null;
  /** Most recent collapse/footer parent — keyboard `e` toggles this item. */
  private lastInteractiveParentId: string | null = null;

  constructor(options?: AtlasStreamViewOptions) {
    this.theme = createAtlasStreamColorTheme(
      shouldUseAtlasStreamColor({
        color: options?.color,
        isTTY: options?.isTTY,
      }),
    );
    this.collapseChildren = options?.collapseChildren !== false;
    this.collapseDuplicates = options?.collapseDuplicates !== false;
    this.errorsOnly = options?.errorsOnly === true;
    this.maxPathCols = options?.maxPathCols ?? 72;
    this.slowMs = options?.slowMs ?? DEFAULT_METRO_NETWORK_STREAM_SLOW_MS;
  }

  get colorEnabled(): boolean {
    return this.theme.enabled;
  }

  setColorEnabled(enabled: boolean): void {
    this.theme = createAtlasStreamColorTheme(enabled);
  }

  /** Call after printing unrelated console output so ANSI erase cannot wipe it. */
  invalidateRewrite(): void {
    this.lastRewritable = null;
    this.lastCollapseParentId = null;
  }

  getLastInteractiveParentId(): string | null {
    return this.lastInteractiveParentId;
  }

  isParentExpanded(parentId: string): boolean {
    const override = this.expandOverride.get(parentId);
    if (override !== undefined) return override;
    return this.collapseChildren === false;
  }

  statusLine(): string {
    const bits = [
      this.collapseChildren ? "collapse=on" : "collapse=off",
      this.collapseDuplicates ? "dedupe=on" : "dedupe=off",
      this.errorsOnly ? "errors-only" : "all",
      this.theme.enabled ? "color" : "plain",
    ];
    return this.theme.muted(
      `[atlas] view · ${bits.join(" · ")}  (click ▸ · e last · g/d/f)`,
    );
  }

  /** Ingest one hop; returns what to paint. */
  push(event: NetworkEvent): AtlasStreamPaint {
    const requestId = event.requestId?.trim() || event.id;
    this.eventsByRequestId.set(requestId, event);

    const parentId = event.parentRequestId?.trim() || "";
    if (parentId) {
      const list = this.childrenByParent.get(parentId) ?? [];
      list.push(event);
      this.childrenByParent.set(parentId, list);
      return this.paintChild(event, parentId, list);
    }

    return this.paintRoot(event, requestId);
  }

  /**
   * Toggle one parent (mouse click / keyboard `e` on last interactive row).
   * Always redraws the full view so mid-screen clicks expand in place — not at
   * the bottom cursor.
   */
  toggleParentExpanded(parentId: string): AtlasStreamPaint {
    const children = this.childrenByParent.get(parentId) ?? [];
    if (children.length === 0) return { lines: [] };

    const next = !this.isParentExpanded(parentId);
    this.expandOverride.set(parentId, next);
    this.lastInteractiveParentId = parentId;

    if (next) {
      const visible = this.visibleChildren(children);
      this.expandedBlocks.set(parentId, {
        childLines: visible.length,
        hasFooter: true,
      });
    } else {
      this.expandedBlocks.delete(parentId);
    }

    return this.rebuildView();
  }

  /**
   * Rebuild the entire hop view from stored roots/children with current expand
   * state. Clears the screen so click targets stay aligned with painted rows.
   */
  rebuildView(): AtlasStreamPaint {
    const lines: string[] = [];
    const lineHits: AtlasStreamLineHit[] = [];
    lines.push(this.statusLine(), "");
    lineHits.push({ kind: "none" }, { kind: "none" });

    let duplicate: DuplicateStreak | null = null;
    let lastHadChildren = false;
    this.expandedBlocks.clear();

    for (const rootId of this.rootOrder) {
      const event = this.eventsByRequestId.get(rootId);
      if (!event) continue;

      const children = this.childrenByParent.get(rootId) ?? [];
      if (this.errorsOnly) {
        const rootErr = isMetroNetworkErrorHop(event);
        const childErr = children.some((c) => isMetroNetworkErrorHop(c));
        if (!rootErr && !childErr) continue;
      }

      const key = duplicateKey(event);
      const canDedupe =
        this.collapseDuplicates &&
        !lastHadChildren &&
        duplicate != null &&
        duplicate.key === key;

      if (canDedupe && duplicate) {
        duplicate.count += 1;
        duplicate.event = event;
        const line = formatAtlasStreamHopLine(event, {
          color: this.theme,
          maxPathCols: this.maxPathCols,
          repeatSuffix: `×${duplicate.count}`,
        });
        // Replace the previous root-only line (no children were under it).
        lines[lines.length - 1] = line;
        lineHits[lineHits.length - 1] = { kind: "none" };
        lastHadChildren = false;
        continue;
      }

      duplicate = { key, count: 1, event };
      lines.push(
        formatAtlasStreamHopLine(event, {
          color: this.theme,
          maxPathCols: this.maxPathCols,
        }),
      );
      lineHits.push({ kind: "none" });

      if (children.length === 0) {
        lastHadChildren = false;
        continue;
      }

      lastHadChildren = true;
      duplicate = null;
      this.appendChildrenBlock(rootId, children, lines, lineHits);
    }

    // Keep incremental child updates working after a redraw.
    this.duplicate = null;
    if (this.lastInteractiveParentId) {
      const expanded = this.isParentExpanded(this.lastInteractiveParentId);
      this.lastRewritable = expanded ? "expand-footer" : "collapse";
      this.lastCollapseParentId = this.lastInteractiveParentId;
    } else {
      this.lastRewritable = null;
      this.lastCollapseParentId = null;
    }

    return { lines, lineHits, clearScreen: true };
  }

  private appendChildrenBlock(
    parentId: string,
    children: NetworkEvent[],
    lines: string[],
    lineHits: AtlasStreamLineHit[],
  ): void {
    const expanded = this.isParentExpanded(parentId);
    if (!expanded) {
      const parent = this.eventsByRequestId.get(parentId);
      lines.push(
        formatAtlasStreamCollapseSummary(parent ?? children[0]!, children, {
          color: this.theme,
        }),
      );
      lineHits.push({ kind: "collapse", parentId });
      return;
    }

    const visible = this.visibleChildren(children);
    for (let i = 0; i < visible.length; i++) {
      lines.push(
        formatAtlasStreamHopLine(visible[i]!, {
          color: this.theme,
          depth: 1,
          isLast: i === visible.length - 1,
          maxPathCols: this.maxPathCols,
        }),
      );
      lineHits.push({ kind: "none" });
    }
    lines.push(
      formatAtlasStreamExpandFooter(parentId, children.length, {
        color: this.theme,
      }),
    );
    lineHits.push({ kind: "expand-footer", parentId });
    this.expandedBlocks.set(parentId, {
      childLines: visible.length,
      hasFooter: true,
    });
  }

  private visibleChildren(children: NetworkEvent[]): NetworkEvent[] {
    if (!this.errorsOnly) return children;
    return children.filter((c) => isMetroNetworkErrorHop(c));
  }

  private paintRoot(event: NetworkEvent, requestId: string): AtlasStreamPaint {
    if (this.errorsOnly && !isMetroNetworkErrorHop(event)) {
      return { lines: [] };
    }

    const key = duplicateKey(event);
    if (
      this.collapseDuplicates &&
      this.duplicate &&
      this.duplicate.key === key
    ) {
      this.duplicate.count += 1;
      this.duplicate.event = event;
      // Still track for redraw — consecutive identical roots share one display slot.
      this.rootOrder.push(requestId);
      if (this.rootOrder.length > MetroAtlasStreamView.MAX_ROOTS) {
        this.rootOrder.splice(
          0,
          this.rootOrder.length - MetroAtlasStreamView.MAX_ROOTS,
        );
      }
      const line = formatAtlasStreamHopLine(event, {
        color: this.theme,
        maxPathCols: this.maxPathCols,
        repeatSuffix: `×${this.duplicate.count}`,
      });
      const erase = this.lastRewritable === "duplicate" ? 1 : 0;
      this.lastRewritable = "duplicate";
      // Keep lastCollapseParentId so interleaved roots do not detach child rewrites.
      return {
        lines: [line],
        erasePreviousLines: erase,
        lineHits: [{ kind: "none" }],
      };
    }

    this.duplicate = { key, count: 1, event };
    this.lastRewritable = this.collapseDuplicates ? "duplicate" : null;
    this.rootOrder.push(requestId);
    if (this.rootOrder.length > MetroAtlasStreamView.MAX_ROOTS) {
      this.rootOrder.splice(
        0,
        this.rootOrder.length - MetroAtlasStreamView.MAX_ROOTS,
      );
    }
    return {
      lines: [
        formatAtlasStreamHopLine(event, {
          color: this.theme,
          maxPathCols: this.maxPathCols,
        }),
      ],
      lineHits: [{ kind: "none" }],
    };
  }

  private paintChild(
    event: NetworkEvent,
    parentId: string,
    children: NetworkEvent[],
  ): AtlasStreamPaint {
    if (this.errorsOnly && !isMetroNetworkErrorHop(event)) {
      // Still track in children map for when filter turns off — already stored
      return { lines: [] };
    }

    this.duplicate = null;
    this.lastInteractiveParentId = parentId;
    const expanded = this.isParentExpanded(parentId);

    if (!expanded) {
      const parent = this.eventsByRequestId.get(parentId);
      const summary = formatAtlasStreamCollapseSummary(
        parent ?? event,
        children,
        { color: this.theme },
      );
      const erase =
        this.lastRewritable === "collapse" &&
        this.lastCollapseParentId === parentId
          ? 1
          : 0;
      this.lastRewritable = "collapse";
      this.lastCollapseParentId = parentId;
      return {
        lines: [summary],
        erasePreviousLines: erase,
        lineHits: [{ kind: "collapse", parentId }],
      };
    }

    const block = this.expandedBlocks.get(parentId);
    const eraseFooter =
      this.lastRewritable === "expand-footer" &&
      this.lastCollapseParentId === parentId &&
      block?.hasFooter
        ? 1
        : 0;

    const childLine = formatAtlasStreamHopLine(event, {
      color: this.theme,
      depth: 1,
      isLast: true,
      maxPathCols: this.maxPathCols,
    });
    const footer = formatAtlasStreamExpandFooter(parentId, children.length, {
      color: this.theme,
    });
    this.expandedBlocks.set(parentId, {
      childLines: (block?.childLines ?? 0) + 1,
      hasFooter: true,
    });
    this.expandOverride.set(parentId, true);
    this.lastRewritable = "expand-footer";
    this.lastCollapseParentId = parentId;
    return {
      lines: [childLine, footer],
      erasePreviousLines: eraseFooter,
      lineHits: [{ kind: "none" }, { kind: "expand-footer", parentId }],
    };
  }
}



function duplicateKey(event: NetworkEvent): string {
  const method = (event.method || "").toUpperCase();
  const path = event.path || event.url || "";
  const status = event.status ?? "";
  const source = event.source || "";
  return `${method}|${path}|${status}|${source}`;
}

export function writeAtlasStreamPaint(
  paint: AtlasStreamPaint,
  write: (s: string) => void = (s) => {
    process.stdout.write(s);
  },
): void {
  if (paint.clearScreen) {
    write(`${ESC}2J${ESC}H`);
  } else if (paint.lines.length === 0) {
    return;
  } else {
    const erase = paint.erasePreviousLines ?? 0;
    for (let i = 0; i < erase; i++) {
      write(`${ESC}1A${ESC}2K`);
    }
  }
  for (const line of paint.lines) {
    write(`${line}\n`);
  }
}

/** Track painted line hits for mouse click → parent expand/collapse. */
export class AtlasStreamHitTracker {
  private hits: AtlasStreamLineHit[] = [];
  private maxLines: number;

  constructor(maxLines = 200) {
    this.maxLines = Math.max(20, maxLines);
  }

  setMaxLines(n: number): void {
    this.maxLines = Math.max(20, n);
    if (this.hits.length > this.maxLines) {
      this.hits = this.hits.slice(-this.maxLines);
    }
  }

  notePaint(paint: AtlasStreamPaint): void {
    if (paint.clearScreen) {
      this.hits = [];
    } else {
      const erase = paint.erasePreviousLines ?? 0;
      if (erase > 0) {
        this.hits.splice(Math.max(0, this.hits.length - erase), erase);
      }
    }
    const lineHits =
      paint.lineHits ??
      paint.lines.map((): AtlasStreamLineHit => ({ kind: "none" }));
    for (let i = 0; i < paint.lines.length; i++) {
      this.hits.push(lineHits[i] ?? { kind: "none" });
    }
    if (this.hits.length > this.maxLines) {
      this.hits = this.hits.slice(-this.maxLines);
    }
  }

  /**
   * Map a 1-based mouse row to a hit. Assumes stream content starts at the top
   * of the screen (CLI clears on start) and then scrolls normally.
   */
  hitAtScreenRow(row: number, screenRows: number): AtlasStreamLineHit | null {
    if (
      !Number.isFinite(row) ||
      !Number.isFinite(screenRows) ||
      screenRows < 1
    ) {
      return null;
    }
    const r = Math.floor(row);
    if (r < 1 || r > screenRows || this.hits.length === 0) return null;

    if (this.hits.length <= screenRows) {
      const idx = r - 1;
      if (idx >= this.hits.length) return null;
      return this.hits[idx] ?? null;
    }

    const idx = this.hits.length - screenRows + (r - 1);
    if (idx < 0 || idx >= this.hits.length) return null;
    return this.hits[idx] ?? null;
  }
}

export function enableAtlasStreamMouseTracking(
  write: (s: string) => void = (s) => process.stdout.write(s),
): void {
  write(`${ESC}?1000h${ESC}?1006h`);
}

export function disableAtlasStreamMouseTracking(
  write: (s: string) => void = (s) => process.stdout.write(s),
): void {
  write(`${ESC}?1000l${ESC}?1006l`);
}

export interface AtlasStreamMouseClick {
  button: number;
  col: number;
  row: number;
  release: boolean;
}

/** Parse xterm SGR mouse sequences; return clicks + leftover key text. */
export function consumeAtlasStreamMouseInput(chunk: string): {
  clicks: AtlasStreamMouseClick[];
  rest: string;
} {
  const clicks: AtlasStreamMouseClick[] = [];
  const re = /\u001b\[<(\d+);(\d+);(\d+)([Mm])/g;
  let match: RegExpExecArray | null;
  let cursor = 0;
  const kept: string[] = [];
  while ((match = re.exec(chunk)) != null) {
    if (match.index > cursor) kept.push(chunk.slice(cursor, match.index));
    clicks.push({
      button: Number.parseInt(match[1]!, 10),
      col: Number.parseInt(match[2]!, 10),
      row: Number.parseInt(match[3]!, 10),
      release: match[4] === "m",
    });
    cursor = match.index + match[0].length;
  }
  if (cursor < chunk.length) kept.push(chunk.slice(cursor));
  return { clicks, rest: kept.join("") };
}
