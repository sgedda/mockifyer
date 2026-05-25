import { shouldWriteProxyRecording } from '../packages/mockifyer-dashboard/src/utils/proxy-recording';

describe('proxy recording decisions', () => {
  it('does not run the generic recording write after a live-capture refresh write', () => {
    expect(
      shouldWriteProxyRecording({
        effectiveRecord: true,
        shouldPersistLiveCapture: true,
      })
    ).toBe(false);
  });

  it('records misses when no live-capture refresh was persisted', () => {
    expect(
      shouldWriteProxyRecording({
        effectiveRecord: true,
        shouldPersistLiveCapture: false,
      })
    ).toBe(true);
  });
});
