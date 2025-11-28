import { MockifyerConfig, ENV_VARS } from '../types';

let currentConfig: MockifyerConfig | null = null;

/**
 * Initialize date manipulation with the given config
 */
export function initializeDateManipulation(config: MockifyerConfig): void {
  currentConfig = config;
}

/**
 * Get the current date taking into account any date manipulation settings
 */
export function getCurrentDate(): Date {
  // Check environment variables first
  const envDate = process.env[ENV_VARS.MOCK_DATE];
  const envOffset = process.env[ENV_VARS.MOCK_DATE_OFFSET];
  const envTimezone = process.env[ENV_VARS.MOCK_TIMEZONE];

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
  if (!currentConfig?.dateManipulation) {
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
    } catch (error) {
      console.warn(`Invalid timezone: ${timezone}. Using system timezone instead.`);
    }
  }

  return new Date();
}

/**
 * Reset any date manipulation settings
 */
export function resetDateManipulation(): void {
  currentConfig = null;
}

/**
 * Format a date string in ISO format
 */
export function formatDate(date: Date): string {
  return date.toISOString();
}

/**
 * Parse a date string in various formats
 */
export function parseDate(dateString: string): Date {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateString}`);
  }
  return date;
} 