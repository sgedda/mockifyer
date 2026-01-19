"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryProvider = void 0;
const mock_matcher_1 = require("../utils/mock-matcher");
/**
 * In-memory provider for React Native/Expo and other environments without filesystem access
 * Stores mock data in memory - data is lost when the app restarts
 * Perfect for development and testing scenarios
 */
class MemoryProvider {
    constructor(config) {
        this.mocks = new Map();
        this.mockCounter = 0;
        // Memory provider doesn't need any config, but we accept it for consistency
    }
    initialize() {
        // Nothing to initialize for in-memory storage
        console.log('[Mockifyer] MemoryProvider initialized (in-memory storage)');
    }
    save(mockData) {
        const requestKey = (0, mock_matcher_1.generateRequestKey)(mockData.request);
        this.mocks.set(requestKey, mockData);
        this.mockCounter++;
        console.log(`[Mockifyer] Saved mock to memory: ${requestKey.substring(0, 100)}... (Total: ${this.mockCounter})`);
    }
    findExactMatch(request, requestKey) {
        const mockData = this.mocks.get(requestKey);
        if (!mockData) {
            return undefined;
        }
        return {
            mockData,
            filename: `memory_${requestKey.substring(0, 50)}.json`,
            filePath: 'memory://' // Virtual path for compatibility
        };
    }
    findAllForSimilarMatch(request) {
        const results = [];
        try {
            const requestUrl = new URL(request.url);
            const requestPath = requestUrl.pathname;
            const requestMethod = (request.method || 'GET').toUpperCase();
            for (const [key, mockData] of this.mocks.entries()) {
                try {
                    const mockUrl = new URL(mockData.request.url);
                    const mockPath = mockUrl.pathname;
                    const mockMethod = (mockData.request.method || 'GET').toUpperCase();
                    if (mockPath === requestPath && mockMethod === requestMethod) {
                        results.push({
                            mockData,
                            filename: `memory_${key.substring(0, 50)}.json`,
                            filePath: 'memory://'
                        });
                    }
                }
                catch (e) {
                    // Invalid URL, skip
                    continue;
                }
            }
        }
        catch (e) {
            // Invalid request URL, return empty
            return [];
        }
        // Sort by timestamp descending (most recent first)
        return results.sort((a, b) => {
            const timeA = new Date(a.mockData.timestamp).getTime();
            const timeB = new Date(b.mockData.timestamp).getTime();
            return timeB - timeA;
        });
    }
    exists(requestKey) {
        return this.mocks.has(requestKey);
    }
    getAll() {
        return Array.from(this.mocks.values()).sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return timeB - timeA; // Most recent first
        });
    }
    /**
     * Clear all stored mocks (useful for testing)
     */
    clear() {
        this.mocks.clear();
        this.mockCounter = 0;
        console.log('[Mockifyer] MemoryProvider cleared all mocks');
    }
    /**
     * Clear all stored mocks (alias for clear() to match DatabaseProvider interface)
     */
    clearAll() {
        this.clear();
    }
    /**
     * Get the number of stored mocks
     */
    size() {
        return this.mocks.size;
    }
}
exports.MemoryProvider = MemoryProvider;
