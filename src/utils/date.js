"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDateManipulation = initializeDateManipulation;
exports.getCurrentDate = getCurrentDate;
exports.resetDateManipulation = resetDateManipulation;
exports.formatDate = formatDate;
exports.parseDate = parseDate;
const types_1 = require("../types");
let currentConfig = null;
/**
 * Initialize date manipulation with the given config
 */
function initializeDateManipulation(config) {
    currentConfig = config;
}
/**
 * Get the current date taking into account any date manipulation settings
 */
function getCurrentDate() {
    // Check environment variables first
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
    // If no config is set, return actual current date
    if (!(currentConfig === null || currentConfig === void 0 ? void 0 : currentConfig.dateManipulation)) {
        return new Date();
    }
    const { dateManipulation } = currentConfig;
    // Use config settings if no environment variables are set
    if (dateManipulation.fixedDate) {
        return new Date(dateManipulation.fixedDate);
    }
    if (dateManipulation.offset) {
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
