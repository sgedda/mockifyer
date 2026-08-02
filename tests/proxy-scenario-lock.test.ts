import { shouldPersistProxyLiveCapture } from '../packages/mockifyer-dashboard/src/utils/proxy-scenario-lock';

describe('shouldPersistProxyLiveCapture', () => {
  it('persists when live capture is requested and the scenario is unlocked', () => {
    expect(shouldPersistProxyLiveCapture(true, false)).toBe(true);
  });

  it('skips persist when the scenario is locked (locked demos must not be overwritten)', () => {
    expect(shouldPersistProxyLiveCapture(true, true)).toBe(false);
  });

  it('does not persist when live capture is not requested', () => {
    expect(shouldPersistProxyLiveCapture(false, false)).toBe(false);
    expect(shouldPersistProxyLiveCapture(false, true)).toBe(false);
  });
});
