import { setupMockifyer, getCurrentDate, resetDateManipulation } from '../src';

describe('Date Manipulation', () => {
  const fixedBaseTime = new Date('2024-01-01T00:00:00.000Z').getTime();
  let originalNow: () => number;
  let RealDate: DateConstructor;

  beforeEach(() => {
    resetDateManipulation();
    // Clear any environment variables that might affect tests
    delete process.env.MOCKIFYER_DATE;
    delete process.env.MOCKIFYER_DATE_OFFSET;
    delete process.env.MOCKIFYER_TIMEZONE;
    
    // Store original Date
    RealDate = global.Date;
    
    // Mock Date constructor and Date.now
    const MockDate = class extends RealDate {
      constructor();
      constructor(value: string | number | Date);
      constructor(year: number, month: number, date?: number, hours?: number, minutes?: number, seconds?: number, ms?: number);
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(fixedBaseTime);
        } else {
          super(...(args as [any]));
        }
      }
      
      static now() {
        return fixedBaseTime;
      }
    } as DateConstructor;
    
    global.Date = MockDate;
    originalNow = Date.now;
    Date.now = jest.fn(() => fixedBaseTime);
  });

  afterEach(() => {
    // Restore original Date and Date.now
    global.Date = RealDate;
    Date.now = originalNow;
  });

  describe('Fixed Date', () => {
    it('should use the fixed date when specified', () => {
      const fixedDate = '2024-12-25T12:00:00.000Z';
      setupMockifyer({
        mockDataPath: './mock-data',
        dateManipulation: {
          fixedDate
        }
      });

      const result = getCurrentDate();
      expect(result.toISOString()).toBe(fixedDate);
    });

    it('should accept Date object as fixed date', () => {
      const fixedDate = new Date('2024-12-25T12:00:00Z');
      setupMockifyer({
        mockDataPath: './mock-data',
        dateManipulation: {
          fixedDate
        }
      });

      const result = getCurrentDate();
      expect(result.toISOString()).toBe(fixedDate.toISOString());
    });
  });

  describe('Date Offset', () => {
    it('should apply positive offset correctly', () => {
      const offset = 24 * 60 * 60 * 1000; // 1 day in milliseconds
      setupMockifyer({
        mockDataPath: './mock-data',
        dateManipulation: {
          offset
        }
      });

      const result = getCurrentDate();
      const expected = new Date('2024-01-02T00:00:00.000Z');
      expect(result.toISOString()).toBe(expected.toISOString());
    });

    it('should apply negative offset correctly', () => {
      const offset = -24 * 60 * 60 * 1000; // -1 day in milliseconds
      setupMockifyer({
        mockDataPath: './mock-data',
        dateManipulation: {
          offset
        }
      });

      const result = getCurrentDate();
      const expected = new Date('2023-12-31T00:00:00.000Z');
      expect(result.toISOString()).toBe(expected.toISOString());
    });
  });

  describe('Environment Variables', () => {
    it('should use MOCKIFYER_DATE when set', () => {
      const envDate = '2025-01-01T00:00:00.000Z';
      process.env.MOCKIFYER_DATE = envDate;
      
      setupMockifyer({
        mockDataPath: './mock-data',
        dateManipulation: {
          fixedDate: '2024-12-25T12:00:00.000Z' // Should be overridden by env var
        }
      });

      const result = getCurrentDate();
      expect(result.toISOString()).toBe(envDate);
    });

    it('should use MOCKIFYER_DATE_OFFSET when set', () => {
      const offset = 24 * 60 * 60 * 1000; // 1 day in milliseconds
      process.env.MOCKIFYER_DATE_OFFSET = offset.toString();
      
      setupMockifyer({
        mockDataPath: './mock-data'
      });

      const result = getCurrentDate();
      const expected = new Date('2024-01-02T00:00:00.000Z');
      expect(result.toISOString()).toBe(expected.toISOString());
    });
  });

  describe('Timezone', () => {
    it('should handle timezone correctly', () => {
      setupMockifyer({
        mockDataPath: './mock-data',
        dateManipulation: {
          timezone: 'UTC',
          fixedDate: '2024-12-25T12:00:00.000Z'
        }
      });

      const result = getCurrentDate();
      expect(result.toISOString()).toBe('2024-12-25T12:00:00.000Z');
    });

    it('should handle invalid timezone gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      setupMockifyer({
        mockDataPath: './mock-data',
        dateManipulation: {
          timezone: 'Invalid/Timezone'
        }
      });

      getCurrentDate();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Invalid timezone: Invalid/Timezone. Using system timezone instead.'
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Priority Order', () => {
    it('should prioritize environment variables over config', () => {
      const envDate = '2025-01-01T00:00:00.000Z';
      process.env.MOCKIFYER_DATE = envDate;
      
      setupMockifyer({
        mockDataPath: './mock-data',
        dateManipulation: {
          fixedDate: '2024-12-25T12:00:00.000Z',
          offset: 1000,
          timezone: 'UTC'
        }
      });

      const result = getCurrentDate();
      expect(result.toISOString()).toBe(envDate);
    });

    it('should use config when no environment variables are set', () => {
      const fixedDate = '2024-12-25T12:00:00.000Z';
      
      setupMockifyer({
        mockDataPath: './mock-data',
        dateManipulation: {
          fixedDate
        }
      });

      const result = getCurrentDate();
      expect(result.toISOString()).toBe(fixedDate);
    });
  });

  describe('No Configuration', () => {
    it('should return actual current time when no manipulation is configured', () => {
      setupMockifyer({
        mockDataPath: './mock-data'
      });

      const result = getCurrentDate();
      const expected = new Date('2024-01-01T00:00:00.000Z');
      expect(result.toISOString()).toBe(expected.toISOString());
    });
  });
}); 