import dotenv from 'dotenv';
import { setupMockifyer, HTTPClient } from '@sgedda/mockifyer-fetch';
import path from 'path';

// Load environment variables
dotenv.config();

// Setup Mockifyer WITHOUT global fetch patching
// This requires us to use the httpClient returned from setupMockifyer
const mockDataPath = process.env.MOCKIFYER_PATH || path.join(__dirname, '../mock-data');
const isEnabled = true;
const isRecordMode = true;

let httpClient: HTTPClient | null = null;

if (isEnabled) {
  console.log('🔧 Initializing Mockifyer...');
  console.log(`   Mode: ${isRecordMode ? 'RECORD' : 'MOCK'}`);
  console.log(`   Mock data path: ${mockDataPath}`);
  console.log(`   Using local httpClient (useGlobalFetch: false)`);
  
  httpClient = setupMockifyer({
    mockDataPath,
    recordMode: isRecordMode,
    failOnMissingMock: !isRecordMode,
    useGlobalFetch: false // Use local httpClient instead of patching global fetch
  });
  
  console.log('✅ Mockifyer initialized\n');
} else {
  console.log('⚠️  Mockifyer is disabled. Set MOCKIFYER_ENABLED=true to enable.\n');
}

// Three simple API endpoints to demonstrate Mockifyer
// Using httpClient.get() instead of fetch() - Mockifyer intercepts these calls
async function fetchPost() {
  if (!httpClient) {
    throw new Error('HTTP client not initialized');
  }
  
  console.log('📝 Fetching post from JSONPlaceholder...');
  try {
    const response = await httpClient.get('https://jsonplaceholder.typicode.com/posts/1');
    console.log(`   ✅ Status: ${response.status}`);
    console.log(`   📄 Title: ${response.data.title}`);
    console.log(`   📝 Body: ${response.data.body.substring(0, 50)}...`);
    return response.data;
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
    throw error;
  }
}

async function fetchUser() {
  if (!httpClient) {
    throw new Error('HTTP client not initialized');
  }
  
  console.log('\n👤 Fetching user from GitHub...');
  try {
    const response = await httpClient.get('https://api.github.com/users/octocat');
    console.log(`   ✅ Status: ${response.status}`);
    console.log(`   👤 Name: ${response.data.name || response.data.login}`);
    console.log(`   📍 Location: ${response.data.location || 'N/A'}`);
    console.log(`   🔗 Blog: ${response.data.blog || 'N/A'}`);
    return response.data;
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
    throw error;
  }
}

async function fetchRandomDog() {
  if (!httpClient) {
    throw new Error('HTTP client not initialized');
  }
  
  console.log('\n🐕 Fetching random dog image...');
  try {
    const response = await httpClient.get('https://dog.ceo/api/breeds/image/random');
    console.log(`   ✅ Status: ${response.status}`);
    console.log(`   🐕 Image URL: ${response.data.message}`);
    return response.data;
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
    throw error;
  }
}

// Main function
async function main() {
  console.log('🚀 Simple Fetch Example with Mockifyer (Local Client)\n');
  console.log('=' .repeat(50));
  
  try {
    // Call all three endpoints
    await fetchPost();
    await fetchUser();
    await fetchRandomDog();
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ All requests completed successfully!');
    
    if (isEnabled) {
      if (isRecordMode) {
        console.log('\n💾 Mock data has been saved to:', mockDataPath);
        console.log('   Run with MOCKIFYER_RECORD=false to use the saved mocks');
      } else {
        console.log('\n🎭 Using mock data from:', mockDataPath);
      }
    }
  } catch (error) {
    console.error('\n❌ An error occurred:', error);
    process.exit(1);
  }
}

// Run the example
main();

