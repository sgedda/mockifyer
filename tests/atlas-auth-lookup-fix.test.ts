/**
 * Test for bug #29: Auth lookup incompatible map keys
 * Auth is stored by composite key (host::method::template) and must be retrieved with same format.
 */

import { detectAuthFromTraffic } from '../packages/mockifyer-core/src/utils/atlas-auth-detection';
import type { NetworkEvent } from '../packages/mockifyer-core/src/utils/network-event-types';

describe('Atlas Auth Detection - Bug #29 Fix', () => {
  it('should store and retrieve auth by composite key format', () => {
    const events: NetworkEvent[] = [
      {
        id: 'evt-1',
        scenario: 'test',
        transport: 'axios',
        source: 'upstream',
        requestId: 'req-1',
        parentRequestId: null,
        method: 'GET',
        url: 'https://api.example.com/users/123',
        requestHeaders: {
          'Authorization': 'Bearer abc123xyz',
          'Content-Type': 'application/json'
        },
        responseHeaders: {},
        status: 200,
        durationMs: 150,
        timestamp: new Date().toISOString()
      },
      {
        id: 'evt-2',
        scenario: 'test',
        transport: 'axios',
        source: 'upstream',
        requestId: 'req-2',
        parentRequestId: null,
        method: 'POST',
        url: 'https://api.example.com/users',
        requestHeaders: {
          'Authorization': 'Bearer def456uvw',
          'Content-Type': 'application/json'
        },
        responseHeaders: {},
        status: 201,
        durationMs: 200,
        timestamp: new Date().toISOString()
      },
      {
        id: 'evt-3',
        scenario: 'test',
        transport: 'axios',
        source: 'upstream',
        requestId: 'req-3',
        parentRequestId: null,
        method: 'GET',
        url: 'https://api.different.com/items',
        requestHeaders: {
          'X-API-Key': 'key123',
          'Content-Type': 'application/json'
        },
        responseHeaders: {},
        status: 200,
        durationMs: 100,
        timestamp: new Date().toISOString()
      }
    ];

    const authMap = detectAuthFromTraffic(events);

    // Should return a map with composite keys
    expect(authMap).toBeInstanceOf(Map);
    expect(authMap.size).toBeGreaterThan(0);

    // Check that we can retrieve auth info for GET /users/{id}
    const getKey = 'api.example.com::GET::/users/{id}';
    const getAuth = authMap.get(getKey);
    expect(getAuth).toBeDefined();
    expect(getAuth?.scheme).toBe('bearer');
    expect(getAuth?.observedInTraffic).toBe(true);

    // Check POST endpoint
    const postKey = 'api.example.com::POST::/users';
    const postAuth = authMap.get(postKey);
    expect(postAuth).toBeDefined();
    expect(postAuth?.scheme).toBe('bearer');

    // Check API key endpoint on different host
    const apiKeyKey = 'api.different.com::GET::/items';
    const apiKeyAuth = authMap.get(apiKeyKey);
    expect(apiKeyAuth).toBeDefined();
    expect(apiKeyAuth?.scheme).toBe('api-key');
  });

  it('should handle 401/403 auth failures', () => {
    const events: NetworkEvent[] = [
      {
        id: 'evt-fail',
        scenario: 'test',
        transport: 'axios',
        source: 'upstream',
        requestId: 'req-fail',
        parentRequestId: null,
        method: 'GET',
        url: 'https://secure.api.com/protected',
        requestHeaders: {},
        responseHeaders: {
          'www-authenticate': 'Bearer realm="api"'
        },
        status: 401,
        durationMs: 50,
        timestamp: new Date().toISOString()
      }
    ];

    const authMap = detectAuthFromTraffic(events);
    const key = 'secure.api.com::GET::/protected';
    const auth = authMap.get(key);
    
    expect(auth).toBeDefined();
    expect(auth?.authFailures).toBe(1);
    expect(auth?.challengeSchemes).toContain('bearer');
  });

  it('should differentiate same path on different hosts', () => {
    const events: NetworkEvent[] = [
      {
        id: 'evt-host1',
        scenario: 'test',
        transport: 'axios',
        source: 'upstream',
        requestId: 'req-1',
        parentRequestId: null,
        method: 'GET',
        url: 'https://api1.example.com/users',
        requestHeaders: {
          'Authorization': 'Bearer token1'
        },
        responseHeaders: {},
        status: 200,
        durationMs: 100,
        timestamp: new Date().toISOString()
      },
      {
        id: 'evt-host2',
        scenario: 'test',
        transport: 'axios',
        source: 'upstream',
        requestId: 'req-2',
        parentRequestId: null,
        method: 'GET',
        url: 'https://api2.example.com/users',
        requestHeaders: {
          'X-API-Key': 'apikey2'
        },
        responseHeaders: {},
        status: 200,
        durationMs: 100,
        timestamp: new Date().toISOString()
      }
    ];

    const authMap = detectAuthFromTraffic(events);

    const key1 = 'api1.example.com::GET::/users';
    const key2 = 'api2.example.com::GET::/users';

    expect(authMap.get(key1)?.scheme).toBe('bearer');
    expect(authMap.get(key2)?.scheme).toBe('api-key');
  });

  it('should differentiate same endpoint with different methods', () => {
    const events: NetworkEvent[] = [
      {
        id: 'evt-get',
        scenario: 'test',
        transport: 'axios',
        source: 'upstream',
        requestId: 'req-get',
        parentRequestId: null,
        method: 'GET',
        url: 'https://api.example.com/resource',
        requestHeaders: {},
        responseHeaders: {},
        status: 200,
        durationMs: 100,
        timestamp: new Date().toISOString()
      },
      {
        id: 'evt-post',
        scenario: 'test',
        transport: 'axios',
        source: 'upstream',
        requestId: 'req-post',
        parentRequestId: null,
        method: 'POST',
        url: 'https://api.example.com/resource',
        requestHeaders: {
          'Authorization': 'Bearer secure-token'
        },
        responseHeaders: {},
        status: 201,
        durationMs: 150,
        timestamp: new Date().toISOString()
      }
    ];

    const authMap = detectAuthFromTraffic(events);

    const getKey = 'api.example.com::GET::/resource';
    const postKey = 'api.example.com::POST::/resource';

    expect(authMap.get(getKey)?.scheme).toBe('none');
    expect(authMap.get(postKey)?.scheme).toBe('bearer');
  });
});
