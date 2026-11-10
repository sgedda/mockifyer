"use strict";
/**
 * Browser stub for scenario utilities.
 * Scenario management requires fs access, not available in browsers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeScenario = initializeScenario;
exports.isScenarioLaunchFromNativeArguments = isScenarioLaunchFromNativeArguments;
exports.getCurrentScenario = getCurrentScenario;
exports.getScenarioFolderPath = getScenarioFolderPath;
exports.ensureScenarioFolder = ensureScenarioFolder;
function initializeScenario(_config) {
    // Browser: no-op (scenario initialization requires fs)
}
function isScenarioLaunchFromNativeArguments() {
    // Browser: no launch arguments
    return false;
}
function getCurrentScenario() {
    // Browser: always use default scenario
    return 'default';
}
function getScenarioFolderPath(basePath) {
    // Browser: return base path as-is
    return basePath;
}
function ensureScenarioFolder(_basePath) {
    // Browser: no-op
}
