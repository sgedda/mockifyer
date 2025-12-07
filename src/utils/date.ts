import { MockifyerConfig, ENV_VARS } from '../types';

// @sinonjs/fake-timers is optional - may not be available in React Native production builds
// We'll try to import it lazily when needed
// Using @sinonjs/fake-timers directly instead of sinon (much smaller, ~200KB vs 5MB+)
let FakeTimers: typeof import('@sinonjs/fake-timers') | null = null;
let clock: any = null; // FakeTimers.InstalledClock | null, but using any for React Native compatibility
let currentConfig: MockifyerConfig | null = null;

/**
 * Try to load @sinonjs/fake-timers (may not be available in React Native)
 */
function tryLoadFakeTimers(): typeof import('@sinonjs/fake-timers') | null {
  if (FakeTimers) {
    return FakeTimers;
  }
  
  try {
    // Try to require @sinonjs/fake-timers (works in Node.js and React Native)
    FakeTimers = require('@sinonjs/fake-timers');
    return FakeTimers;
  } catch (error) {
    // Fake timers not available (e.g., React Native production build)
    // Date manipulation will still work via fallback in getCurrentDate()
    return null;
  }
}

/**
 * Calculate timezone offset in milliseconds
 */
function getTimezoneOffset(targetTimezone: string): number {
  try {
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const targetTime = new Date(now.toLocaleString('en-US', { timeZone: targetTimezone }));
    const targetOffset = targetTime.getTime() - utcTime;
    return targetOffset;
  } catch (error) {
    console.warn(`Invalid timezone: ${targetTimezone}. Using system timezone instead.`);
    return 0;
  }
}

/**
 * Initialize date manipulation with the given config using fake timers
 */
export function initializeDateManipulation(config: MockifyerConfig): void {
  // Restore any existing clock first
  // Use try-catch because fake timers may throw if clock is already restored
  if (clock) {
    try {
      clock.uninstall();
    } catch (error) {
      // Clock may have been restored externally (e.g., in tests)
      // Ignore the error and continue
    }
    clock = null;
  }

  currentConfig = config;

  // Check environment variables first (they take precedence)
  const envDate = process.env[ENV_VARS.MOCK_DATE];
  const envOffset = process.env[ENV_VARS.MOCK_DATE_OFFSET];
  const envTimezone = process.env[ENV_VARS.MOCK_TIMEZONE];

  let targetTime: number | undefined;

  // Environment variables take precedence over config
  if (envDate) {
    targetTime = new Date(envDate).getTime();
  } else if (envOffset) {
    const offset = parseInt(envOffset, 10);
    if (!isNaN(offset)) {
      targetTime = Date.now() + offset;
    }
  } else if (currentConfig?.dateManipulation) {
    const { dateManipulation } = currentConfig;

    if (dateManipulation.fixedDate) {
      targetTime = typeof dateManipulation.fixedDate === 'string' 
        ? new Date(dateManipulation.fixedDate).getTime()
        : dateManipulation.fixedDate.getTime();
    } else if (dateManipulation.offset !== undefined) {
      targetTime = Date.now() + dateManipulation.offset;
    }
  }

  // Handle timezone
  const timezone = envTimezone || currentConfig?.dateManipulation?.timezone;
  if (timezone) {
    if (targetTime !== undefined) {
      // Apply timezone offset to the target time
      const timezoneOffset = getTimezoneOffset(timezone);
      targetTime = targetTime + timezoneOffset;
    } else {
      // If only timezone is set (no fixedDate or offset), calculate current time in that timezone
      try {
        const now = new Date();
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        const targetTimeInTimezone = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
        const timezoneOffset = targetTimeInTimezone.getTime() - utcTime;
        targetTime = Date.now() + timezoneOffset;
      } catch (error) {
        // Invalid timezone - don't set up clock, fall back to manual calculation in getCurrentDate
        console.warn(`Invalid timezone: ${timezone}. Using system timezone instead.`);
      }
    }
  }

  // Set up fake timers if we have a target time
  // Note: @sinonjs/fake-timers may not be available in React Native production builds
  // If fake timers aren't available, date manipulation will still work via getCurrentDate() fallback
  if (targetTime !== undefined) {
    const fakeTimersLib = tryLoadFakeTimers();
    
    if (fakeTimersLib) {
      // Try to install fake timers with the target time
      // If timers are already installed, this will throw an error which we'll catch
      try {
        clock = fakeTimersLib.install({
          now: targetTime,
          toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate']
        });
      } catch (error: any) {
        // If timers are already installed (e.g., from tests), try to uninstall first
        if (error.message && (error.message.includes('fake timers') || error.message.includes('already installed'))) {
          try {
            // Try to uninstall by creating a temporary clock and uninstalling it
            // This is a workaround since @sinonjs/fake-timers doesn't expose a way to check if timers are installed
            const tempTimers = fakeTimersLib.install({ now: Date.now() });
            tempTimers.uninstall();
            // Now try installing again with the target time
            clock = fakeTimersLib.install({
              now: targetTime,
              toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate']
            });
          } catch (retryError) {
            // For React Native or other environments where fake timers fail, fall back silently
            // Date manipulation will still work via getCurrentDate() fallback
            console.warn('[Mockifyer] Could not set up fake timers. Date manipulation will use fallback method.');
            clock = null;
          }
        } else {
          // For React Native or other environments where fake timers fail, fall back silently
          // Date manipulation will still work via getCurrentDate() fallback
          console.warn('[Mockifyer] Could not set up fake timers. Date manipulation will use fallback method.');
          clock = null;
        }
      }
    } else {
      // Fake timers not available (e.g., React Native production build)
      // Date manipulation will still work via getCurrentDate() fallback
      clock = null;
    }
  }
}

/**
 * Get the current date taking into account any date manipulation settings
 * With fake timers, new Date() and Date.now() will return the fake time
 */
export function getCurrentDate(): Date {
  // If fake timers clock is active, new Date() will return the fake time
  if (clock) {
    return new Date();
  }

  // Check environment variables first (fallback for when clock isn't set)
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
    } catch (error) {
      console.warn(`Invalid timezone: ${timezone}. Using system timezone instead.`);
    }
  }

  return new Date();
}

/**
 * Reset any date manipulation settings and restore real timers
 */
export function resetDateManipulation(): void {
  if (clock) {
    try {
      clock.uninstall();
    } catch (error) {
      // Clock may have been restored externally or fake timers may not be available
      // Ignore the error and continue
    }
    clock = null;
  }
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
