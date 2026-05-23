import { shouldWriteProxyRecordingAfterUpstream } from '../packages/mockifyer-dashboard/src/utils/proxy-recording';

describe('proxy recording persistence', () => {
  it('does not write a second recording when live capture already persisted the mock', () => {
    expect(
      shouldWriteProxyRecordingAfterUpstream({
        effectiveRecord: true,
        shouldPersistLiveCapture: true,
      })
    ).toBe(false);
  });

  it('records upstream responses when record-on-miss is enabled and no live capture was saved', () => {
    expect(
      shouldWriteProxyRecordingAfterUpstream({
        effectiveRecord: true,
        shouldPersistLiveCapture: false,
      })
    ).toBe(true);
  });
});
