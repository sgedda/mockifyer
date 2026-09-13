import {
  createAtlasStreamColorTheme,
  formatAtlasStreamCollapseSummary,
  formatAtlasStreamHopLine,
  MetroAtlasStreamView,
  shouldUseAtlasStreamColor,
  writeAtlasStreamPaint,
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
});
