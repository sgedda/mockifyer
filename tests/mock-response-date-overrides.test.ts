import {
  applyResponseDateOverridesToData,
  parseResponseDataPath,
  totalOverrideOffsetMs,
  prepareMockResponseBody,
} from '@sgedda/mockifyer-core';
import type { MockData, MockResponseDateOverride } from '@sgedda/mockifyer-core';

describe('mock response date overrides', () => {
  const fixedNow = () => new Date('2025-06-15T12:00:00.000Z');

  it('parseResponseDataPath handles nested keys and array indices', () => {
    expect(parseResponseDataPath('a.b.0.c')).toEqual(['a', 'b', 0, 'c']);
    expect(parseResponseDataPath('expiresAt')).toEqual(['expiresAt']);
  });

  it('totalOverrideOffsetMs combines fields', () => {
    const o: MockResponseDateOverride = {
      path: 'x',
      offsetMs: 1000,
      offsetDays: 1,
      offsetHours: 2,
      offsetMinutes: 3,
    };
    expect(totalOverrideOffsetMs(o)).toBe(1000 + 86400000 + 7200000 + 180000);
  });

  it('rewrites ISO paths relative to getNow', () => {
    const data = { user: { trialEndsAt: '2020-01-01T00:00:00.000Z' } };
    const out = applyResponseDateOverridesToData(
      data,
      [{ path: 'user.trialEndsAt', offsetMs: 86400000 }],
      fixedNow
    );
    expect(out).not.toBe(data);
    expect((out as typeof data).user.trialEndsAt).toBe('2025-06-16T12:00:00.000Z');
  });

  it('rewrites array paths', () => {
    const data = { items: [{ createdAt: 'old' }] };
    const out = applyResponseDateOverridesToData(data, [{ path: 'items.0.createdAt' }], fixedNow);
    expect((out as typeof data).items[0].createdAt).toBe('2025-06-15T12:00:00.000Z');
  });

  it('infers unix-ms when original number is ms', () => {
    const data = { ts: 1700000000000 };
    const out = applyResponseDateOverridesToData(data, [{ path: 'ts', offsetMs: 1000 }], fixedNow);
    expect((out as typeof data).ts).toBe(fixedNow().getTime() + 1000);
  });

  it('infers unix-s when original number is seconds', () => {
    const data = { ts: 1700000000 };
    const out = applyResponseDateOverridesToData(data, [{ path: 'ts' }], fixedNow);
    expect((out as typeof data).ts).toBe(Math.floor(fixedNow().getTime() / 1000));
  });

  it('prepareMockResponseBody returns original when no overrides', () => {
    const mockData: MockData = {
      request: { method: 'GET', url: 'https://x', headers: {} },
      response: { status: 200, data: { a: 1 }, headers: {} },
      timestamp: 't',
    };
    expect(prepareMockResponseBody(mockData, fixedNow)).toBe(mockData.response.data);
  });

  it('prepareMockResponseBody returns cloned data when overrides set', () => {
    const mockData: MockData = {
      request: { method: 'GET', url: 'https://x', headers: {} },
      response: { status: 200, data: { until: 'x' }, headers: {} },
      timestamp: 't',
      responseDateOverrides: [{ path: 'until' }],
    };
    const body = prepareMockResponseBody(mockData, fixedNow) as { until: string };
    expect(body.until).toBe('2025-06-15T12:00:00.000Z');
    expect(mockData.response.data.until).toBe('x');
  });

  it('applies overrides to JSON string body', () => {
    const raw = JSON.stringify({ x: 'y' });
    const out = applyResponseDateOverridesToData(
      raw,
      [{ path: 'x' }],
      fixedNow
    ) as string;
    expect(JSON.parse(out).x).toBe('2025-06-15T12:00:00.000Z');
  });

  // Regression: legacy mocks with `base: 'response'` could anchor at the recorded
  // (often stale or fixed) date and produce drifted dates long after the recording
  // was made. Since core 1.8.20 we always anchor at `getNow()` so output is stable.
  it('treats deprecated `base: "response"` identically to `base: "now"`', () => {
    const data = { expiresAt: '2026-03-01T15:42:00.000Z' };
    const out = applyResponseDateOverridesToData(
      data,
      [{ path: 'expiresAt', base: 'response', offsetDays: 30 }],
      fixedNow
    );
    expect((out as typeof data).expiresAt).toBe('2025-07-15T12:00:00.000Z');
  });

  it('ignores stale recorded value with no offset (`base: "response"` ⇒ now)', () => {
    const data = { issuedAt: '2026-03-01T15:42:00.000Z' };
    const out = applyResponseDateOverridesToData(
      data,
      [{ path: 'issuedAt', base: 'response' }],
      fixedNow
    );
    expect((out as typeof data).issuedAt).toBe('2025-06-15T12:00:00.000Z');
  });
});
