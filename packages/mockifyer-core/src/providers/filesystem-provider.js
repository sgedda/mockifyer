"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilesystemProvider = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const mock_matcher_1 = require("../utils/mock-matcher");
const scenario_1 = require("../utils/scenario");
/**
 * Filesystem-based provider (current default implementation)
 * Stores mock data as JSON files in a directory
 *
 * Note: This provider requires Node.js fs module and will not work in React Native.
 * For React Native, use ExpoFileSystemProvider instead.
 */
class FilesystemProvider {
    constructor(config) {
        if (!config.path) {
            throw new Error('FilesystemProvider requires a path in config');
        }
        this.mockDataPath = config.path;
        // Check if fs is available (will be false in React Native where fs is stubbed)
        this.fsAvailable = typeof fs_1.default !== 'undefined' && typeof fs_1.default.existsSync === 'function';
        if (!this.fsAvailable) {
            console.warn('[Mockifyer] FilesystemProvider: Node.js fs module is not available. ' +
                'This provider requires Node.js environment. For React Native, use ExpoFileSystemProvider.');
        }
    }
    initialize() {
        if (!this.fsAvailable) {
            throw new Error('FilesystemProvider requires Node.js fs module. ' +
                'For React Native, use ExpoFileSystemProvider instead.');
        }
        if (!fs_1.default.existsSync(this.mockDataPath)) {
            fs_1.default.mkdirSync(this.mockDataPath, { recursive: true });
        }
        // Ensure scenario folder exists
        const currentScenario = (0, scenario_1.getCurrentScenario)(this.mockDataPath);
        (0, scenario_1.ensureScenarioFolder)(this.mockDataPath, currentScenario);
    }
    /**
     * Get the scenario-specific path for mock files
     */
    getScenarioPath() {
        const currentScenario = (0, scenario_1.getCurrentScenario)(this.mockDataPath);
        return (0, scenario_1.getScenarioFolderPath)(this.mockDataPath, currentScenario);
    }
    save(mockData) {
        var _a;
        if (!this.fsAvailable) {
            throw new Error('FilesystemProvider requires Node.js fs module. ' +
                'For React Native, use ExpoFileSystemProvider instead.');
        }
        // CRITICAL: Never save Resend API requests - they should never be mocked
        const requestUrl = ((_a = mockData === null || mockData === void 0 ? void 0 : mockData.request) === null || _a === void 0 ? void 0 : _a.url) || '';
        if (requestUrl.includes('api.resend.com')) {
            console.log(`[FilesystemProvider] ⚠️ Skipping save - Resend API request: ${requestUrl}`);
            return;
        }
        const scenarioPath = this.getScenarioPath();
        (0, scenario_1.ensureScenarioFolder)(this.mockDataPath, (0, scenario_1.getCurrentScenario)(this.mockDataPath));
        // Check request limit before saving (only if limit is set via env var)
        const limitCheck = (0, scenario_1.checkRequestLimit)(this.mockDataPath);
        if (limitCheck.limitReached && limitCheck.error) {
            console.warn(`[Mockifyer] ⚠️ ${limitCheck.error.message}`);
            // Don't throw - just log and return to prevent app crash
            return;
        }
        // Format the datetime to be readable
        const now = new Date();
        const dateStr = now.toISOString()
            .replace(/T/, '_')
            .replace(/\..+/, '')
            .replace(/:/g, '-');
        // Create a safe filename from the URL
        const urlSafe = mockData.request.url
            .replace(/^https?:\/\//, '')
            .replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `${dateStr}_${mockData.request.method}_${urlSafe}.json`;
        const filePath = path_1.default.join(scenarioPath, filename);
        // Write to file
        fs_1.default.writeFileSync(filePath, JSON.stringify(mockData, null, 2));
        const currentScenario = (0, scenario_1.getCurrentScenario)(this.mockDataPath);
        console.log(`[Mockifyer] Saved new mock to file: ${currentScenario}/${filename}`);
    }
    findExactMatch(request, requestKey) {
        if (!this.fsAvailable || !fs_1.default.existsSync(this.mockDataPath)) {
            return undefined;
        }
        const scenarioPath = this.getScenarioPath();
        if (!fs_1.default.existsSync(scenarioPath)) {
            return undefined;
        }
        const files = fs_1.default.readdirSync(scenarioPath)
            .filter(file => file.endsWith('.json'));
        for (const file of files) {
            try {
                const filePath = path_1.default.join(scenarioPath, file);
                const fileContent = fs_1.default.readFileSync(filePath, 'utf-8');
                const mockData = JSON.parse(fileContent);
                if (!(mockData === null || mockData === void 0 ? void 0 : mockData.request) || typeof mockData.request !== 'object') {
                    continue;
                }
                // Generate key for this mock and compare with requested key
                const mockKey = (0, mock_matcher_1.generateRequestKey)(mockData.request);
                if (mockKey === requestKey) {
                    return {
                        mockData,
                        filename: file,
                        filePath: filePath
                    };
                }
            }
            catch (error) {
                console.warn(`[Mockifyer] Failed to load mock file ${file}:`, error);
            }
        }
        return undefined;
    }
    findAllForSimilarMatch(request) {
        if (!this.fsAvailable || !fs_1.default.existsSync(this.mockDataPath)) {
            return [];
        }
        const scenarioPath = this.getScenarioPath();
        if (!fs_1.default.existsSync(scenarioPath)) {
            return [];
        }
        const files = fs_1.default.readdirSync(scenarioPath)
            .filter(file => file.endsWith('.json'));
        const results = [];
        for (const file of files) {
            try {
                const filePath = path_1.default.join(scenarioPath, file);
                const fileContent = fs_1.default.readFileSync(filePath, 'utf-8');
                const mockData = JSON.parse(fileContent);
                if (!(mockData === null || mockData === void 0 ? void 0 : mockData.request) || typeof mockData.request !== 'object') {
                    continue;
                }
                // Check if path and method match
                try {
                    const requestUrl = new URL(request.url);
                    const mockUrl = new URL(mockData.request.url);
                    const requestPath = requestUrl.pathname;
                    const mockPath = mockUrl.pathname;
                    if (mockPath === requestPath &&
                        (mockData.request.method || 'GET').toUpperCase() === (request.method || 'GET').toUpperCase()) {
                        results.push({
                            mockData,
                            filename: file,
                            filePath: filePath
                        });
                    }
                }
                catch (e) {
                    // Invalid URL, skip
                    continue;
                }
            }
            catch (error) {
                console.warn(`[Mockifyer] Failed to load mock file ${file}:`, error);
            }
        }
        return results;
    }
    exists(requestKey) {
        // For filesystem provider, we can't efficiently check existence by key
        // without reading all files. This will be handled by findExactMatch
        return false;
    }
    getAll() {
        if (!this.fsAvailable || !fs_1.default.existsSync(this.mockDataPath)) {
            return [];
        }
        const scenarioPath = this.getScenarioPath();
        if (!fs_1.default.existsSync(scenarioPath)) {
            return [];
        }
        const files = fs_1.default.readdirSync(scenarioPath)
            .filter(file => file.endsWith('.json'));
        const results = [];
        for (const file of files) {
            try {
                const filePath = path_1.default.join(scenarioPath, file);
                const fileContent = fs_1.default.readFileSync(filePath, 'utf-8');
                const mockData = JSON.parse(fileContent);
                results.push(mockData);
            }
            catch (error) {
                console.warn(`[Mockifyer] Failed to load mock file ${file}:`, error);
            }
        }
        return results;
    }
}
exports.FilesystemProvider = FilesystemProvider;
