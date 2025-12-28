import { setupMockifyer, getCurrentDate } from '../../src';

async function runDateExamples() {
  // Example 1: Using current date (baseline)
  console.log('Current system date:', new Date().toISOString());

  // Example 2: Using a fixed date
  const mockifyerFixed = setupMockifyer({
    mockDataPath: './examples/mock-data',
    failOnMissingMock: true,
    dateManipulation: {
      fixedDate: '2024-12-25T12:00:00Z'
    }
  });

  console.log('\nFixed date example:');
  console.log('Fixed date:', getCurrentDate().toISOString());

  // Example 3: Using date offset (1 week in the future)
  const mockifyerOffset = setupMockifyer({
    mockDataPath: './examples/mock-data',
    failOnMissingMock: true,
    dateManipulation: {
      offset: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
  });

  console.log('\nOffset date example:');
  console.log('Date with 1 week offset:', getCurrentDate().toISOString());

  // Example 4: Using timezone
  const mockifyerTimezone = setupMockifyer({
    mockDataPath: './examples/mock-data',
    failOnMissingMock: true,
    dateManipulation: {
      timezone: 'Asia/Tokyo'
    }
  });

  console.log('\nTimezone example:');
  console.log('Current date in Tokyo:', getCurrentDate().toISOString());

  // Example 5: Practical example with API mocking
  const axiosInstance = setupMockifyer({
    mockDataPath: './examples/mock-data',
    failOnMissingMock: true,
    useGlobalAxios: false,
    dateManipulation: {
      fixedDate: '2024-03-16T10:00:00Z'
    }
  });

  try {
    // Make the API call using the configured axios instance
    const response = await axiosInstance.get('https://api.example.com/current-time');
    console.log('\nMocked API response:', response.data);
    
    // Verify that the response timestamp matches our fixed date
    const responseDate = new Date(response.data.timestamp);
    const currentDate = getCurrentDate();
    console.log('Response timestamp matches fixed date:', 
      responseDate.toISOString() === currentDate.toISOString());
  } catch (error) {
    console.error('API call failed:', error);
  }
}

// Run the examples
runDateExamples().catch(console.error); 