import { setupMockifyer } from '@sgedda/mockifyer';
import { HTTPClient } from '@sgedda/mockifyer/types/http-client';

const mockDataPath = process.env.MOCKIFYER_PATH || './tests/fetch/mock-data';
const isEnabled = process.env.MOCKIFYER_ENABLED === 'true';
const isRecordMode = process.env.MOCKIFYER_RECORD === 'true';

let httpClient: HTTPClient | null = null;

if (isEnabled) {
  // Setup mockifyer with fetch client and patch global fetch
  httpClient = setupMockifyer({
    mockDataPath,
    recordMode: isRecordMode,
    failOnMissingMock: !isRecordMode, // Only fail on missing mock when not in record mode
    httpClientType: 'fetch',
    useGlobalFetch: true // Patch global fetch function
  });
} else {
  // Fallback: setup Mockifyer without patching global fetch if disabled
  httpClient = setupMockifyer({
    mockDataPath,
    recordMode: false,
    failOnMissingMock: false,
    httpClientType: 'fetch',
    useGlobalFetch: false // Do not patch global fetch
  });
}

export async function main() {
  try {
    // Request 1: Using the native fetch API directly - Mockifyer intercepts it automatically
    console.log('\n=== Request 1: Using global fetch() ===');
    const response = await fetch('https://api.github.com/users/octocat');
    const data = await response.json();
    
    console.log('Response:', data);
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    
    // Convert Headers to object
    const headersObj: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headersObj[key] = value;
    });
    console.log('Headers:', headersObj);
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error:', error.message);
      console.error('Stack:', error.stack);
    } else {
      console.error('Unknown error occurred:', error);
    }
  }

  // Request 2: Using httpClient.get() directly
  if (httpClient) {
    try {
      console.log('\n=== Request 2: Using httpClient.get() ===');
      const response2 = await httpClient.get('https://api.github.com/users/defunkt');
      console.log('Response:', response2.data);
      console.log('Status:', response2.status);
      console.log('Status Text:', response2.statusText);
      console.log('Headers:', response2.headers);
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
      } else {
        console.error('Unknown error occurred:', error);
      }
    }
  } else {
    console.log('\n=== Request 2: Skipped (httpClient not initialized) ===');
  }

  // Request 3: Using httpClient.get() with query parameters (WeatherAPI)
  if (httpClient) {
    try {
      console.log('\n=== Request 3: Using httpClient.get() with query parameters ===');
      const apiKey = process.env.WEATHER_API_KEY || '605873f11d7649c98b195527251603';
      const response3 = await httpClient.get('https://api.weatherapi.com/v1/current.json', {
        params: {
          key: apiKey,
          q: 'London'
        }
      });
      console.log('Response:', response3.data);
      console.log('Status:', response3.status);
      console.log('Status Text:', response3.statusText);
      console.log('Headers:', response3.headers);
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
      } else {
        console.error('Unknown error occurred:', error);
      }
    }
  } else {
    console.log('\n=== Request 3: Skipped (httpClient not initialized) ===');
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