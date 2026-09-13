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
  truncateAtlasStreamLine,
  rewriteAtlasStreamScreenRow,
  atlasStreamVisibleWidth,
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

  it('statusLine reflects pause and skipped hop count', () => {
    const view = new MetroAtlasStreamView({ color: false });
    expect(view.statusLine()).toContain('live');
    expect(view.statusLine()).not.toContain('paused');

    view.paused = true;
    expect(view.statusLine()).toContain('paused');
    expect(view.statusLine()).not.toContain('skipped');

    view.skippedWhilePaused = 4;
    expect(view.statusLine()).toContain('paused · 4 skipped');
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

  it('expand mode prints toggle above tree-prefixed children', () => {
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
    expect(child.lines[0]).toContain('▾');
    expect(child.lines[0]).toContain('1 nested · click collapse');
    expect(child.lines[0]).toContain('├─');
    expect(child.lineHits?.[0]?.kind).toBe('expand-footer');
    expect(child.lines[1]).toContain('└─');
    expect(child.lines[1]).toContain('/c');
  });

  it('toggleParentExpanded keeps collapse control above children', () => {
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
    view.push(
      hop({
        requestId: 'c2',
        parentRequestId: 'root',
        method: 'GET',
        url: 'https://a.test/b',
        path: '/b',
        status: 200,
        source: 'upstream',
      })
    );
    const expanded = view.toggleParentExpanded('root');
    const nestedIdx = expanded.lines.findIndex((l) => l.includes('nested · click collapse'));
    const childIdx = expanded.lines.findIndex((l) => l.includes('/a'));
    expect(nestedIdx).toBeGreaterThan(-1);
    expect(childIdx).toBeGreaterThan(nestedIdx);
    expect(expanded.lineHits?.[nestedIdx]?.kind).toBe('expand-footer');
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

  it('toggleAllExpanded expands every nested group then collapses them', () => {
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

    // Expand only one group first — toggleAll should still expand the rest.
    view.toggleParentExpanded('early');
    const allExpanded = view.toggleAllExpanded();
    expect(allExpanded.clearScreen).toBe(true);
    expect(view.isParentExpanded('early')).toBe(true);
    expect(view.isParentExpanded('late')).toBe(true);
    expect(allExpanded.lines.some((l) => l.includes('/early/child'))).toBe(true);
    expect(allExpanded.lines.some((l) => l.includes('/late/child'))).toBe(true);
    expect(view.collapseChildren).toBe(false);

    const allCollapsed = view.toggleAllExpanded();
    expect(allCollapsed.clearScreen).toBe(true);
    expect(view.isParentExpanded('early')).toBe(false);
    expect(view.isParentExpanded('late')).toBe(false);
    expect(allCollapsed.lines.some((l) => l.includes('/early/child'))).toBe(false);
    expect(allCollapsed.lines.some((l) => l.includes('/late/child'))).toBe(false);
    expect(allCollapsed.lineHits?.filter((h) => h.kind === 'collapse')).toHaveLength(2);
    expect(view.collapseChildren).toBe(true);
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

  it('scrollWindow paints older history without wiping retained lines', () => {
    const hits = new AtlasStreamHitTracker(100);
    const screenRows = 5; // maxViewportRows = 4
    for (let i = 0; i < 10; i++) {
      hits.notePaint(
        {
          lines: [`line-${i}`],
          lineHits: [{ kind: 'none' }],
        },
        screenRows,
      );
    }
    expect(hits.maxScrollBack(screenRows)).toBe(6);
    expect(hits.historyLength()).toBe(10);

    const window = hits.scrollWindow(3, screenRows);
    expect(window.clearScreen).toBe(true);
    expect(window.preserveHistory).toBe(true);
    expect(window.lines).toEqual(['line-3', 'line-4', 'line-5', 'line-6']);

    hits.notePaint(window, screenRows);
    expect(hits.historyLength()).toBe(10);
    expect(hits.hitAtScreenRow(1, screenRows)).toEqual({ kind: 'none' });
    expect(hits.lineAtScreenRow(1, screenRows)).toBe('line-3');
    expect(hits.lineAtScreenRow(4, screenRows)).toBe('line-6');

    const tip = hits.scrollWindow(0, screenRows);
    expect(tip.lines).toEqual(['line-6', 'line-7', 'line-8', 'line-9']);
  });

  it('consumeAtlasStreamMouseInput parses SGR click sequences', () => {
    const { clicks, moves: _moves, rest } = consumeAtlasStreamMouseInput('\u001b[<0;12;8M' + 'e');
    expect(clicks).toHaveLength(1);
    expect(clicks[0]).toMatchObject({ button: 0, col: 12, row: 8, release: false });
    expect(rest).toBe('e');
  });


  it('formatAtlasStreamHoverLine bolds ▸/▾ without changing glyph width', () => {
    const line = '│  └─ ▸ 2 nested  · click expand';
    const hovered = formatAtlasStreamHoverLine(line);
    expect(hovered).toContain('▸');
    expect(hovered).toContain('\u001b[1m▸\u001b[22m');
    // ▶/▼ are often 2 display columns and would wrap onto the next row.
    expect(hovered).not.toContain('▶');
    expect(hovered).not.toContain('▼');
    expect(atlasStreamVisibleWidth(hovered)).toBe(atlasStreamVisibleWidth(line));
    expect(formatAtlasStreamHoverLine('plain')).toBe('plain');
  });

  it('consumeAtlasStreamMouseInput treats wheel as clicks (not motion)', () => {
    const { clicks, moves, rest } = consumeAtlasStreamMouseInput(
      '\u001b[<64;8;4M' + '\u001b[<65;8;4M' + '\u001b[<68;8;4M'
    );
    expect(moves).toHaveLength(0);
    expect(clicks).toHaveLength(3);
    expect(clicks.map((c) => c.button)).toEqual([64, 65, 68]);
    expect(rest).toBe('');
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


  it('truncateAtlasStreamLine clips visible width without breaking ANSI', () => {
    const themed = '\u001b[2m' + 'x'.repeat(50) + '\u001b[0m';
    const clipped = truncateAtlasStreamLine(themed, 20);
    expect(atlasStreamVisibleWidth(clipped)).toBeLessThanOrEqual(20);
    expect(clipped).toContain('…');
    expect(truncateAtlasStreamLine('short', 20)).toBe('short');
  });

  it('rewriteAtlasStreamScreenRow never writes a wrapping line', () => {
    const chunks: string[] = [];
    const wide = 'y'.repeat(200);
    rewriteAtlasStreamScreenRow(3, wide, (s) => chunks.push(s), {
      returnCursorRow: 10,
    });
    const out = chunks.join('');
    expect(out).toContain('\u001b[3;1H');
    expect(out).toContain('\u001b[2K');
    expect(out).toContain('\u001b[10;1H');
    // No DECSC/DECRC — those leave the cursor mid-screen in some terminals.
    expect(out).not.toContain('\u001b7');
    expect(out).not.toMatch(/\u001b8$/);
    // No newline in the rewritten payload (would push rows down).
    const afterClear = out.split('\u001b[2K')[1] || '';
    const body = afterClear.replace(/\u001b\[\d+;1H$/, '');
    expect(body.includes('\n')).toBe(false);
    expect(atlasStreamVisibleWidth(body.replace(/\u001b\[[0-9;]*m/g, ''))).toBeLessThanOrEqual(
      Math.max(20, (process.stdout.columns || 80) - 2)
    );
    // No-wrap is re-asserted so a wide hover cannot clobber the next row.
    expect(out).toContain('\u001b[?7l');
  });

  it('isScrolled is true once the viewport fills the screen', () => {
    const hits = new AtlasStreamHitTracker(100);
    const screenRows = 5;
    expect(hits.isScrolled(screenRows)).toBe(false);
    for (let i = 0; i < 4; i++) {
      hits.notePaint({ lines: [`line-${i}`], lineHits: [{ kind: 'none' }] }, screenRows);
    }
    // 4 content rows = screenRows-1 → full, treated as scrolled for hover safety.
    expect(hits.isScrolled(screenRows)).toBe(true);
    expect(hits.cursorRow(screenRows)).toBe(5);
  });


  it('hit tracker maps scrolled full-screen rows (cursor line is bottom)', () => {
    const hits = new AtlasStreamHitTracker(100);
    const screenRows = 5;
    // 7 painted lines → scrolled; visible content is last 4 hits on rows 1-4.
    for (let i = 0; i < 7; i++) {
      const isCollapse = i === 5; // second-to-last content in visible window
      hits.notePaint(
        {
          lines: [`line-${i}${isCollapse ? ' ▸ nested' : ''}`],
          lineHits: [
            isCollapse
              ? { kind: 'collapse', parentId: 'p-mid' }
              : { kind: 'none' },
          ],
        },
        screenRows,
      );
    }
    // Visible hits: 3,4,5,6 on rows 1-4. Row 5 = empty cursor.
    expect(hits.lineAtScreenRow(1, screenRows)).toContain('line-3');
    expect(hits.lineAtScreenRow(3, screenRows)).toContain('line-5');
    expect(hits.hitAtScreenRow(3, screenRows)).toEqual({
      kind: 'collapse',
      parentId: 'p-mid',
    });
    expect(hits.hitAtScreenRow(4, screenRows)?.kind).toBe('none');
    expect(hits.hitAtScreenRow(5, screenRows)).toBeNull();
    // Off-by-one regression: row 2 must be line-4, not the collapse line.
    expect(hits.lineAtScreenRow(2, screenRows)).toContain('line-4');
    expect(hits.hitAtScreenRow(2, screenRows)?.kind).toBe('none');
  });

  it('viewport mirror: timestamp row above ▸ never maps as collapse when scrolled', () => {
    const hits = new AtlasStreamHitTracker(100);
    const screenRows = 6;
    // Fill past one screen: pairs of timestamp + collapse summary.
    for (let i = 0; i < 5; i++) {
      hits.notePaint(
        {
          lines: [`12:00:0${i}.000 GET /hop-${i}`],
          lineHits: [{ kind: 'none' }],
        },
        screenRows,
      );
      hits.notePaint(
        {
          lines: [`│  └─ ▸ ${i + 1} nested · click expand`],
          lineHits: [{ kind: 'collapse', parentId: `p-${i}` }],
        },
        screenRows,
      );
    }
    // Visible (contentRows=5): last 5 of 10 lines.
    // Rows: 1=ts, 2=▸, 3=ts, 4=▸, 5=ts? Wait last 5 of [t0,c0,t1,c1,t2,c2,t3,c3,t4,c4]
    // = t2,c2,t3,c3,t4 on rows 1-5? That's 5 lines: t2,c2,t3,c3,t4 — missing c4.
    // last 5: c2,t3,c3,t4,c4
    expect(hits.lineAtScreenRow(1, screenRows)).toContain('▸');
    expect(hits.hitAtScreenRow(1, screenRows)?.kind).toBe('collapse');
    // Row above a ▸ (row 2 is timestamp /hop-3) must not be collapse.
    expect(hits.lineAtScreenRow(2, screenRows)).toContain('/hop-3');
    expect(hits.lineAtScreenRow(2, screenRows)).not.toContain('▸');
    expect(hits.hitAtScreenRow(2, screenRows)?.kind).toBe('none');
    expect(hits.lineAtScreenRow(3, screenRows)).toContain('▸');
    expect(hits.hitAtScreenRow(3, screenRows)?.kind).toBe('collapse');
  });

});
