import { MockifyerConfig } from '../types';
/**
 * Initialize date manipulation with the given config
 * Note: For global Date manipulation (new Date(), Date.now()), use Sinon or Jest fake timers
 * This function stores the config for use by getCurrentDate()
 */
export declare function initializeDateManipulation(config: MockifyerConfig): void;
/**
 * Get the current date taking into account any date manipulation settings
 *
 * Note: This function returns a manipulated date object, but does NOT affect
 * global Date() or Date.now(). For global date manipulation, use Sinon or Jest fake timers.
 * See documentation for examples.
 */
export declare function getCurrentDate(): Date;
/**
 * Reset any date manipulation settings
 * Note: This does NOT restore fake timers if you're using Sinon/Jest fake timers
 * You need to restore those separately (clock.restore() or jest.useRealTimers())
 */
export declare function resetDateManipulation(): void;
/**
 * Format a date string in ISO format
 */
export declare function formatDate(date: Date): string;
/**
 * Parse a date string in various formats
 */
export declare function parseDate(dateString: string): Date;
//# sourceMappingURL=date.d.ts.map