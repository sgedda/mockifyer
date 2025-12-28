import { HTTPClient } from '@sgedda/mockifyer-core';
import { setupMockifyer } from '@sgedda/mockifyer-fetch';
import path from 'path';

export async function getCurrentWeather(city: string = 'London', fullResponse: boolean = false): Promise<{ data: any; headers: Record<string, string> }> {
  try {

  // Setup Mockifyer at module level (same pattern as fetch-auto-mock.ts)
  const mockDataPath = process.env.MOCKIFYER_PATH 
  ? (path.isAbsolute(process.env.MOCKIFYER_PATH) 
      ? process.env.MOCKIFYER_PATH 
      : path.join(process.cwd(), process.env.MOCKIFYER_PATH))
  : path.join(process.cwd(), 'tests', 'fetch', 'mock-data');

  const isEnabled = process.env.MOCKIFYER_ENABLED === 'true';
  const isRecordMode = process.env.MOCKIFYER_RECORD === 'true';

  let httpClient: HTTPClient | null = null;

  if (isEnabled) {
  // Setup mockifyer with fetch client and patch global fetch
  httpClient = setupMockifyer({
    mockDataPath,
    recordMode: isRecordMode,
    failOnMissingMock: !isRecordMode, // Only fail on missing mock when not in record mode
    useGlobalFetch: true // Patch global fetch function
  });
  } else {
  // Fallback: setup Mockifyer without patching global fetch if disabled
  httpClient = setupMockifyer({
    mockDataPath,
    recordMode: false,
    failOnMissingMock: false,
    useGlobalFetch: false // Do not patch global fetch
  });
  }

  const apiKey = process.env.WEATHER_API_KEY || '605873f11d7649c98b195527251603';

    if (!httpClient) {
      throw new Error('HTTPClient not initialized. Set MOCKIFYER_ENABLED=true to enable Mockifyer.');
    }
    const params = new URLSearchParams({
      key: apiKey,
      q: 'London'
  });
  const url =`https://api.weatherapi.com/v1/current.json?${params.toString()}`
  console.log('url', url);
  const response: any = await fetch(url);
  const data = await response.json();

  console.log('response', data);
  return { data, headers: response.headers };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}
