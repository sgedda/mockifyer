import { setupMockifyer } from '@sgedda/mockifyer';

// Configure mockifyer for tests
setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: true,  // Enable recording mode to generate mock data
  autoMock: true,
  useGlobalAxios: true,
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