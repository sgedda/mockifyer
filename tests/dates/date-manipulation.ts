import { setupMockifyer, getCurrentDate } from '../../src';
import path from 'path';

// Example 1: Using a fixed date
// Note: In recordMode, failOnMissingMock is automatically set to false
const mockifyerWithFixedDate = setupMockifyer({
  mockDataPath: path.join(__dirname, 'mock-data'),
  recordMode: true,
  dateManipulation: {
    fixedDate: '2024-12-25T12:00:00Z' // Christmas 2024
  }
});

console.log('Fixed date example:');
console.log('Current date:', getCurrentDate().toISOString());

// Example 2: Using an offset (2 days in the future)
const mockifyerWithOffset = setupMockifyer({
  mockDataPath: './examples/mock-data',
    failOnMissingMock: true,
  dateManipulation: {
    offset: 2 * 24 * 60 * 60 * 1000 // 2 days in milliseconds
  }
});

console.log('\nOffset example:');
console.log('Current date:', getCurrentDate().toISOString());

// Example 3: Using environment variables
process.env.MOCKIFYER_DATE = '2025-01-01T00:00:00Z';
const mockifyerWithEnvDate = setupMockifyer({
  mockDataPath: './examples/mock-data',
  failOnMissingMock: true
});

console.log('\nEnvironment variable example:');
console.log('Current date:', getCurrentDate().toISOString());

// Example 4: Using timezone
const mockifyerWithTimezone = setupMockifyer({
  mockDataPath: './examples/mock-data',
    failOnMissingMock: true,
  dateManipulation: {
    timezone: 'America/New_York'
  }
});

console.log('\nTimezone example:');
console.log('Current date in New York:', getCurrentDate().toISOString()); 