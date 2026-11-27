import type { MockData } from '@sgedda/mockifyer-core';
import {
  applyReplayModeFieldsFromBody,
  applyResponseDataFromBody,
  bodyHasReplayModeFields,
} from '../packages/mockifyer-dashboard/src/utils/mock-replay-mode-patch';
import { resolveMockReplayMode } from '../packages/mockifyer-core/src/utils/mock-replay-mode';

const snapshot = (overrides: Partial<MockData> = {}): MockData => ({
  request: { method: 'POST', url: 'http://localhost:4000/graphql', headers: {} },
  response: { status: 200, data: { data: { ok: true } }, headers: {} },
  timestamp: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('applyReplayModeFieldsFromBody', () => {
  it('detects replayMode-only PUT bodies', () => {
    expect(bodyHasReplayModeFields({ replayMode: 'passthrough' })).toBe(true);
    expect(bodyHasReplayModeFields({ responseData: {} })).toBe(false);
  });

  it('sets alwaysUseRealApi for passthrough without requiring responseData', () => {
    const mock = snapshot();
    expect(applyReplayModeFieldsFromBody(mock, { replayMode: 'passthrough' })).toBeNull();
    expect(mock.alwaysUseRealApi).toBe(true);
    expect(mock.response.data).toEqual({ data: { ok: true } });
  });

  it('clears live-api flags when returning to stored mode', () => {
    const mock = snapshot({ alwaysUseRealApi: true });
    expect(applyReplayModeFieldsFromBody(mock, { replayMode: 'stored' })).toBeNull();
    expect(mock.alwaysUseRealApi).toBeUndefined();
  });

  it('leaves request-only stubs when switching away from always-live without Refresh now', () => {
    const mock = snapshot({
      alwaysUseRealApi: true,
      responsePending: true,
      response: { status: 0, data: null, headers: {} },
    });
    expect(applyReplayModeFieldsFromBody(mock, { replayMode: 'always-refresh' })).toBeNull();
    expect(mock.responsePending).toBeUndefined();
    expect(mock.alwaysUseRealApi).toBeUndefined();
    expect(mock.alwaysRefreshFromLive).toBe(true);
  });
});

describe('applyResponseDataFromBody', () => {
  const pendingStub = () =>
    snapshot({
      alwaysUseRealApi: true,
      responsePending: true,
      response: { status: 0, data: null, headers: {} },
    });

  it('keeps stored when the same PUT supplies the body for a record-on-miss stub', () => {
    const mock = pendingStub();
    applyResponseDataFromBody(mock, { weather: { temperature_2m: 99 } });
    expect(applyReplayModeFieldsFromBody(mock, { replayMode: 'stored', alwaysUseRealApi: false })).toBeNull();

    expect(resolveMockReplayMode(mock)).toBe('stored');
    expect(mock.refreshOnNextRequest).toBeUndefined();
    expect(mock.responsePending).toBeUndefined();
    expect(mock.response).toEqual({ status: 200, data: { weather: { temperature_2m: 99 } }, headers: {} });
  });

  it('still queues refresh-next for a stub when no body is supplied', () => {
    const mock = pendingStub();
    expect(applyReplayModeFieldsFromBody(mock, { replayMode: 'stored' })).toBeNull();
    expect(resolveMockReplayMode(mock)).toBe('refresh-next');
  });

  it('keeps a captured non-200 status', () => {
    const mock = snapshot({ response: { status: 404, data: { error: 'nope' }, headers: {} } });
    applyResponseDataFromBody(mock, { error: 'still nope' });
    expect(mock.response.status).toBe(404);
  });

  it('replaces an SSE timeline when the saved body changes', () => {
    const mock = snapshot({
      response: {
        status: 200,
        data: 'data: stale\n\n',
        headers: { 'content-type': 'text/event-stream' },
        stream: {
          kind: 'sse',
          chunks: [
            { offsetMs: 0, data: 'data: sta' },
            { offsetMs: 15, data: 'le\n\n' },
          ],
        },
      },
    });

    applyResponseDataFromBody(mock, 'data: stale\n\n');
    expect(mock.response.stream?.chunks).toHaveLength(2);

    applyResponseDataFromBody(mock, 'data: fresh\n\n');
    expect(mock.response.data).toBe('data: fresh\n\n');
    expect(mock.response.stream).toEqual({
      kind: 'sse',
      chunks: [{ offsetMs: 0, data: 'data: fresh\n\n' }],
    });
  });

  it('drops the timeline when the saved body is no longer the stream text', () => {
    const mock = snapshot({
      response: {
        status: 200,
        data: 'data: stale\n\n',
        headers: { 'content-type': 'text/event-stream' },
        stream: {
          kind: 'sse',
          chunks: [{ offsetMs: 0, data: 'data: stale\n\n' }],
        },
      },
    });

    applyResponseDataFromBody(mock, { ok: false });
    expect(mock.response.data).toEqual({ ok: false });
    expect(mock.response.stream).toBeUndefined();
  });
});
