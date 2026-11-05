import {
  buildMockBehaviorUpdate,
  buildMockResponseUpdate,
} from '../packages/mockifyer-dashboard/frontend/src/lib/mock-update-request';

describe('buildMockResponseUpdate', () => {
  it('keeps an API envelope that uses responseData as its own field', () => {
    const envelope = {
      responseData: { id: 1 },
      status: 'ok',
      statusOverride: 200,
      responseDelayMs: 15,
      replayMode: 'stored',
      responseDateOverrides: [{ path: 'createdAt' }],
    };

    const update = buildMockResponseUpdate({
      responseData: envelope,
      replayMode: 'passthrough',
      scenario: 'checkout',
    });

    expect(update.body).toEqual({
      responseData: envelope,
      replayMode: 'passthrough',
    });
    expect(update.scenario).toBe('checkout');
  });

  it('sends a null body without reading properties from it', () => {
    const update = buildMockResponseUpdate({
      responseData: null,
      replayMode: 'passthrough',
      scenario: 'checkout',
    });

    expect(update.body).toEqual({
      responseData: null,
      replayMode: 'passthrough',
    });
    expect(update.scenario).toBe('checkout');
  });
});

describe('buildMockBehaviorUpdate', () => {
  it('sends only the behavior fields and not a response body', () => {
    expect(buildMockBehaviorUpdate({ statusOverride: 503 })).toEqual({ statusOverride: 503 });
    expect(buildMockBehaviorUpdate({ responseDelayMs: null })).toEqual({ responseDelayMs: null });
  });
});
