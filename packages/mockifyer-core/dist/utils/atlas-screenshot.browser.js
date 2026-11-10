"use strict";
/**
 * Browser stub for atlas-screenshot.
 * Screenshot capture requires fs access, not available in browsers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.captureScreenshot = captureScreenshot;
exports.saveScreenshot = saveScreenshot;
function captureScreenshot(_url, _options) {
    // Browser: no screenshot capability
    return Promise.resolve(null);
}
function saveScreenshot(_buffer, _path) {
    // Browser: no-op (no filesystem)
    return Promise.resolve();
}
