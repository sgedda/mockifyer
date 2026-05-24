import { shouldRecordNewProxyMock } from '../packages/mockifyer-dashboard/src/utils/proxy-recording';

describe('proxy recording decisions', () => {
  it('records upstream responses only for true proxy misses', () => {
    expect(shouldRecordNewProxyMock(true, false)).toBe(true);
    expect(shouldRecordNewProxyMock(true, true)).toBe(false);
    expect(shouldRecordNewProxyMock(false, false)).toBe(false);
  });
});
