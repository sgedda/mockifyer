import { setupMockifyer } from '../src';
import path from 'path';

async function main() {
  // First, let's record some API calls
  console.log('Recording API calls...');
  const recordAxios = setupMockifyer({
    recordMode: true,
    mockDataPath: path.join(__dirname, 'mock-data')
  });

  try {
    // Make a real API call that will be recorded
    const response = await recordAxios.get('https://jsonplaceholder.typicode.com/posts/1');
    console.log('Recorded API response:', response.data);
  } catch (error) {
    console.error('Error during recording:', error);
  }

  // Now, let's replay the recorded API call
  console.log('\nReplaying recorded API calls...');
  const mockAxios = setupMockifyer({
    recordMode: false,
    mockDataPath: path.join(__dirname, 'mock-data')
  });

  try {
    // This will use the recorded response instead of making a real API call
    const response = await mockAxios.get('https://jsonplaceholder.typicode.com/posts/1');
    console.log('Replayed API response:', response.data);
  } catch (error) {
    console.error('Error during replay:', error);
  }
}

main(); 