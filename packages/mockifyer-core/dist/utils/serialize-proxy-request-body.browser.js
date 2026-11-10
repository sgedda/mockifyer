"use strict";
/**
 * Browser stub for serialize-proxy-request-body.
 * Browser version uses standard APIs instead of Node Buffer.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeProxyRequestBody = serializeProxyRequestBody;
exports.deserializeProxyRequestBody = deserializeProxyRequestBody;
function serializeProxyRequestBody(body) {
    // Browser: pass through body as-is (fetch handles it)
    if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
        return body;
    }
    if (typeof body === 'string') {
        return body;
    }
    if (body && typeof body === 'object') {
        try {
            return JSON.stringify(body);
        }
        catch {
            return String(body);
        }
    }
    return body;
}
function deserializeProxyRequestBody(serialized) {
    // Browser: pass through
    return serialized;
}
