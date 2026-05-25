export function shouldWriteProxyRecording(opts: {
  effectiveRecord: boolean;
  shouldPersistLiveCapture: boolean;
}): boolean {
  return opts.effectiveRecord === true && !opts.shouldPersistLiveCapture;
}
