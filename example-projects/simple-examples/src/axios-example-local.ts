import dotenv from 'dotenv';
import { setupMockifyer, HTTPClient } from '@sgedda/mockifyer-axios';
import axios from 'axios';
import path from 'path';

// Load environment variables
dotenv.config();

// Setup Mockifyer WITHOUT global axios patching
// This requires us to use the httpClient returned from setupMockifyer
const mockDataPath = process.env.MOCKIFYER_PATH || path.join(__dirname, '../mock-data');
const isEnabled = true;
const isRecordMode = true;

let httpClient: HTTPClient | null = null;

if (isEnabled) {
  console.log('🔧 Initializing Mockifyer...');
  console.log(`   Mode: ${isRecordMode ? 'RECORD' : 'MOCK'}`);
  console.log(`   Mock data path: ${mockDataPath}`);
  console.log(`   Using local httpClient (useGlobalAxios: false)`);
  
  httpClient = setupMockifyer({
    mockDataPath,
    recordMode: isRecordMode,
    failOnMissingMock: !isRecordMode,
    useGlobalAxios: false, // Use local httpClient instead of patching global axios
    axiosInstance: axios // Pass axios instance for internal use
  });
  
  console.log('✅ Mockifyer initialized\n');
} else {
  console.log('⚠️  Mockifyer is disabled. Set MOCKIFYER_ENABLED=true to enable.\n');
}

// Three simple API endpoints to demonstrate Mockifyer
// Using httpClient.get() instead of axios.get() - Mockifyer intercepts these calls
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

// Example: Request with cancellation token
async function fetchPostWithCancellation() {
  if (!httpClient) {
    throw new Error('HTTP client not initialized');
  }
  
  console.log('\n🛑 Fetching post with cancellation support...');
  const cancelToken = axios.CancelToken.source();
  
  try {
    // Start the request
    const requestPromise = httpClient.get('https://jsonplaceholder.typicode.com/posts/1', {
      cancelToken: cancelToken.token, // ✅ Axios cancellation token works!
      timeout: 5000
    });
    
    // Simulate cancellation after 100ms (in real app, user might click cancel button)
    setTimeout(() => {
      console.log('   ⏹️  Cancelling request...');
      cancelToken.cancel('Request cancelled by user');
    }, 100);
    
    const response = await requestPromise;
    console.log(`   ✅ Status: ${response.status}`);
    return response.data;
  } catch (error: any) {
    if (axios.isCancel(error)) {
      console.log(`   ⏹️  Request was cancelled: ${error.message}`);
    } else {
      console.error(`   ❌ Error: ${error.message}`);
      throw error;
    }
  }
}

// Example: Request with timeout
async function fetchPostWithTimeout() {
  if (!httpClient) {
    throw new Error('HTTP client not initialized');
  }
  
  console.log('\n⏱️  Fetching post with timeout...');
  try {
    const response = await httpClient.get('https://jsonplaceholder.typicode.com/posts/1', {
      timeout: 1000, // ✅ Axios timeout option works!
      headers: {
        'X-Custom-Header': 'test-value'
      }
    });
    console.log(`   ✅ Status: ${response.status}`);
    console.log(`   📄 Title: ${response.data.title}`);
    return response.data;
  } catch (error: any) {
    if (error.code === 'ECONNABORTED') {
      console.log(`   ⏱️  Request timeout after 1 second`);
    } else {
      console.error(`   ❌ Error: ${error.message}`);
      throw error;
    }
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

// Example: Using request() method with full config
async function fetchPostWithRequestMethod() {
  if (!httpClient) {
    throw new Error('HTTP client not initialized');
  }
  
  console.log('\n📋 Fetching post using request() method with full config...');
  try {
    const response = await httpClient.request({
      url: 'https://jsonplaceholder.typicode.com/posts/1',
      method: 'GET',
      timeout: 5000,
      headers: {
        'Accept': 'application/json',
        'X-Request-ID': 'example-123'
      },
      params: {}, // ✅ Empty params now works correctly - normalized to match no params
      validateStatus: (status: number) => status < 500, // ✅ Axios validateStatus works!
      maxRedirects: 5 // ✅ Axios maxRedirects works!
    });
    console.log(`   ✅ Status: ${response.status}`);
    console.log(`   📄 Title: ${response.data.title}`);
    return response.data;
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
    throw error;
  }
}

// Example: Request with query parameters
async function fetchPostsWithQueryParams() {
  if (!httpClient) {
    throw new Error('HTTP client not initialized');
  }
  
  console.log('\n🔍 Fetching posts with query parameters...');
  try {
    // JSONPlaceholder supports query params like _limit and _page
    const response = await httpClient.get('https://jsonplaceholder.typicode.com/posts', {
      params: {
        _limit: '5', // Limit to 5 posts
        _page: '1'   // First page
      },
      headers: {
        'Accept': 'application/json',
        'X-Custom-Header': 'query-params-example'
      },
      timeout: 5000
    });
    
    console.log(`   ✅ Status: ${response.status}`);
    console.log(`   📄 Retrieved ${response.data.length} posts`);
    console.log(`   📝 First post title: ${response.data[0]?.title || 'N/A'}`);
    return response.data;
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
    throw error;
  }
}

// Example: POST request with custom config
async function createPostExample() {
  if (!httpClient) {
    throw new Error('HTTP client not initialized');
  }
  
  console.log('\n📝 Creating a new post (POST request)...');
  try {
    const newPost = {
      title: 'Test Post',
      body: 'This is a test post created via HTTPClient',
      userId: 1
    };
    
    const response = await httpClient.post('https://jsonplaceholder.typicode.com/posts', newPost, {
      headers: {
        'Content-Type': 'application/json',
        'X-Custom-Header': 'post-example'
      },
      timeout: 10000,
      // ✅ All axios options work through HTTPClient!
    });
    
    console.log(`   ✅ Status: ${response.status}`);
    console.log(`   📝 Created post ID: ${response.data.id}`);
    console.log(`   📄 Title: ${response.data.title}`);
    return response.data;
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
    throw error;
  }
}

// Main function
async function main() {
  console.log('🚀 Simple Axios Example with Mockifyer (Local Client)\n');
  console.log('=' .repeat(50));
  
  try {
    // Basic examples
    await fetchPost();
    await fetchUser();
    await fetchRandomDog();
    
    // Advanced axios features examples
    await fetchPostWithTimeout();
    await fetchPostWithRequestMethod();
    await fetchPostsWithQueryParams(); // ✅ Query parameters example
    await createPostExample();
    
    // Note: Cancellation example is commented out because it will always cancel
    // Uncomment to see cancellation in action:
    // await fetchPostWithCancellation();
    
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

