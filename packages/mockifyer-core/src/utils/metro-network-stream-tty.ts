/**
 * Colored / collapsible terminal presentation for `mockifyer-atlas` hop stream.
 * Zero deps — raw ANSI (honors NO_COLOR / FORCE_COLOR).
 */

import type { NetworkEvent } from './network-event-types';
import {
  DEFAULT_METRO_NETWORK_STREAM_SLOW_MS,
  formatMetroNetworkAnalysis,
  isMetroNetworkErrorHop,
  isMetroNetworkSlowHop,
  type MetroNetworkStreamAnalysis,
} from './metro-network-stream';

const ESC = '\u001b[';

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
  if (typeof process !== 'undefined') {
    const noColor = process.env.NO_COLOR;
    if (noColor != null && noColor !== '') return false;
    const force = process.env.FORCE_COLOR;
    if (force === '0') return false;
    if (force && force !== '') return true;
  }
  return options?.isTTY ?? false;
}

export function createAtlasStreamColorTheme(enabled: boolean): AtlasStreamColorTheme {
  const on = enabled;
  return {
    enabled: on,
    dim: (s) => wrap(on, '2', s),
    bold: (s) => wrap(on, '1', s),
    reset: on ? `${ESC}0m` : '',
    method: (method) => {
      const m = method.toUpperCase();
      if (m === 'GET') return wrap(on, '36', m); // cyan
      if (m === 'POST') return wrap(on, '33', m); // yellow
      if (m === 'PUT' || m === 'PATCH') return wrap(on, '35', m); // magenta
      if (m === 'DELETE') return wrap(on, '31', m); // red
      return wrap(on, '37', m);
    },
    status: (status, isError) => {
      if (status == null) {
        return isError ? wrap(on, '31;1', 'ERR') : wrap(on, '2', '  -');
      }
      const text = String(status).padStart(3);
      if (status >= 500 || isError) return wrap(on, '31;1', text);
      if (status >= 400) return wrap(on, '33;1', text);
      if (status >= 300) return wrap(on, '36', text);
      return wrap(on, '32', text);
    },
    source: (source) => {
      const s = source.padEnd(10);
      if (source === 'mock-hit') return wrap(on, '32', s);
      if (source === 'upstream') return wrap(on, '37', s);
      if (source === 'error' || source === 'blocked') return wrap(on, '31', s);
      if (source === 'mock-miss') return wrap(on, '33', s);
      return wrap(on, '2', s);
    },
    duration: (ms, slow) => {
      if (ms == null || !Number.isFinite(ms)) return wrap(on, '2', '      -');
      const text = `${Math.round(ms)}ms`.padStart(7);
      if (slow) return wrap(on, '33;1', text);
      if (ms >= 1000) return wrap(on, '33', text);
      return wrap(on, '2', text);
    },
    path: (s, emphasize) => (emphasize ? wrap(on, '1', s) : s),
    ok: (s) => wrap(on, '32', s),
    warn: (s) => wrap(on, '33', s),
    err: (s) => wrap(on, '31;1', s),
    info: (s) => wrap(on, '36', s),
    muted: (s) => wrap(on, '2', s),
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

function firstUsageScreen(usage: NetworkEvent['usage']): string | undefined {
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

function treePrefix(depth: number, isLast: boolean, theme: AtlasStreamColorTheme): string {
  if (depth <= 0) return '';
  const indent = theme.muted('│  '.repeat(Math.max(0, depth - 1)));
  const branch = theme.muted(isLast ? '└─ ' : '├─ ');
  return indent + branch;
}

/**
 * Rich single-hop line (colors + optional tree indent).
 * Plain {@link formatMetroNetworkHopLine} remains for non-TTY / tests.
 */
export function formatAtlasStreamHopLine(
  event: NetworkEvent,
  options?: FormatAtlasStreamHopOptions
): string {
  const theme = options?.color ?? createAtlasStreamColorTheme(false);
  const depth = options?.depth ?? 0;
  const isLast = options?.isLast ?? true;
  const maxPathCols = options?.maxPathCols ?? 72;
  const err = isMetroNetworkErrorHop(event);
  const slow = isMetroNetworkSlowHop(event);

  const ts = theme.muted(
    event.timestamp ? event.timestamp.slice(11, 23) : '--:--:--.---'
  );
  const methodRaw = (event.method || '?').toUpperCase();
  const methodCol = theme.method(methodRaw.padEnd(6));
  const statusCol = theme.status(event.status, err);
  const msCol = theme.duration(
    typeof event.durationMs === 'number' ? event.durationMs : undefined,
    slow
  );
  const sourceCol = theme.source(event.source || '');
  const pathRaw = truncatePath(event.path || event.url || '/', maxPathCols);
  const pathCol = theme.path(pathRaw, err || slow);

  const badges: string[] = [];
  if (err) badges.push(theme.err('ERR'));
  if (slow) badges.push(theme.warn('SLOW'));
  const screen = firstUsageScreen(event.usage);
  if (screen) badges.push(theme.info(screen));
  if (options?.repeatSuffix) badges.push(theme.bold(options.repeatSuffix));

  const badgeStr = badges.length ? `  ${badges.join(' ')}` : '';
  const prefix = treePrefix(depth, isLast, theme);

  return `${prefix}${ts}  ${methodCol} ${statusCol}  ${msCol}  ${sourceCol}  ${pathCol}${badgeStr}`;
}

/** Collapsed nested-hops summary under a parent. */
export function formatAtlasStreamCollapseSummary(
  parent: NetworkEvent,
  children: readonly NetworkEvent[],
  options?: { color?: AtlasStreamColorTheme; expandedHint?: boolean }
): string {
  const theme = options?.color ?? createAtlasStreamColorTheme(false);
  const n = children.length;
  let errors = 0;
  let slow = 0;
  let totalMs = 0;
  for (const c of children) {
    if (isMetroNetworkErrorHop(c)) errors += 1;
    if (isMetroNetworkSlowHop(c)) slow += 1;
    if (typeof c.durationMs === 'number') totalMs += c.durationMs;
  }
  const parts = [`${n} nested`];
  if (errors) parts.push(theme.err(`${errors} err`));
  if (slow) parts.push(theme.warn(`${slow} slow`));
  if (totalMs > 0) parts.push(theme.muted(`${Math.round(totalMs)}ms`));
  const hint = options?.expandedHint === false
    ? ''
    : theme.muted('  · e expand');
  const glyph = theme.muted('▸');
  return `${theme.muted('│  └─ ')}${glyph} ${parts.join(' · ')}${hint}`;
}

export function formatAtlasStreamAnalysisRich(
  analysis: MetroNetworkStreamAnalysis,
  options?: { color?: AtlasStreamColorTheme; slowMs?: number }
): string {
  const theme = options?.color ?? createAtlasStreamColorTheme(false);
  const plain = formatMetroNetworkAnalysis(analysis, { slowMs: options?.slowMs });
  if (!theme.enabled) return plain;

  const lines = plain.split('\n');
  return lines
    .map((line, i) => {
      if (i === 0) {
        return line
          .replace(/errors=(\d+)/, (_, n) =>
            Number(n) > 0 ? theme.err(`errors=${n}`) : theme.ok(`errors=${n}`)
          )
          .replace(/slow\([^)]+\)=(\d+)/, (m, n) =>
            Number(n) > 0 ? theme.warn(m) : theme.muted(m)
          );
      }
      if (line.startsWith('slowest:') || line.startsWith('recent errors:')) {
        return theme.bold(line);
      }
      return theme.muted(line.startsWith('  ') ? line : line);
    })
    .join('\n');
}

export interface AtlasStreamViewOptions {
  color?: boolean;
  isTTY?: boolean;
  /** Collapse child hops under parent into a summary line (default true). */
  collapseChildren?: boolean;
  /** Collapse consecutive identical root hops into ×N (default true). */
  collapseDuplicates?: boolean;
  /** Only show error hops (and their parents). */
  errorsOnly?: boolean;
  maxPathCols?: number;
  slowMs?: number;
}

export interface AtlasStreamPaint {
  /** Full lines to write (caller should print each with newline, except rewrite). */
  lines: string[];
  /**
   * When > 0, move cursor up and clear that many lines before printing `lines`
   * (used to refresh a collapse / duplicate summary in place).
   */
  erasePreviousLines?: number;
}

interface DuplicateStreak {
  key: string;
  count: number;
  event: NetworkEvent;
}

/**
 * Stateful stream presenter: colors, tree indent, child collapse, duplicate ×N.
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
  private duplicate: DuplicateStreak | null = null;
  /** Last paint was a rewritable summary (collapse or duplicate). */
  private lastRewritable: 'collapse' | 'duplicate' | null = null;
  private lastCollapseParentId: string | null = null;

  constructor(options?: AtlasStreamViewOptions) {
    this.theme = createAtlasStreamColorTheme(
      shouldUseAtlasStreamColor({ color: options?.color, isTTY: options?.isTTY })
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

  statusLine(): string {
    const bits = [
      this.collapseChildren ? 'collapse=on' : 'collapse=off',
      this.collapseDuplicates ? 'dedupe=on' : 'dedupe=off',
      this.errorsOnly ? 'errors-only' : 'all',
      this.theme.enabled ? 'color' : 'plain',
    ];
    return this.theme.muted(`[atlas] view · ${bits.join(' · ')}  (e/d/f toggle)`);
  }

  /** Ingest one hop; returns what to paint. */
  push(event: NetworkEvent): AtlasStreamPaint {
    const requestId = event.requestId?.trim() || event.id;
    this.eventsByRequestId.set(requestId, event);

    const parentId = event.parentRequestId?.trim() || '';
    if (parentId) {
      const list = this.childrenByParent.get(parentId) ?? [];
      list.push(event);
      this.childrenByParent.set(parentId, list);
      return this.paintChild(event, parentId, list);
    }

    return this.paintRoot(event);
  }

  private paintRoot(event: NetworkEvent): AtlasStreamPaint {
    if (this.errorsOnly && !isMetroNetworkErrorHop(event)) {
      return { lines: [] };
    }

    const key = duplicateKey(event);
    if (this.collapseDuplicates && this.duplicate && this.duplicate.key === key) {
      this.duplicate.count += 1;
      this.duplicate.event = event;
      const line = formatAtlasStreamHopLine(event, {
        color: this.theme,
        maxPathCols: this.maxPathCols,
        repeatSuffix: `×${this.duplicate.count}`,
      });
      const erase = this.lastRewritable === 'duplicate' ? 1 : 0;
      this.lastRewritable = 'duplicate';
      this.lastCollapseParentId = null;
      return { lines: [line], erasePreviousLines: erase };
    }

    this.duplicate = { key, count: 1, event };
    this.lastRewritable = this.collapseDuplicates ? 'duplicate' : null;
    this.lastCollapseParentId = null;
    return {
      lines: [
        formatAtlasStreamHopLine(event, {
          color: this.theme,
          maxPathCols: this.maxPathCols,
        }),
      ],
    };
  }

  private paintChild(
    event: NetworkEvent,
    parentId: string,
    children: NetworkEvent[]
  ): AtlasStreamPaint {
    if (this.errorsOnly && !isMetroNetworkErrorHop(event)) {
      // Still track in children map for when filter turns off — already stored
      return { lines: [] };
    }

    this.duplicate = null;

    if (this.collapseChildren) {
      const parent = this.eventsByRequestId.get(parentId);
      const summary = formatAtlasStreamCollapseSummary(
        parent ?? event,
        children,
        { color: this.theme }
      );
      const erase =
        this.lastRewritable === 'collapse' && this.lastCollapseParentId === parentId
          ? 1
          : 0;
      this.lastRewritable = 'collapse';
      this.lastCollapseParentId = parentId;
      return { lines: [summary], erasePreviousLines: erase };
    }

    this.lastRewritable = null;
    this.lastCollapseParentId = null;
    return {
      lines: [
        formatAtlasStreamHopLine(event, {
          color: this.theme,
          depth: 1,
          isLast: true,
          maxPathCols: this.maxPathCols,
        }),
      ],
    };
  }
}

function duplicateKey(event: NetworkEvent): string {
  const method = (event.method || '').toUpperCase();
  const path = event.path || event.url || '';
  const status = event.status ?? '';
  const source = event.source || '';
  return `${method}|${path}|${status}|${source}`;
}

/** Apply {@link AtlasStreamPaint} to stdout. */
export function writeAtlasStreamPaint(
  paint: AtlasStreamPaint,
  write: (s: string) => void = (s) => {
    process.stdout.write(s);
  }
): void {
  if (paint.lines.length === 0) return;
  const erase = paint.erasePreviousLines ?? 0;
  for (let i = 0; i < erase; i++) {
    write(`${ESC}1A${ESC}2K`);
  }
  for (const line of paint.lines) {
    write(`${line}\n`);
  }
}
