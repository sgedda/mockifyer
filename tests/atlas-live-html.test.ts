import {
  ATLAS_LIVE_STREAM_PATH,
  buildAtlasLiveStreamHtml,
} from '@sgedda/mockifyer-core';

describe('atlas-live-html', () => {
  it('exposes the Metro live path constant', () => {
    expect(ATLAS_LIVE_STREAM_PATH).toBe('/mockifyer-atlas-live');
  });

  it('builds a self-contained page that streams hops with expand/collapse', () => {
    const html = buildAtlasLiveStreamHtml();

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Mockifyer Atlas');
    expect(html).toContain('EventSource');
    expect(html).toContain('/mockifyer-network-events/stream');
    expect(html).toContain('data-parent');
    expect(html).toContain('click expand');
    expect(html).toContain('click collapse');
    expect(html).toContain('Expand all');
    expect(html).toContain('toggleAllExpanded');
    expect(html).toContain('parentRequestId');
    expect(html).toContain('/mockifyer-network-events/clear');
    expect(html).toContain('/mockifyer-atlas-trace');
    expect(html).toContain('data-trace-id');
    expect(html).toContain('X-Mockifyer-Include-Trace');
  });

  it('honors custom stream/clear paths', () => {
    const html = buildAtlasLiveStreamHtml({
      title: 'Custom Atlas',
      streamPath: '/custom/stream',
      clearPath: '/custom/clear',
      backlog: false,
    });
    expect(html).toContain('Custom Atlas');
    expect(html).toContain('/custom/stream');
    expect(html).toContain('/custom/clear');
    expect(html).toContain('var BACKLOG = false');
  });
});
