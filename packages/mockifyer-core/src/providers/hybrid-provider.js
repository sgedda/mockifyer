"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HybridProvider = void 0;
const expo_filesystem_provider_1 = require("./expo-filesystem-provider");
/**
 * Hybrid Provider for React Native/Expo applications
 *
 * Saves mock data to BOTH:
 * 1. Device filesystem (via ExpoFileSystemProvider) - for app access
 * 2. Project folder (via Metro HTTP endpoint) - for version control
 *
 * This eliminates the need for polling-based sync - files are immediately
 * available in the project folder when saved.
 *
 * @example
 * ```typescript
 * const provider = new HybridProvider({
 *   path: 'mock-data',
 *   metroPort: 8081, // Optional, defaults to 8081
 * });
 * await provider.initialize();
 * ```
 */
class HybridProvider {
    constructor(config) {
        var _a;
        if (!config.path) {
            throw new Error('HybridProvider requires a path in config');
        }
        // Pass watch options to ExpoFileSystemProvider
        const deviceProviderConfig = {
            ...config,
            options: {
                ...config.options,
                // Watch options are passed through to ExpoFileSystemProvider
            },
        };
        this.deviceProvider = new expo_filesystem_provider_1.ExpoFileSystemProvider(deviceProviderConfig);
        this.metroPort = config.metroPort || ((_a = config.options) === null || _a === void 0 ? void 0 : _a.metroPort) || 8081;
        this.metroUrl = `http://localhost:${this.metroPort}`;
    }
    async initialize() {
        await this.deviceProvider.initialize();
    }
    /**
     * Save mock data to both device and project folder
     */
    async save(mockData) {
        var _a, _b, _c;
        // CRITICAL: Never save Mockifyer sync endpoint requests to prevent infinite loops
        const url = mockData.request.url || '';
        if (url.includes('/mockifyer-save') || url.includes('/mockifyer-clear') || url.includes('/mockifyer-sync')) {
            return;
        }
        // CRITICAL: Check response data for Metro rejection messages FIRST (most common case)
        try {
            const responseDataStr = typeof ((_a = mockData.response) === null || _a === void 0 ? void 0 : _a.data) === 'string'
                ? mockData.response.data
                : JSON.stringify(((_b = mockData.response) === null || _b === void 0 ? void 0 : _b.data) || {});
            const responseDataObj = (_c = mockData.response) === null || _c === void 0 ? void 0 : _c.data;
            // Check for Metro rejection message
            const hasRejectionMessage = responseDataStr.includes('Cannot save Mockifyer sync endpoint');
            const hasRejectionInObject = responseDataObj &&
                typeof responseDataObj === 'object' &&
                'error' in responseDataObj &&
                typeof responseDataObj.error === 'string' &&
                responseDataObj.error.includes('Cannot save Mockifyer sync endpoint');
            if (hasRejectionMessage || hasRejectionInObject) {
                return;
            }
            // Check for sync endpoint URLs in response data
            if (responseDataStr.includes('/mockifyer-save') ||
                responseDataStr.includes('/mockifyer-clear') ||
                responseDataStr.includes('/mockifyer-sync')) {
                return;
            }
        }
        catch (e) {
            // Ignore JSON stringify errors
            console.warn(`[HybridProvider] Error checking response data:`, e);
        }
        // Save to device first (primary storage)
        try {
            await this.deviceProvider.save(mockData);
        }
        catch (error) {
            console.error(`[HybridProvider] Error saving to device filesystem:`, error);
            throw error; // Re-throw device save errors
        }
        // Also save to project folder via Metro HTTP endpoint
        try {
            await this.saveToProjectFolder(mockData);
        }
        catch (error) {
            // Don't fail if Metro endpoint is unavailable (e.g., Metro not running)
            // Device save already succeeded, so we just log a warning
            console.warn('[HybridProvider] Failed to save to project folder via Metro:', error);
        }
    }
    /**
     * Save mock data to project folder via Metro HTTP endpoint
     */
    async saveToProjectFolder(mockData) {
        var _a, _b, _c, _d;
        // CRITICAL: Never attempt to save sync endpoint requests to project folder
        // This prevents infinite loops when Metro rejects the save
        const url = ((_a = mockData.request) === null || _a === void 0 ? void 0 : _a.url) || '';
        if (url.includes('/mockifyer-save') || url.includes('/mockifyer-clear') || url.includes('/mockifyer-sync')) {
            console.warn('[HybridProvider] ⚠️ BLOCKING saveToProjectFolder - request URL is a sync endpoint:', url);
            return;
        }
        // CRITICAL: Also check response data for Metro rejection messages
        // If Metro already rejected this, don't try again
        try {
            const responseDataStr = typeof ((_b = mockData.response) === null || _b === void 0 ? void 0 : _b.data) === 'string'
                ? mockData.response.data
                : JSON.stringify(((_c = mockData.response) === null || _c === void 0 ? void 0 : _c.data) || {});
            const responseDataObj = (_d = mockData.response) === null || _d === void 0 ? void 0 : _d.data;
            const hasRejectionMessage = responseDataStr.includes('Cannot save Mockifyer sync endpoint');
            const hasRejectionInObject = responseDataObj &&
                typeof responseDataObj === 'object' &&
                'error' in responseDataObj &&
                typeof responseDataObj.error === 'string' &&
                responseDataObj.error.includes('Cannot save Mockifyer sync endpoint');
            if (hasRejectionMessage || hasRejectionInObject) {
                console.warn('[HybridProvider] ⚠️ BLOCKING saveToProjectFolder - response contains Metro rejection message');
                return;
            }
        }
        catch (e) {
            // Ignore errors
        }
        // React Native has global fetch available
        if (typeof fetch === 'undefined') {
            throw new Error('fetch is not available. This provider requires React Native environment.');
        }
        // CRITICAL: Check if mockData contains nested Mockifyer sync requests to prevent loops
        const mockDataStr = JSON.stringify(mockData);
        if (mockDataStr.includes('/mockifyer-save') || mockDataStr.includes('/mockifyer-clear') || mockDataStr.includes('/mockifyer-sync')) {
            console.warn('[HybridProvider] ⚠️ BLOCKING saveToProjectFolder - mockData contains nested Mockifyer sync requests');
            return;
        }
        // CRITICAL: Use original fetch to completely bypass Mockifyer interception
        // Get the true original fetch (before any Mockifyer patching)
        // This ensures the request and response never go through Mockifyer's interceptors
        const originalFetch = global.__mockifyer_original_fetch;
        if (!originalFetch) {
            // Fallback: if original fetch not stored, try to get it from global
            // But warn that this might not bypass Mockifyer if global fetch is patched
            const fallbackFetch = typeof fetch !== 'undefined' ? fetch : undefined;
            if (!fallbackFetch) {
                throw new Error('Original fetch not available. Cannot save to project folder.');
            }
            console.warn('[HybridProvider] ⚠️ Using fallback fetch - original fetch not stored. This may not bypass Mockifyer.');
        }
        const fetchFn = originalFetch || (typeof fetch !== 'undefined' ? fetch : undefined);
        if (!fetchFn) {
            throw new Error('Fetch function not available. Cannot save to project folder.');
        }
        // CRITICAL: Use originalFetch directly - this returns a native Response object
        // Native Response objects do NOT go through axios interceptors, so they're completely bypassed
        const response = await fetchFn(`${this.metroUrl}/mockifyer-save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: mockDataStr,
        });
        if (!response.ok) {
            const errorText = await response.text().catch(() => response.statusText);
            throw new Error(`Metro endpoint returned ${response.status}: ${errorText}`);
        }
        const result = await response.json();
        // CRITICAL: If Metro rejected the save (e.g., because it contains sync endpoints), don't throw
        // This prevents infinite loops when Metro correctly rejects problematic requests
        if (!result.success) {
            console.warn(`[HybridProvider] ⚠️ Metro rejected save: ${result.error || 'Unknown error'}`);
            // Don't throw - this is expected behavior when Metro rejects sync endpoint requests
            return;
        }
        // If file was skipped (already exists), that's fine
        if (result.skipped) {
            return;
        }
    }
    /**
     * Find exact match - delegate to device provider
     */
    async findExactMatch(request, requestKey) {
        return this.deviceProvider.findExactMatch(request, requestKey);
    }
    /**
     * Find all for similar match - delegate to device provider
     */
    async findAllForSimilarMatch(request) {
        return this.deviceProvider.findAllForSimilarMatch(request);
    }
    /**
     * Check if mock exists - delegate to device provider
     */
    async exists(requestKey) {
        return this.deviceProvider.exists(requestKey);
    }
    /**
     * Get all mocks - delegate to device provider
     */
    async getAll() {
        return this.deviceProvider.getAll();
    }
    /**
     * Get the device mock data path
     */
    getMockDataPath() {
        return this.deviceProvider.getMockDataPath();
    }
    /**
     * Clear all mocks from both device and project folder
     */
    async clearAll() {
        // Clear device filesystem
        if (this.deviceProvider.clearAll) {
            await this.deviceProvider.clearAll();
        }
        // Also try to clear project folder via Metro endpoint
        try {
            // CRITICAL: Use original fetch to bypass Mockifyer interception and prevent infinite loops
            // Get the true original fetch (before any Mockifyer patching)
            const originalFetch = global.__mockifyer_original_fetch || (typeof fetch !== 'undefined' ? fetch : undefined);
            if (!originalFetch) {
                console.warn('[HybridProvider] Original fetch not available. Skipping Metro clear.');
                return;
            }
            const response = await originalFetch(`${this.metroUrl}/mockifyer-clear`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            // Read the response body to ensure the request completes, but don't parse it
            // This prevents any potential response interception
            await response.text().catch(() => { });
            if (!response.ok) {
                console.warn(`[HybridProvider] Failed to clear project folder via Metro: ${response.status}`);
            }
        }
        catch (error) {
            console.warn('[HybridProvider] Failed to clear project folder via Metro:', error);
        }
    }
    /**
     * Reload mock files (clears cache so files are re-read)
     * Optionally syncs files from project folder to device first
     */
    async reload(syncFromProject = true) {
        // If syncFromProject is true, sync files from project folder to device first
        if (syncFromProject) {
            try {
                await this.syncFromProjectFolder();
            }
            catch (error) {
                console.warn('[HybridProvider] Failed to sync from project folder:', error);
                // Continue with reload even if sync fails
            }
        }
        // Then reload the device provider cache
        if (this.deviceProvider && typeof this.deviceProvider.reload === 'function') {
            await this.deviceProvider.reload();
        }
    }
    /**
     * Sync mock files from project folder to device via Metro endpoint
     */
    async syncFromProjectFolder() {
        try {
            // Fetch files from Metro endpoint
            const originalFetch = global.__mockifyer_original_fetch || fetch;
            const response = await originalFetch(`${this.metroUrl}/mockifyer-sync-to-device`);
            if (!response.ok) {
                throw new Error(`Metro endpoint returned ${response.status}: ${response.statusText}`);
            }
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Unknown error syncing from project folder');
            }
            if (!result.files || result.files.length === 0) {
                return;
            }
            // Save each file to device
            let savedCount = 0;
            for (const fileData of result.files) {
                try {
                    // Save to device using the device provider
                    await this.deviceProvider.save(fileData.content);
                    savedCount++;
                }
                catch (error) {
                    console.warn(`[HybridProvider] Failed to save ${fileData.filename}:`, error);
                }
            }
        }
        catch (error) {
            // Don't throw - Metro might not be running or endpoint might not be available
            console.warn('[HybridProvider] ⚠️ Failed to sync from project folder via Metro:', error.message);
            throw error; // Re-throw so caller knows sync failed
        }
    }
    /**
     * Cleanup resources
     */
    close() {
        if (this.deviceProvider && typeof this.deviceProvider.close === 'function') {
            this.deviceProvider.close();
        }
    }
}
exports.HybridProvider = HybridProvider;
