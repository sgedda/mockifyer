"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDateManipulation = initializeDateManipulation;
exports.getCurrentDate = getCurrentDate;
exports.resetDateManipulation = resetDateManipulation;
exports.formatDate = formatDate;
exports.parseDate = parseDate;
const types_1 = require("../types");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
let currentConfig = null;
/**
 * Try to load date config from date-config.json file in mock data directory
 */
function loadDateConfigFromFile(mockDataPath) {
    try {
        // Try to detect mock data path if not provided
        let configPath;
        if (mockDataPath) {
            configPath = path_1.default.join(mockDataPath, 'date-config.json');
        }
        else {
            // Try common locations
            const possiblePaths = [
                './mock-data/date-config.json',
                './persisted/mock-data/date-config.json',
                path_1.default.join(process.cwd(), 'mock-data', 'date-config.json'),
                path_1.default.join(process.cwd(), 'persisted', 'mock-data', 'date-config.json'),
            ];
            configPath = possiblePaths.find(p => fs_1.default.existsSync(p)) || '';
        }
        if (!configPath || !fs_1.default.existsSync(configPath)) {
            return null;
        }
        const fileContent = fs_1.default.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(fileContent);
        return config.dateManipulation ? { dateManipulation: config.dateManipulation } : null;
    }
    catch (error) {
        // Silently fail - file might not exist or be invalid
        return null;
    }
}
/**
 * Calculate timezone offset in milliseconds
 */
function getTimezoneOffset(targetTimezone) {
    try {
        const now = new Date();
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        const targetTime = new Date(now.toLocaleString('en-US', { timeZone: targetTimezone }));
        const targetOffset = targetTime.getTime() - utcTime;
        return targetOffset;
    }
    catch (error) {
        console.warn(`Invalid timezone: ${targetTimezone}. Using system timezone instead.`);
        return 0;
    }
}
/**
 * Initialize date manipulation with the given config
 * Note: For global Date manipulation (new Date(), Date.now()), use Sinon or Jest fake timers
 * This function stores the config for use by getCurrentDate()
 */
function initializeDateManipulation(config) {
    currentConfig = config;
    // Config is stored and used by getCurrentDate() to return manipulated dates
    // For global Date manipulation (new Date(), Date.now()), use Sinon or Jest fake timers
    // See documentation for examples
}
/**
 * Get the current date taking into account any date manipulation settings
 *
 * Note: This function returns a manipulated date object, but does NOT affect
 * global Date() or Date.now(). For global date manipulation, use Sinon or Jest fake timers.
 * See documentation for examples.
 */
function getCurrentDate() {
    // Check environment variables first (they take precedence)
    const envDate = process.env[types_1.ENV_VARS.MOCK_DATE];
    const envOffset = process.env[types_1.ENV_VARS.MOCK_DATE_OFFSET];
    const envTimezone = process.env[types_1.ENV_VARS.MOCK_TIMEZONE];
    // Environment variables take precedence over config
    if (envDate) {
        return new Date(envDate);
    }
    if (envOffset) {
        const offset = parseInt(envOffset, 10);
        if (!isNaN(offset)) {
            return new Date(Date.now() + offset);
        }
    }
    // Try to get date manipulation from current config
    let dateManipulation = currentConfig === null || currentConfig === void 0 ? void 0 : currentConfig.dateManipulation;
    // If no config, try to load from date-config.json file
    if (!dateManipulation) {
        const fileConfig = loadDateConfigFromFile(currentConfig === null || currentConfig === void 0 ? void 0 : currentConfig.mockDataPath);
        if (fileConfig === null || fileConfig === void 0 ? void 0 : fileConfig.dateManipulation) {
            dateManipulation = fileConfig.dateManipulation;
        }
    }
    // If still no config, return actual current date
    if (!dateManipulation) {
        return new Date();
    }
    // Use config settings if no environment variables are set
    if (dateManipulation.fixedDate) {
        return typeof dateManipulation.fixedDate === 'string'
            ? new Date(dateManipulation.fixedDate)
            : new Date(dateManipulation.fixedDate);
    }
    if (dateManipulation.offset !== undefined) {
        return new Date(Date.now() + dateManipulation.offset);
    }
    // If timezone is specified, adjust the date
    const timezone = envTimezone || dateManipulation.timezone;
    if (timezone) {
        const date = new Date();
        try {
            return new Date(date.toLocaleString('en-US', { timeZone: timezone }));
        }
        catch (error) {
            console.warn(`Invalid timezone: ${timezone}. Using system timezone instead.`);
        }
    }
    return new Date();
}
/**
 * Reset any date manipulation settings
 * Note: This does NOT restore fake timers if you're using Sinon/Jest fake timers
 * You need to restore those separately (clock.restore() or jest.useRealTimers())
 */
function resetDateManipulation() {
    currentConfig = null;
}
/**
 * Format a date string in ISO format
 */
function formatDate(date) {
    return date.toISOString();
}
/**
 * Parse a date string in various formats
 */
function parseDate(dateString) {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        throw new Error(`Invalid date format: ${dateString}`);
    }
    return date;
}
