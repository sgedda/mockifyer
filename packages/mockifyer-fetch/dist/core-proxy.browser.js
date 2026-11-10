"use strict";
/**
 * Browser stub for core-proxy - proxy functionality requires Node.js
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyProxyRecordOnMissEnv = applyProxyRecordOnMissEnv;
exports.mirrorProxyRecordingToClient = mirrorProxyRecordingToClient;
exports.performDashboardProxyRequest = performDashboardProxyRequest;
exports.initMockifyerForDashboardProxy = initMockifyerForDashboardProxy;
exports.initMockifyerForLocalFilesystem = initMockifyerForLocalFilesystem;
exports.initMockifyerForDashboardProxyClients = initMockifyerForDashboardProxyClients;
exports.initMockifyerForLocalFilesystemClients = initMockifyerForLocalFilesystemClients;
exports.resolveClientInitFlags = resolveClientInitFlags;
exports.needsSiblingClientSetup = needsSiblingClientSetup;
exports.syncDualMockifyerControls = syncDualMockifyerControls;
exports.pickPrimaryDualMockifyerInstance = pickPrimaryDualMockifyerInstance;
exports.loadAxiosSetupMockifyer = loadAxiosSetupMockifyer;
exports.loadFetchSetupMockifyer = loadFetchSetupMockifyer;
function applyProxyRecordOnMissEnv(config) {
    return config;
}
function mirrorProxyRecordingToClient() {
    // Browser: no-op
}
function performDashboardProxyRequest() {
    return Promise.reject(new Error('[Mockifyer Browser] Dashboard proxy requires Node.js. ' +
        'Use databaseProvider: { type: "memory", options: { fixtures: [...] } } for browser builds.'));
}
function initMockifyerForDashboardProxy() {
    return Promise.reject(new Error('[Mockifyer Browser] Dashboard proxy requires Node.js'));
}
function initMockifyerForLocalFilesystem() {
    throw new Error('[Mockifyer Browser] Use setupMockifyer from browser entry');
}
function initMockifyerForDashboardProxyClients() {
    return Promise.reject(new Error('[Mockifyer Browser] Dashboard proxy requires Node.js'));
}
function initMockifyerForLocalFilesystemClients() {
    throw new Error('[Mockifyer Browser] Use setupMockifyer from browser entry');
}
function resolveClientInitFlags() {
    return {};
}
function needsSiblingClientSetup() {
    return false;
}
function syncDualMockifyerControls() {
    // Browser: no-op
}
function pickPrimaryDualMockifyerInstance(_transport, _flags, result) {
    return result.fetch || result.axios;
}
function loadAxiosSetupMockifyer() {
    return null;
}
function loadFetchSetupMockifyer() {
    return null;
}
