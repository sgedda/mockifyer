"use strict";
/**
 * Browser stub for mirror-proxy-recording-to-client.
 * Proxy recording mirroring requires fs access, not available in browsers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mirrorProxyRecordingToClient = mirrorProxyRecordingToClient;
exports.shouldMirrorProxyRecording = shouldMirrorProxyRecording;
function mirrorProxyRecordingToClient(_recording, _config) {
    // Browser: no-op (proxy recording requires Node.js)
    return Promise.resolve();
}
function shouldMirrorProxyRecording(_config) {
    // Browser: no mirroring
    return false;
}
