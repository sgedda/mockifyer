import {
  computeSessionTimeline,
  hopStateAt,
  nearestScreenshotAt,
  resolveHopDurationMs,
  SCRUB_FALLBACK_DURATION_MS,
  summarizeScrub,
} from '../packages/mockifyer-core/src/utils/atlas-request-scrubber';
import {
  clearAtlasDocMap,
  getAtlasDocMap,
  setAtlasDocScreenshot,
  type AtlasDocMap,
} from '../packages/mockifyer-core/src/utils/atlas-doc';
import { buildAtlasDocHtmlFiles } from '../packages/mockifyer-core/src/utils/atlas-doc-html';
import type { NetworkEvent } from '../packages/mockifyer-core/src/utils/network-event-types';

describe('atlas-request-scrubber', () => {
  const t0 = '2026-09-04T10:00:00.000Z';
  const hop = (
    id: string,
    offsetMs: number,
    durationMs?: number,
    estimated?: number
  ) => ({
    id,
    timestamp: new Date(Date.parse(t0) + offsetMs).toISOString(),
    ...(durationMs != null ? { durationMs } : {}),
    ...(estimated != null ? { _estimatedDurationMs: estimated } : {}),
  });

  it('resolveHopDurationMs prefers durationMs then estimate then fallback', () => {
    expect(resolveHopDurationMs({ timestamp: t0, durationMs: 120 })).toBe(120);
    expect(resolveHopDurationMs({ timestamp: t0, _estimatedDurationMs: 40 })).toBe(40);
    expect(resolveHopDurationMs({ timestamp: t0 })).toBe(SCRUB_FALLBACK_DURATION_MS);
    expect(resolveHopDurationMs({ timestamp: t0, durationMs: 0 })).toBe(SCRUB_FALLBACK_DURATION_MS);
  });

  it('computeSessionTimeline spans first start to last end', () => {
    const events = [hop('a', 0, 100), hop('b', 200, 50)];
    const tl = computeSessionTimeline(events);
    expect(tl.t0Ms).toBe(Date.parse(t0));
    expect(tl.spanMs).toBe(250);
  });

  it('hopStateAt classifies future / in-flight / done', () => {
    const e = hop('a', 100, 50);
    const t0Ms = Date.parse(t0);
    expect(hopStateAt(e, 50, t0Ms)).toBe('future');
    expect(hopStateAt(e, 100, t0Ms)).toBe('in-flight');
    expect(hopStateAt(e, 120, t0Ms)).toBe('in-flight');
    expect(hopStateAt(e, 150, t0Ms)).toBe('done');
    expect(hopStateAt(e, 200, t0Ms)).toBe('done');
  });

  it('summarizeScrub counts and lists appeared hops', () => {
    const events = [hop('a', 0, 100), hop('b', 150, 50), hop('c', 300, 20)];
    const mid = summarizeScrub(events, 160);
    expect(mid.counts).toEqual({ future: 1, inFlight: 1, done: 1, appeared: 2 });
    expect(mid.appeared.map((r) => r.event.id)).toEqual(['a', 'b']);
    expect(mid.all.find((r) => r.event.id === 'a')?.state).toBe('done');
    expect(mid.all.find((r) => r.event.id === 'b')?.state).toBe('in-flight');
    expect(mid.all.find((r) => r.event.id === 'c')?.state).toBe('future');
  });

  it('summarizeScrub clamps playhead to span', () => {
    const events = [hop('a', 0, 100)];
    const over = summarizeScrub(events, 99999);
    expect(over.playheadMs).toBe(100);
    expect(over.counts.done).toBe(1);
    const under = summarizeScrub(events, -10);
    expect(under.playheadMs).toBe(0);
    expect(under.counts.inFlight).toBe(1);
  });

  it('nearestScreenshotAt picks latest shot at or before absolute time', () => {
    const abs = Date.parse(t0) + 500;
    const shot = nearestScreenshotAt(
      [
        { path: 'screenshots/a.png', capturedAt: new Date(Date.parse(t0) + 100).toISOString(), label: 'a' },
        { path: 'screenshots/b.png', capturedAt: new Date(Date.parse(t0) + 400).toISOString(), label: 'b' },
        { path: 'screenshots/c.png', capturedAt: new Date(Date.parse(t0) + 800).toISOString(), label: 'c' },
        { path: 'screenshots/d.png', label: 'no-time' },
      ],
      abs
    );
    expect(shot?.label).toBe('b');
    expect(nearestScreenshotAt([], abs)).toBeUndefined();
  });
});

describe('atlas doc screenshot history', () => {
  it('keeps early and ready captures on the same screen', () => {
    clearAtlasDocMap('scrub-hist');
    setAtlasDocScreenshot({
      scenario: 'scrub-hist',
      screen: 'booking-switch',
      sessionId: 's1',
      screenshotPath: 'screenshots/early.png',
      capturedAt: '2026-09-04T10:00:00.500Z',
      phase: 'early',
    });
    setAtlasDocScreenshot({
      scenario: 'scrub-hist',
      screen: 'booking-switch',
      sessionId: 's1',
      screenshotPath: 'screenshots/ready.png',
      capturedAt: '2026-09-04T10:00:10.000Z',
      phase: 'ready',
    });
    const screen = getAtlasDocMap('scrub-hist').screens['booking-switch'];
    expect(screen.screenshots).toHaveLength(2);
    expect(screen.screenshots?.map((s) => s.phase)).toEqual(['early', 'ready']);
    expect(screen.screenshotPath).toBe('screenshots/ready.png');
  });
});

describe('atlas HTML scrub tab', () => {
  it('embeds Scrub tab and playhead controls', () => {
    const map: AtlasDocMap = {
      scenario: 'default',
      updatedAt: new Date().toISOString(),
      pages: {},
      screens: {},
      prefetches: {},
    };
    const events: NetworkEvent[] = [
      {
        id: 'e1',
        timestamp: '2026-09-04T10:00:00.000Z',
        scenario: 'default',
        transport: 'fetch',
        method: 'GET',
        url: 'https://example.com/api',
        path: '/api',
        source: 'upstream',
        durationMs: 40,
      },
    ];
    const files = buildAtlasDocHtmlFiles(map, events);
    const index = files['index.html'];
    expect(index).toContain('data-view="scrub"');
    expect(index).toContain('id="view-scrub"');
    expect(index).toContain('data-scrub-ms');
    expect(index).toContain('data-scrub-hide-future');
    expect(index).toContain('scrub-playhead');
    expect(index).toContain('Scrub');
  });
});
