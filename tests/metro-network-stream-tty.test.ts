import {
  createAtlasStreamColorTheme,
  formatAtlasStreamCollapseSummary,
  formatAtlasStreamHopLine,
  MetroAtlasStreamView,
  shouldUseAtlasStreamColor,
  writeAtlasStreamPaint,
  AtlasStreamHitTracker,
  consumeAtlasStreamMouseInput,
  formatAtlasStreamHoverLine,
} from '@sgedda/mockifyer-core';
import type { NetworkEvent } from '@sgedda/mockifyer-core';

function hop(
  partial: Partial<NetworkEvent> & Pick<NetworkEvent, 'method' | 'url' | 'source'>
): NetworkEvent {
  return {
    id: partial.id ?? `e-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: partial.timestamp ?? '2026-09-12T10:00:00.000Z',
    scenario: partial.scenario ?? 'default',
    transport: partial.transport ?? 'fetch',
    method: partial.method,
    url: partial.url,
    host: partial.host,
    path: partial.path,
    status: partial.status,
    durationMs: partial.durationMs,
    source: partial.source,
    requestId: partial.requestId,
    parentRequestId: partial.parentRequestId,
    usage: partial.usage,
  };
}

describe('metro-network-stream-tty', () => {
  it('shouldUseAtlasStreamColor respects NO_COLOR and explicit flags', () => {
    const prev = process.env.NO_COLOR;
    process.env.NO_COLOR = '1';
    expect(shouldUseAtlasStreamColor({ isTTY: true })).toBe(false);
    expect(shouldUseAtlasStreamColor({ color: true, isTTY: true })).toBe(true);
    if (prev === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = prev;
  });

  it('colors method/status when enabled', () => {
    const theme = createAtlasStreamColorTheme(true);
    const line = formatAtlasStreamHopLine(
      hop({
        method: 'GET',
        url: 'https://a.test/x',
        path: '/x',
        status: 200,
        durationMs: 12,
        source: 'mock-hit',
      }),
      { color: theme }
    );
    expect(line).toContain('\u001b[');
    expect(line).toContain('/x');
  });

  it('collapse summary lists nested counts', () => {
    const theme = createAtlasStreamColorTheme(false);
    const parent = hop({
      id: 'p',
      requestId: 'p',
      method: 'GET',
      url: 'https://a.test/p',
      path: '/p',
      source: 'upstream',
      status: 200,
    });
    const children = [
      hop({
        method: 'GET',
        url: 'https://a.test/c1',
        path: '/c1',
        source: 'upstream',
        status: 200,
        durationMs: 10,
        parentRequestId: 'p',
      }),
      hop({
        method: 'GET',
        url: 'https://a.test/c2',
        path: '/c2',
        source: 'error',
        status: 500,
        durationMs: 4000,
        parentRequestId: 'p',
      }),
    ];
    const line = formatAtlasStreamCollapseSummary(parent, children, { color: theme });
    expect(line).toContain('2 nested');
    expect(line).toContain('1 err');
    expect(line).toContain('1 slow');
  });

  it('MetroAtlasStreamView collapses children and rewrites summary', () => {
    const view = new MetroAtlasStreamView({
      color: false,
      collapseChildren: true,
      collapseDuplicates: false,
    });
    const root = view.push(
      hop({
        id: 'root',
        requestId: 'root',
        method: 'GET',
        url: 'https://a.test/',
        path: '/',
        status: 200,
        source: 'upstream',
      })
    );
    expect(root.lines[0]).toContain('GET');
    expect(root.erasePreviousLines ?? 0).toBe(0);

    const c1 = view.push(
      hop({
        id: 'c1',
        requestId: 'c1',
        parentRequestId: 'root',
        method: 'GET',
        url: 'https://a.test/a',
        path: '/a',
        status: 200,
        source: 'upstream',
        durationMs: 5,
      })
    );
    expect(c1.lines[0]).toContain('1 nested');

    const c2 = view.push(
      hop({
        id: 'c2',
        requestId: 'c2',
        parentRequestId: 'root',
        method: 'GET',
        url: 'https://a.test/b',
        path: '/b',
        status: 200,
        source: 'upstream',
        durationMs: 5,
      })
    );
    expect(c2.lines[0]).toContain('2 nested');
    expect(c2.erasePreviousLines).toBe(1);
  });

  it('dedupes consecutive identical roots with ×N', () => {
    const view = new MetroAtlasStreamView({
      color: false,
      collapseChildren: true,
      collapseDuplicates: true,
    });
    const a = view.push(
      hop({
        method: 'GET',
        url: 'https://a.test/x',
        path: '/x',
        status: 200,
        source: 'mock-hit',
      })
    );
    expect(a.lines[0]).not.toContain('×');
    const b = view.push(
      hop({
        method: 'GET',
        url: 'https://a.test/x',
        path: '/x',
        status: 200,
        source: 'mock-hit',
      })
    );
    expect(b.lines[0]).toContain('×2');
    expect(b.erasePreviousLines).toBe(1);
  });

  it('writeAtlasStreamPaint erases previous lines with ANSI', () => {
    const chunks: string[] = [];
    writeAtlasStreamPaint(
      { lines: ['hello'], erasePreviousLines: 1 },
      (s) => chunks.push(s)
    );
    expect(chunks.join('')).toContain('\u001b[1A');
    expect(chunks.join('')).toContain('hello\n');
  });

  it('expand mode prints tree-prefixed children', () => {
    const view = new MetroAtlasStreamView({
      color: false,
      collapseChildren: false,
      collapseDuplicates: false,
    });
    view.push(
      hop({
        requestId: 'root',
        method: 'GET',
        url: 'https://a.test/',
        path: '/',
        status: 200,
        source: 'upstream',
      })
    );
    const child = view.push(
      hop({
        requestId: 'c',
        parentRequestId: 'root',
        method: 'POST',
        url: 'https://a.test/c',
        path: '/c',
        status: 201,
        source: 'upstream',
      })
    );
    expect(child.lines[0]).toContain('└─');
    expect(child.lines[0]).toContain('/c');
  });

  it('toggleParentExpanded expands and collapses a nested group', () => {
    const view = new MetroAtlasStreamView({
      color: false,
      collapseChildren: true,
      collapseDuplicates: false,
    });
    view.push(
      hop({
        requestId: 'root',
        method: 'GET',
        url: 'https://a.test/',
        path: '/',
        status: 200,
        source: 'upstream',
      })
    );
    view.push(
      hop({
        requestId: 'c1',
        parentRequestId: 'root',
        method: 'GET',
        url: 'https://a.test/a',
        path: '/a',
        status: 200,
        source: 'upstream',
      })
    );
    const expanded = view.toggleParentExpanded('root');
    expect(expanded.clearScreen).toBe(true);
    expect(expanded.lines.some((l) => l.includes('/a'))).toBe(true);
    expect(view.isParentExpanded('root')).toBe(true);
    const collapsed = view.toggleParentExpanded('root');
    expect(collapsed.clearScreen).toBe(true);
    expect(collapsed.lines.some((l) => l.includes('nested'))).toBe(true);
    expect(collapsed.lineHits?.some((h) => h.kind === 'collapse')).toBe(true);
    expect(view.isParentExpanded('root')).toBe(false);
  });

  it('toggleParentExpanded redraws mid-list parent in place (not only at bottom)', () => {
    const view = new MetroAtlasStreamView({
      color: false,
      collapseChildren: true,
      collapseDuplicates: false,
    });
    view.push(
      hop({
        requestId: 'early',
        method: 'GET',
        url: 'https://a.test/early',
        path: '/early',
        status: 200,
        source: 'upstream',
      })
    );
    view.push(
      hop({
        requestId: 'c-early',
        parentRequestId: 'early',
        method: 'GET',
        url: 'https://a.test/early/child',
        path: '/early/child',
        status: 200,
        source: 'upstream',
      })
    );
    view.push(
      hop({
        requestId: 'late',
        method: 'GET',
        url: 'https://a.test/late',
        path: '/late',
        status: 200,
        source: 'upstream',
      })
    );
    view.push(
      hop({
        requestId: 'c-late',
        parentRequestId: 'late',
        method: 'GET',
        url: 'https://a.test/late/child',
        path: '/late/child',
        status: 200,
        source: 'upstream',
      })
    );

    const expanded = view.toggleParentExpanded('early');
    expect(expanded.clearScreen).toBe(true);
    const earlyIdx = expanded.lines.findIndex((l) => l.includes('/early') && !l.includes('child'));
    const childIdx = expanded.lines.findIndex((l) => l.includes('/early/child'));
    const lateIdx = expanded.lines.findIndex((l) => l.includes('/late') && !l.includes('child'));
    expect(earlyIdx).toBeGreaterThanOrEqual(0);
    expect(childIdx).toBeGreaterThan(earlyIdx);
    expect(lateIdx).toBeGreaterThan(childIdx);
    // Late group stays collapsed in the redraw.
    expect(expanded.lines.some((l) => l.includes('/late/child'))).toBe(false);
    expect(expanded.lineHits?.some((h) => h.kind === 'collapse' && h.parentId === 'late')).toBe(
      true
    );
  });

  it('hit tracker maps mouse rows from top before scroll', () => {
    const hits = new AtlasStreamHitTracker(50);
    hits.notePaint({
      lines: ['a', 'b', '▸ nested'],
      lineHits: [
        { kind: 'none' },
        { kind: 'none' },
        { kind: 'collapse', parentId: 'p1' },
      ],
    });
    expect(hits.hitAtScreenRow(3, 24)?.kind).toBe('collapse');
    expect(hits.hitAtScreenRow(1, 24)?.kind).toBe('none');
  });

  it('hit tracker resets on clearScreen paints', () => {
    const hits = new AtlasStreamHitTracker(50);
    hits.notePaint({
      lines: ['old'],
      lineHits: [{ kind: 'collapse', parentId: 'old' }],
    });
    hits.notePaint({
      lines: ['new', '▸ nested'],
      lineHits: [
        { kind: 'none' },
        { kind: 'collapse', parentId: 'p2' },
      ],
      clearScreen: true,
    });
    expect(hits.hitAtScreenRow(1, 24)?.kind).toBe('none');
    expect(hits.hitAtScreenRow(2, 24)).toEqual({ kind: 'collapse', parentId: 'p2' });
  });

  it('consumeAtlasStreamMouseInput parses SGR click sequences', () => {
    const { clicks, moves: _moves, rest } = consumeAtlasStreamMouseInput('\u001b[<0;12;8M' + 'e');
    expect(clicks).toHaveLength(1);
    expect(clicks[0]).toMatchObject({ button: 0, col: 12, row: 8, release: false });
    expect(rest).toBe('e');
  });


  it('formatAtlasStreamHoverLine swaps ▸/▾ to filled icons', () => {
    const line = '│  └─ ▸ 2 nested  · click/e expand';
    const hovered = formatAtlasStreamHoverLine(line);
    expect(hovered).toContain('▶');
    expect(hovered).not.toContain('▸');
    expect(formatAtlasStreamHoverLine('plain')).toBe('plain');
  });

  it('consumeAtlasStreamMouseInput separates clicks from hover moves', () => {
    const { clicks, moves, rest } = consumeAtlasStreamMouseInput(
      '\u001b[<35;10;5M' + '\u001b[<0;10;5M' + 'x'
    );
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ button: 35, row: 5, motion: true });
    expect(clicks).toHaveLength(1);
    expect(clicks[0]).toMatchObject({ button: 0, row: 5, motion: false });
    expect(rest).toBe('x');
  });

  it('hit tracker stores line text for hover restore', () => {
    const hits = new AtlasStreamHitTracker(50);
    hits.notePaint({
      lines: ['│  └─ ▸ 1 nested'],
      lineHits: [{ kind: 'collapse', parentId: 'p1' }],
    });
    expect(hits.lineAtScreenRow(1, 24)).toContain('▸');
  });

});
