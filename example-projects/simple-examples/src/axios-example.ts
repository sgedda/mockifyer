import dotenv from 'dotenv';
import { setupMockifyer } from '@sgedda/mockifyer-axios';
import axios from 'axios';
import path from 'path';

// Load environment variables
dotenv.config();

// Setup Mockifyer with global axios patching
// This allows us to use axios.get(), axios.post(), etc. directly
const mockDataPath = process.env.MOCKIFYER_PATH || path.join(__dirname, '../mock-data');
const isEnabled = true;
const isRecordMode = true;

if (isEnabled) {
  console.log('🔧 Initializing Mockifyer...');
  console.log(`   Mode: ${isRecordMode ? 'RECORD' : 'MOCK'}`);
  console.log(`   Mock data path: ${mockDataPath}`);
  
  setupMockifyer({
    mockDataPath,
    recordMode: isRecordMode,
    failOnMissingMock: !isRecordMode,
    useGlobalAxios: true, // Patch global axios so we can use axios.get() directly
    axiosInstance: axios // REQUIRED: Pass your axios instance to ensure same instance is used
  });
  
  console.log('✅ Mockifyer initialized\n');
} else {
  console.log('⚠️  Mockifyer is disabled. Set MOCKIFYER_ENABLED=true to enable.\n');
}

// Three simple API endpoints to demonstrate Mockifyer
// Using axios.get() directly - Mockifyer intercepts these calls automatically
async function fetchPost() {
  console.log('📝 Fetching post from JSONPlaceholder...');
  try {
    const response = await axios.get('https://jsonplaceholder.typicode.com/posts/1');
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
  console.log('\n👤 Fetching user from GitHub...');
  try {
    const response = await axios.get('https://api.github.com/users/octocat');
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
  console.log('\n🐕 Fetching random dog image...');
  try {
    const response = await axios.get('https://dog.ceo/api/breeds/image/random');
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
  console.log('🚀 Simple Axios Example with Mockifyer\n');
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

