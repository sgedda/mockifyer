/**
 * Auto-generated test file for GET /users/1
 * 
 * This test file sets up mocks for the underlying API request using Mockifyer.
 * The mocks are configured to return recorded responses, allowing you to:
 * 
 * 1. Test your application logic that depends on this API call
 * 2. Run tests without making real network requests
 * 3. Ensure consistent test results with predictable mock data
 * 
 * Example: Testing a function that depends on this API:
 * 
 *   import { fetchUserPosts } from '../src/api/posts';
 *   
 *   it('should process user posts correctly', async () => {
 *     // This will use the mocked response - no real API call is made
 *     const posts = await fetchUserPosts(userId);
 *     expect(posts).toHaveLength(1);
 *     // Test your business logic here...
 *   });
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import { setupMockifyer } from '@sgedda/mockifyer-fetch';


describe('/users/1', () => {
  let mockifyer: any;

  /**
   * Set up Mockifyer to intercept and mock API requests
   * All fetch/axios calls matching this endpoint will return the recorded mock data
   */
  beforeAll(() => {
    const path = require('path');
    const mockDataPath = path.resolve(__dirname, '../../../mock-data');
    mockifyer = setupMockifyer({
      mockDataPath: mockDataPath,
      recordMode: false,
      useGlobalFetch: true,
      failOnMissingMock: true,
      useSimilarMatch: true,
      similarMatchIgnoreAllQueryParams: true
    });
  });

  /**
   * Example test: Verifies the mock is working correctly
   * 
   * This test demonstrates that the mock is set up and returns the expected data.
   * The test includes an assertion checking for the 'x-mockifyer' header, which
   * confirms that the response came from mock data and NOT a real API call.
   * 
   * You can use this as a reference, but the real value is testing your application
   * logic that depends on this API call.
   */
  it('should GET /users/1', async () => {
    const response = await fetch('https://jsonplaceholder.typicode.com/users/1');
    const data = await response.json();
    
    // Verify this response came from mock data (not a real API call)
    expect(response.headers.get('x-mockifyer')).toBe('true');
    expect(response.status).toBe(200);
    expect(data).toEqual({
  "id": 1,
  "name": "Leanne Graham",
  "username": "Bret",
  "email": "Sincere@april.biz",
  "address": {
    "street": "Kulas Light",
    "suite": "Apt. 556",
    "city": "Gwenborough",
    "zipcode": "92998-3874",
    "geo": {
      "lat": "-37.3159",
      "lng": "81.1496"
    }
  },
  "phone": "1-770-736-8031 x56442",
  "website": "hildegard.org",
  "company": {
    "name": "Romaguera-Crona",
    "catchPhrase": "Multi-layered client-server neural-net",
    "bs": "harness real-time e-markets"
  }
});
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
  });

  // TODO: Add tests for your application logic that depends on this API call
  // Example:
  // it('should handle the response in your component/service', async () => {
  //   const result = await yourFunctionThatUsesThisAPI();
  //   expect(result).toBeDefined();
  //   // Test your business logic...
  // });
});