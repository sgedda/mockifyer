export function shouldRecordNewProxyMock(effectiveRecord: boolean, hadMockAtRequestStart: boolean): boolean {
  return effectiveRecord === true && !hadMockAtRequestStart;
}
