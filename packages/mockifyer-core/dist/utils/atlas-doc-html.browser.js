"use strict";
/**
 * Browser stub for atlas-doc-html.
 * Atlas HTML generation requires fs access, not available in browsers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAtlasHtml = generateAtlasHtml;
exports.writeAtlasHtml = writeAtlasHtml;
function generateAtlasHtml(_data, _options) {
    // Browser: return empty HTML
    return Promise.resolve('<html><body>Atlas requires Node.js</body></html>');
}
function writeAtlasHtml(_html, _path) {
    // Browser: no-op (no filesystem)
    return Promise.resolve();
}
