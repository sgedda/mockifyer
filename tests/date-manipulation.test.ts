import fs from 'fs';
import os from 'os';
import path from 'path';
import { setupMockifyer } from '@sgedda/mockifyer-axios';
import { getCurrentDate, resetDateManipulation } from '@sgedda/mockifyer-core';

describe('Date Manipulation', () => {
  const fixedBaseTime = new Date('2024-01-01T00:00:00.000Z').getTime();

  beforeEach(() => {
    resetDateManipulation();
    // Clear any environment variables that might affect tests
    delete process.env.MOCKIFYER_DATE;
    delete process.env.MOCKIFYER_DATE_OFFSET;
    delete process.env.MOCKIFYER_TIMEZONE;
  });

  afterEach(() => {
    // Restore all clocks set by setupMockifyer
    resetDateManipulation();
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
      // Capture the real current time before setting up fake timers
      const realNow = Date.now();
      const offset = 24 * 60 * 60 * 1000; // 1 day in milliseconds
      
      setupMockifyer({
        mockDataPath: './mock-data',
        dateManipulation: {
          offset
        }
      });

      const result = getCurrentDate();
      // Verify that the result is approximately 1 day ahead of when setupMockifyer was called
      // (allowing for small timing differences)
      const expectedMin = realNow + offset - 2000; // Allow 2 second tolerance
      const expectedMax = realNow + offset + 2000;
      expect(result.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(result.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    it('should apply negative offset correctly', () => {
      // Capture the real current time before setting up fake timers
      const realNow = Date.now();
      const offset = -24 * 60 * 60 * 1000; // -1 day in milliseconds
      
      setupMockifyer({
        mockDataPath: './mock-data',
        dateManipulation: {
          offset
        }
      });

      const result = getCurrentDate();
      // Verify that the result is approximately 1 day behind when setupMockifyer was called
      const expectedMin = realNow + offset - 2000; // Allow 2 second tolerance
      const expectedMax = realNow + offset + 2000;
      expect(result.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(result.getTime()).toBeLessThanOrEqual(expectedMax);
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
      // Capture the real current time before setting up fake timers
      const realNow = Date.now();
      const offset = 24 * 60 * 60 * 1000; // 1 day in milliseconds
      process.env.MOCKIFYER_DATE_OFFSET = offset.toString();
      
      setupMockifyer({
        mockDataPath: './mock-data'
      });

      const result = getCurrentDate();
      // Verify that the result is approximately 1 day ahead of when setupMockifyer was called
      const expectedMin = realNow + offset - 2000; // Allow 2 second tolerance
      const expectedMax = realNow + offset + 2000;
      expect(result.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(result.getTime()).toBeLessThanOrEqual(expectedMax);
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
      // Allow small timing differences due to timezone calculation
      const resultTime = result.getTime();
      const expectedTime = new Date('2024-12-25T12:00:00.000Z').getTime();
      const diff = Math.abs(resultTime - expectedTime);
      expect(diff).toBeLessThan(1000); // Allow up to 1 second difference
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
      // Allow small timing differences
      const resultTime = result.getTime();
      const expectedTime = new Date(envDate).getTime();
      const diff = Math.abs(resultTime - expectedTime);
      expect(diff).toBeLessThan(1000); // Allow up to 1 second difference
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
      // When no manipulation is configured, getCurrentDate returns real time
      // So we just verify it's a valid date (not checking exact value)
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeGreaterThan(0);
    });
  });

  describe('Per-scenario date-config.json', () => {
    it('uses the active scenario folder before legacy root date-config.json', () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-date-'));
      const mockData = path.join(tmp, 'mock-data');
      fs.mkdirSync(path.join(mockData, 'alpha'), { recursive: true });
      fs.mkdirSync(path.join(mockData, 'beta'), { recursive: true });
      fs.writeFileSync(
        path.join(mockData, 'scenario-config.json'),
        JSON.stringify({ currentScenario: 'alpha' })
      );
      fs.writeFileSync(
        path.join(mockData, 'alpha', 'date-config.json'),
        JSON.stringify({
          dateManipulation: { fixedDate: '2020-06-01T00:00:00.000Z' },
        })
      );
      fs.writeFileSync(
        path.join(mockData, 'beta', 'date-config.json'),
        JSON.stringify({
          dateManipulation: { fixedDate: '2021-07-01T00:00:00.000Z' },
        })
      );
      fs.writeFileSync(
        path.join(mockData, 'date-config.json'),
        JSON.stringify({
          dateManipulation: { fixedDate: '2019-01-01T00:00:00.000Z' },
        })
      );

      try {
        setupMockifyer({ mockDataPath: mockData });
        expect(getCurrentDate().toISOString()).toBe('2020-06-01T00:00:00.000Z');

        fs.writeFileSync(
          path.join(mockData, 'scenario-config.json'),
          JSON.stringify({ currentScenario: 'beta' })
        );
        expect(getCurrentDate().toISOString()).toBe('2021-07-01T00:00:00.000Z');
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    it('falls back to legacy root date-config.json when scenario file is missing', () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-date-'));
      const mockData = path.join(tmp, 'mock-data');
      fs.mkdirSync(path.join(mockData, 'gamma'), { recursive: true });
      fs.writeFileSync(
        path.join(mockData, 'scenario-config.json'),
        JSON.stringify({ currentScenario: 'gamma' })
      );
      fs.writeFileSync(
        path.join(mockData, 'date-config.json'),
        JSON.stringify({
          dateManipulation: { fixedDate: '2018-05-05T12:00:00.000Z' },
        })
      );

      try {
        setupMockifyer({ mockDataPath: mockData });
        expect(getCurrentDate().toISOString()).toBe('2018-05-05T12:00:00.000Z');
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });
  });
}); 