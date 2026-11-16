/**
 * Tests for auth-related Bugbot issues 4577961894 and 4578061251
 */

import { detectAuthFromTraffic } from '../packages/mockifyer-core/src/utils/atlas-auth-detection';
import type { NetworkEvent } from '../packages/mockifyer-core/src/utils/network-event-types';

// Helper to create valid NetworkEvent for tests
function createEvent(overrides: Partial<NetworkEvent> & { url: string; method: string }): NetworkEvent {
  return {
    id: 'evt-' + Math.random(),
    requestId: 'req-' + Math.random(),
    timestamp: new Date().toISOString(),
    scenario: 'test',
    transport: 'fetch' as const,
    source: 'live' as const,
    ...overrides
  } as NetworkEvent;
}

describe('Auth remapping issues', () => {
  /**
   * Bug 4577961894: Auth remapping matches wrong endpoints
   * Bugbot claims: "Auth lookup compares url.hostname to inventory keys built from url.host,
   * so any host with a port never matches"
   */
  describe('Auth with ports (4577961894)', () => {
    it('should match auth for hosts with ports', () => {
      const events: NetworkEvent[] = [
        createEvent({
          url: 'http://localhost:3000/api/data',
          method: 'GET',
          status: 200,
          requestHeaders: {
            'Authorization': 'Bearer test-token-123'
          }
        })
      ];
      
      const authMap = detectAuthFromTraffic(events);
      
      // Key should include port: localhost:3000::GET::/api/data
      const key = 'localhost:3000::GET::/api/data';
      expect(authMap.has(key)).toBe(true);
      
      const authInfo = authMap.get(key);
      expect(authInfo).toBeDefined();
      expect(authInfo!.scheme).toBe('bearer');
    });

    it('should not match hosts with different ports', () => {
      const events: NetworkEvent[] = [
        createEvent({
          url: 'http://localhost:3000/api/data',
          method: 'GET',
          status: 200,
          requestHeaders: {
            'Authorization': 'Bearer test-token-123'
          }
        })
      ];
      
      const authMap = detectAuthFromTraffic(events);
      
      // Should NOT match localhost:8080 (different port)
      const wrongKey = 'localhost:8080::GET::/api/data';
      expect(authMap.has(wrongKey)).toBe(false);
    });
  });

  /**
   * Bug 4577961894: "treats the path prefix before the first { as enough,
   * then takes the first hit, so a public list route can inherit Bearer from a sibling detail URL"
   */
  describe('Auth path matching (4577961894)', () => {
    it('should not leak auth from detail route to list route', () => {
      const events: NetworkEvent[] = [
        // Detail route with auth
        createEvent({
          url: 'https://api.service.com/users/123',
          method: 'GET',
          status: 200,
          requestHeaders: {
            'Authorization': 'Bearer user-token'
          }
        }),
        // List route without auth
        createEvent({
          url: 'https://api.service.com/users',
          method: 'GET',
          status: 200,
          requestHeaders: {}
        })
      ];
      
      const authMap = detectAuthFromTraffic(events);
      
      // Detail route should have auth
      const detailKey = 'api.service.com::GET::/users/{id}';
      expect(authMap.has(detailKey)).toBe(true);
      expect(authMap.get(detailKey)!.scheme).toBe('bearer');
      
      // List route should NOT have auth (no bearer detected)
      const listKey = 'api.service.com::GET::/users';
      if (authMap.has(listKey)) {
        expect(authMap.get(listKey)!.scheme).toBe('none');
      } else {
        // Or it might not be in the map at all if no auth detected
        expect(authMap.has(listKey)).toBe(false);
      }
    });
  });

  /**
   * Bug 4578061251: Auth badges miss templated endpoints
   * Bugbot claims: "Auth remapping keys traffic by the raw event pathname (/users/123)
   * but looks up inventory templates (/users/{id}). Prefix keys are only stored when
   * the event path already contains {, which captured URLs do not"
   */
  describe('Auth with templated paths (4578061251)', () => {
    it('should detect auth on templated endpoints from raw traffic', () => {
      const events: NetworkEvent[] = [
        createEvent({
          url: 'https://api.service.com/users/123',
          method: 'GET',
          status: 200,
          requestHeaders: {
            'Authorization': 'Bearer user-token'
          }
        }),
        createEvent({
          url: 'https://api.service.com/users/456',
          method: 'GET',
          status: 200,
          requestHeaders: {
            'Authorization': 'Bearer user-token'
          }
        })
      ];
      
      const authMap = detectAuthFromTraffic(events);
      
      // Should normalize /users/123 and /users/456 to /users/{id}
      // and detect Bearer auth on that template
      const templateKey = 'api.service.com::GET::/users/{id}';
      expect(authMap.has(templateKey)).toBe(true);
      expect(authMap.get(templateKey)!.scheme).toBe('bearer');
      expect(authMap.get(templateKey)!.observedInTraffic).toBe(true);
    });
  });
});
