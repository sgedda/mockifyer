/**
 * Browser stub for mirror-proxy-recording-to-client.
 * Proxy recording mirroring requires fs access, not available in browsers.
 */

export function mirrorProxyRecordingToClient(_recording: any, _config: any): Promise<void> {
  // Browser: no-op (proxy recording requires Node.js)
  return Promise.resolve();
}

export function shouldMirrorProxyRecording(_config: any): boolean {
  // Browser: no mirroring
  return false;
}
