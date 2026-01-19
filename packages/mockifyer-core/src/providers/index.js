"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProvider = createProvider;
__exportStar(require("./types"), exports);
__exportStar(require("./filesystem-provider"), exports);
__exportStar(require("./sqlite-provider"), exports);
__exportStar(require("./memory-provider"), exports);
__exportStar(require("./expo-filesystem-provider"), exports);
__exportStar(require("./hybrid-provider"), exports);
const filesystem_provider_1 = require("./filesystem-provider");
const sqlite_provider_1 = require("./sqlite-provider");
const memory_provider_1 = require("./memory-provider");
const expo_filesystem_provider_1 = require("./expo-filesystem-provider");
const hybrid_provider_1 = require("./hybrid-provider");
/**
 * Create a database provider based on type and config
 *
 * ⚠️ NOTE: Database providers other than 'filesystem' are not yet available for use.
 * This function exists for future use. Only 'filesystem' provider is currently supported.
 */
function createProvider(type, config) {
    switch (type) {
        case 'filesystem':
            return new filesystem_provider_1.FilesystemProvider(config);
        case 'expo-filesystem':
            return new expo_filesystem_provider_1.ExpoFileSystemProvider(config);
        case 'hybrid':
            return new hybrid_provider_1.HybridProvider(config);
        case 'memory':
            return new memory_provider_1.MemoryProvider(config);
        case 'sqlite':
            // SQLite provider exists but may not be fully tested
            return new sqlite_provider_1.SQLiteProvider(config);
        default:
            throw new Error(`Database provider type '${type}' is not supported. ` +
                `Supported types: filesystem, expo-filesystem, hybrid, memory, sqlite`);
    }
}
