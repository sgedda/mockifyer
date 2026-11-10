/**
 * Browser stub for mirror-proxy-recording-to-client.
 * Proxy recording mirroring requires fs access, not available in browsers.
 */
export declare function mirrorProxyRecordingToClient(_recording: any, _config: any): Promise<void>;
export declare function shouldMirrorProxyRecording(_config: any): boolean;
