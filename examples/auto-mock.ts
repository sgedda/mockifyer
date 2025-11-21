import { setupMockifyer } from '../src';
import axios, { AxiosError } from 'axios';

const mockDataPath = process.env.MOCKIFYER_PATH || './examples/mock-data';
const isEnabled = process.env.MOCKIFYER_ENABLED === 'true';
const isRecordMode = process.env.MOCKIFYER_RECORD === 'true';

if (isEnabled) {
  // Setup mockifyer with global axios instance
  setupMockifyer({
    mockDataPath,
    recordMode: isRecordMode,
    failOnMissingMock: true,
    useGlobalAxios: true
  });
}

async function main() {
  try {
    // Using the global axios instance
    const response = await axios.get('https://api.github.com/users/octocat');
    console.log('Response:', response.data);
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error('Error:', error.message);
    } else {
      console.error('Unknown error occurred');
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