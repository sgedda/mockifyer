"use strict";
/**
 * Browser stub for network-body-spill.
 * Body spilling to disk requires fs access, not available in browsers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.spillBodyToDisk = spillBodyToDisk;
exports.readSpilledBody = readSpilledBody;
exports.shouldSpillBody = shouldSpillBody;
function spillBodyToDisk(_body, _path) {
    // Browser: no-op (no filesystem)
    return Promise.resolve();
}
function readSpilledBody(_path) {
    // Browser: no spilled bodies
    return Promise.resolve(null);
}
function shouldSpillBody(_size) {
    // Browser: never spill
    return false;
}
