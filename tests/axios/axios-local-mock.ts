import { setupMockifyer } from '../../dist';
import { HTTPClient } from '../../src/types/http-client';

const mockDataPath = process.env.MOCKIFYER_PATH || './tests/axios/mock-data';
const isEnabled = process.env.MOCKIFYER_ENABLED === 'true';
const isRecordMode = process.env.MOCKIFYER_RECORD === 'true';

let httpClient: HTTPClient | null = null;

if (isEnabled) {
  // Setup mockifyer with local axios instance (not global)
  httpClient = setupMockifyer({
    mockDataPath,
    recordMode: isRecordMode,
    failOnMissingMock: !isRecordMode, // Only fail on missing mock when not in record mode
    httpClientType: 'axios',
    useGlobalAxios: false // Use local instance, don't patch global axios
  });
} else {
  // Fallback: create a simple axios wrapper if Mockifyer is disabled
  httpClient = setupMockifyer({
    mockDataPath,
    recordMode: false,
    failOnMissingMock: false,
    httpClientType: 'axios',
    useGlobalAxios: false
  });
}

async function main() {
  if (!httpClient) {
    console.error('HTTP client not initialized');
    return;
  }

  try {
    // Using the local axios client from Mockifyer (not global axios)
    const response = await httpClient.get('https://api.github.com/users/octocat');
    console.log('Response:', response.data);
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('Headers:', response.headers);
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error:', error.message);
      console.error('Stack:', error.stack);
    } else {
      console.error('Unknown error occurred:', error);
    }
  }
}

// Show current environment settings
console.log('Environment settings:');
console.log('MOCKIFYER_ENABLED:', process.env.MOCKIFYER_ENABLED);
console.log('MOCKIFYER_RECORD:', process.env.MOCKIFYER_RECORD);
console.log('MOCKIFYER_PATH:', process.env.MOCKIFYER_PATH);
console.log('MOCKIFYER_SCENARIO:', process.env.MOCKIFYER_SCENARIO);
console.log();

main();
