/**
 * Auto-generated test file for POST /symbolicate
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


describe('/symbolicate', () => {
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
  it('should POST /symbolicate', async () => {
    const response = await fetch('http://192.168.1.106:8081/symbolicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
  "stack": [
    {
      "methodName": "addLog",
      "file": "http://192.168.1.106:8081/node_modules/expo/AppEntry.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.bytecode=true&transform.routerRoot=app",
      "lineNumber": 35244,
      "column": 38
    },
    {
      "methodName": "registerWarning",
      "file": "http://192.168.1.106:8081/node_modules/expo/AppEntry.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.bytecode=true&transform.routerRoot=app",
      "lineNumber": 34928,
      "column": 29
    },
    {
      "methodName": "anonymous",
      "file": "http://192.168.1.106:8081/node_modules/expo/AppEntry.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.bytecode=true&transform.routerRoot=app",
      "lineNumber": 34847,
      "column": 27
    },
    {
      "methodName": "overrideMethod",
      "file": "http://192.168.1.106:8081/node_modules/expo/AppEntry.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.bytecode=true&transform.routerRoot=app",
      "lineNumber": 62008,
      "column": 38
    },
    {
      "methodName": "?anon_0_",
      "file": "http://192.168.1.106:8081/node_modules/expo/AppEntry.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.bytecode=true&transform.routerRoot=app",
      "lineNumber": 131929,
      "column": 28
    },
    {
      "methodName": "asyncGeneratorStep",
      "file": "http://192.168.1.106:8081/node_modules/expo/AppEntry.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.bytecode=true&transform.routerRoot=app",
      "lineNumber": 35765,
      "column": 18
    },
    {
      "methodName": "_next",
      "file": "http://192.168.1.106:8081/node_modules/expo/AppEntry.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.bytecode=true&transform.routerRoot=app",
      "lineNumber": 35779,
      "column": 28
    },
    {
      "methodName": "anonymous",
      "file": "http://192.168.1.106:8081/node_modules/expo/AppEntry.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.bytecode=true&transform.routerRoot=app",
      "lineNumber": 42248,
      "column": 25
    },
    {
      "methodName": "_callTimer",
      "file": "http://192.168.1.106:8081/node_modules/expo/AppEntry.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.bytecode=true&transform.routerRoot=app",
      "lineNumber": 42127,
      "column": 16
    },
    {
      "methodName": "_callReactNativeMicrotasksPass",
      "file": "http://192.168.1.106:8081/node_modules/expo/AppEntry.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.bytecode=true&transform.routerRoot=app",
      "lineNumber": 42172,
      "column": 16
    },
    {
      "methodName": "callReactNativeMicrotasks",
      "file": "http://192.168.1.106:8081/node_modules/expo/AppEntry.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.bytecode=true&transform.routerRoot=app",
      "lineNumber": 42378,
      "column": 43
    },
    {
      "methodName": "__callReactNativeMicrotasks",
      "file": "http://192.168.1.106:8081/node_modules/expo/AppEntry.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.bytecode=true&transform.routerRoot=app",
      "lineNumber": 7896,
      "column": 47
    },
    {
      "methodName": "anonymous",
      "file": "http://192.168.1.106:8081/node_modules/expo/AppEntry.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.bytecode=true&transform.routerRoot=app",
      "lineNumber": 7669,
      "column": 44
    },
    {
      "methodName": "__guard",
      "file": "http://192.168.1.106:8081/node_modules/expo/AppEntry.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.bytecode=true&transform.routerRoot=app",
      "lineNumber": 7868,
      "column": 14
    },
    {
      "methodName": "flushedQueue",
      "file": "http://192.168.1.106:8081/node_modules/expo/AppEntry.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.bytecode=true&transform.routerRoot=app",
      "lineNumber": 7668,
      "column": 20
    },
    {
      "methodName": "invokeCallbackAndReturnFlushedQueue",
      "file": "http://192.168.1.106:8081/node_modules/expo/AppEntry.bundle//&platform=ios&dev=true&hot=false&transform.engine=hermes&transform.bytecode=true&transform.routerRoot=app",
      "lineNumber": 7662,
      "column": 32
    }
  ]
})
    });
    const data = await response.json();
    
    // Verify this response came from mock data (not a real API call)
    expect(response.headers.get('x-mockifyer')).toBe('true');
    expect(response.status).toBe(200);
    expect(data).toEqual({
  "codeFrame": {
    "content": "\u001b[0m \u001b[90m 990 |\u001b[39m                     \u001b[36melse\u001b[39m {\n \u001b[90m 991 |\u001b[39m                         console\u001b[33m.\u001b[39mwarn(\u001b[32m'[Mockifyer-Fetch] ⚠️ x-mockifyer header NOT found in response.headers'\u001b[39m)\u001b[33m;\u001b[39m\n\u001b[31m\u001b[1m>\u001b[22m\u001b[39m\u001b[90m 992 |\u001b[39m                         console\u001b[33m.\u001b[39mwarn(\u001b[32m'[Mockifyer-Fetch] Available headers:'\u001b[39m\u001b[33m,\u001b[39m \u001b[33mObject\u001b[39m\u001b[33m.\u001b[39mkeys(response\u001b[33m.\u001b[39mheaders))\u001b[33m;\u001b[39m\n \u001b[90m     |\u001b[39m                                     \u001b[31m\u001b[1m^\u001b[22m\u001b[39m\n \u001b[90m 993 |\u001b[39m                     }\n \u001b[90m 994 |\u001b[39m                 }\n \u001b[90m 995 |\u001b[39m                 \u001b[36melse\u001b[39m {\u001b[0m",
    "location": {
      "row": 992,
      "column": 36
    },
    "fileName": "/Users/sgedda/git-private/mockifyer/packages/mockifyer-fetch/dist/index.js"
  },
  "stack": [
    {
      "methodName": "addLog",
      "file": "/Users/sgedda/git-private/mockifyer/example-projects/react-native-expo-example/node_modules/react-native/Libraries/LogBox/Data/LogBoxData.js",
      "lineNumber": 196,
      "column": 38,
      "collapse": true
    },
    {
      "methodName": "registerWarning",
      "file": "/Users/sgedda/git-private/mockifyer/example-projects/react-native-expo-example/node_modules/react-native/Libraries/LogBox/LogBox.js",
      "lineNumber": 156,
      "column": 27,
      "collapse": true
    },
    {
      "methodName": "console.warn",
      "file": "/Users/sgedda/git-private/mockifyer/example-projects/react-native-expo-example/node_modules/react-native/Libraries/LogBox/LogBox.js",
      "lineNumber": 71,
      "column": 25,
      "collapse": true
    },
    {
      "methodName": "overrideMethod",
      "file": "/Users/sgedda/git-private/mockifyer/example-projects/react-native-expo-example/node_modules/react-devtools-core/dist/backend.js",
      "lineNumber": 14284,
      "column": 30,
      "collapse": true
    },
    {
      "methodName": "global.fetch",
      "file": "/Users/sgedda/git-private/mockifyer/packages/mockifyer-fetch/dist/index.js",
      "lineNumber": 992,
      "column": 36,
      "collapse": false
    },
    {
      "methodName": "asyncGeneratorStep",
      "file": "/Users/sgedda/git-private/mockifyer/example-projects/react-native-expo-example/node_modules/@babel/runtime/helpers/asyncToGenerator.js",
      "lineNumber": 3,
      "column": 16,
      "collapse": true
    },
    {
      "methodName": "_next",
      "file": "/Users/sgedda/git-private/mockifyer/example-projects/react-native-expo-example/node_modules/@babel/runtime/helpers/asyncToGenerator.js",
      "lineNumber": 17,
      "column": 26,
      "collapse": true
    },
    {
      "methodName": "_allocateCallback$argument_0",
      "file": "/Users/sgedda/git-private/mockifyer/example-projects/react-native-expo-example/node_modules/react-native/Libraries/Core/Timers/JSTimers.js",
      "lineNumber": 247,
      "column": 22,
      "collapse": true
    },
    {
      "methodName": "_callTimer",
      "file": "/Users/sgedda/git-private/mockifyer/example-projects/react-native-expo-example/node_modules/react-native/Libraries/Core/Timers/JSTimers.js",
      "lineNumber": 111,
      "column": 14,
      "collapse": true
    },
    {
      "methodName": "_callReactNativeMicrotasksPass",
      "file": "/Users/sgedda/git-private/mockifyer/example-projects/react-native-expo-example/node_modules/react-native/Libraries/Core/Timers/JSTimers.js",
      "lineNumber": 161,
      "column": 14,
      "collapse": true
    },
    {
      "methodName": "callReactNativeMicrotasks",
      "file": "/Users/sgedda/git-private/mockifyer/example-projects/react-native-expo-example/node_modules/react-native/Libraries/Core/Timers/JSTimers.js",
      "lineNumber": 415,
      "column": 41,
      "collapse": true
    },
    {
      "methodName": "__callReactNativeMicrotasks",
      "file": "/Users/sgedda/git-private/mockifyer/example-projects/react-native-expo-example/node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js",
      "lineNumber": 393,
      "column": 43,
      "collapse": true
    },
    {
      "methodName": "__guard$argument_0",
      "file": "/Users/sgedda/git-private/mockifyer/example-projects/react-native-expo-example/node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js",
      "lineNumber": 132,
      "column": 38,
      "collapse": true
    },
    {
      "methodName": "__guard",
      "file": "/Users/sgedda/git-private/mockifyer/example-projects/react-native-expo-example/node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js",
      "lineNumber": 368,
      "column": 10,
      "collapse": true
    },
    {
      "methodName": "flushedQueue",
      "file": "/Users/sgedda/git-private/mockifyer/example-projects/react-native-expo-example/node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js",
      "lineNumber": 131,
      "column": 16,
      "collapse": true
    },
    {
      "methodName": "invokeCallbackAndReturnFlushedQueue",
      "file": "/Users/sgedda/git-private/mockifyer/example-projects/react-native-expo-example/node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js",
      "lineNumber": 127,
      "column": 28,
      "collapse": true
    }
  ]
});
  });

  // TODO: Add tests for your application logic that depends on this API call
  // Example:
  // it('should handle the response in your component/service', async () => {
  //   const result = await yourFunctionThatUsesThisAPI();
  //   expect(result).toBeDefined();
  //   // Test your business logic...
  // });
it('should process user posts correctly', async () => {
 *     // This will use the mocked response - no real API call is made
 *     const posts = await fetchUserPosts(userId);
 *     expect(posts).toHaveLength(1);
 *     // Test your business logic here...
 *   });

});