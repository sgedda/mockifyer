import path from 'path';
import { setupMockifyer } from '@sgedda/mockifyer-axios';

// Prefer a writable local path — Cloud Agent / CI images may not have Railway's
// `/persisted/mock-data` volume (and mkdir would EACCES when importing `src/index`).
process.env.MOCKIFYER_PATH = path.resolve(__dirname, '../../mock-data');

// Configure mockifyer for tests
setupMockifyer({
  mockDataPath: process.env.MOCKIFYER_PATH,
  recordMode: true,  // Enable recording mode to generate mock data
  failOnMissingMock: true,
  useGlobalAxios: true,
  // Ungated replay — web service tests predate domain-path allowlist.
  domainPathRulesMode: 'off',
  dateManipulation: {
    fixedDate: '2024-03-16T00:00:00Z'
  }
});

// Add Jest specific matchers or global test setup here if needed
beforeAll(() => {
  // Global setup before all tests
});

afterAll(() => {
  // Global cleanup after all tests
}); 