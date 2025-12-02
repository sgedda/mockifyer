import { MockifyerConfig, ENV_VARS } from '../types';

// Sinon is optional - may not be available in React Native production builds
// We'll try to import it lazily when needed
let sinon: typeof import('sinon') | null = null;
let clock: any = null; // sinon.SinonFakeTimers | null, but using any for React Native compatibility
let currentConfig: MockifyerConfig | null = null;

/**
 * Try to load Sinon (may not be available in React Native)
 */
function tryLoadSinon(): typeof import('sinon') | null {
  if (sinon) {
    return sinon;
  }
  
  try {
    // Try to require sinon (works in Node.js and some React Native setups)
    sinon = require('sinon');
    return sinon;
  } catch (error) {
    // Sinon not available (e.g., React Native production build)
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
 * Initialize date manipulation with the given config using Sinon fake timers
 */
export function initializeDateManipulation(config: MockifyerConfig): void {
  // Restore any existing clock first
  // Use try-catch because Sinon may throw if clock is already restored
  if (clock) {
    try {
      clock.restore();
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

  // Set up Sinon fake timers if we have a target time
  // Note: Sinon may not be available in React Native production builds
  // If Sinon isn't available, date manipulation will still work via getCurrentDate() fallback
  if (targetTime !== undefined) {
    const sinonLib = tryLoadSinon();
    
    if (sinonLib) {
      // Try to restore any existing fake timers first (e.g., from tests)
      // This prevents "Can't install fake timers twice" errors
      try {
        clock = sinonLib.useFakeTimers({
          now: targetTime,
          toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate']
        });
      } catch (error: any) {
        // If there's already a clock installed, try to restore it
        if (error.message && error.message.includes('fake timers twice')) {
          // Try to access and restore the existing clock using @sinonjs/fake-timers
          try {
            const FakeTimers = require('@sinonjs/fake-timers');
            // Get all installed clocks and uninstall them
            // @sinonjs/fake-timers stores clocks in a WeakMap, but we can try to uninstall
            // by creating a new timers instance and checking for existing ones
            const timers = FakeTimers.withGlobal(global);
            // Try to uninstall any existing timers
            // This is a workaround - we create a temporary clock to get access to uninstall
            const tempTimers = FakeTimers.install({ now: Date.now() });
            tempTimers.uninstall();
          } catch (uninstallError) {
            // If that doesn't work, try using sandbox
            try {
              const sandbox = sinonLib.createSandbox();
              sandbox.restore();
            } catch (sandboxError) {
              // If sandbox doesn't work either, we're out of options
              // The test should restore the clock before calling setupMockifyer
            }
          }
          // Now try again
          clock = sinonLib.useFakeTimers({
            now: targetTime,
            toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate']
          });
        } else {
          // For React Native or other environments where Sinon fails, fall back silently
          // Date manipulation will still work via getCurrentDate() fallback
          console.warn('[Mockifyer] Could not set up Sinon fake timers. Date manipulation will use fallback method.');
          clock = null;
        }
      }
    } else {
      // Sinon not available (e.g., React Native production build)
      // Date manipulation will still work via getCurrentDate() fallback
      clock = null;
    }
  }
}

/**
 * Get the current date taking into account any date manipulation settings
 * With Sinon fake timers, new Date() and Date.now() will return the fake time
 */
export function getCurrentDate(): Date {
  // If Sinon clock is active, new Date() will return the fake time
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
      clock.restore();
    } catch (error) {
      // Clock may have been restored externally or Sinon may not be available
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