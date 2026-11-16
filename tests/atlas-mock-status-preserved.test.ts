/**
 * Test that mocked-only status is preserved when code scan finds the same endpoint.
 */

import { buildEndpointInventory } from '../packages/mockifyer-core/src/utils/atlas-endpoint-inventory';
import type { NetworkEvent } from '../packages/mockifyer-core/src/utils/network-event-types';
import type { ScannedEndpoint } from '../packages/mockifyer-core/src/utils/atlas-code-scanner';

describe('Atlas mock status preservation', () => {
  it('preserves mocked-only status when code scan finds the endpoint', () => {
    // No network traffic, but we have a mock file
    const events: NetworkEvent[] = [];
    
    // Mock exists but was never observed in traffic
    const mockFiles = [
      {
        method: 'POST',
        url: 'https://api.example.com/users'
      }
    ];

    // Build inventory with mocks
    const inventoryWithMocks = buildEndpointInventory(events, [], mockFiles);
    const apiHost = inventoryWithMocks.byHost.get('api.example.com');
    const endpoint = apiHost?.find(e => e.method === 'POST' && e.urlTemplate === '/users');
    
    expect(endpoint).toBeDefined();
    expect(endpoint?.status).toBe('mocked-only');
    expect(endpoint?.mockExists).toBe(true);

    // Now add code scan that finds the same endpoint
    const scannedEndpoints: ScannedEndpoint[] = [
      {
        method: 'POST',
        urlTemplate: '/users',
        filePath: 'src/api/users.ts',
        line: 42,
        column: 10,
        componentName: 'UserService',
        callType: 'fetch',
        resolvedUrl: 'https://api.example.com/users'
      }
    ];

    const inventoryWithCode = buildEndpointInventory(events, scannedEndpoints, mockFiles);
    const endpointAfterScan = inventoryWithCode.byHost.get('api.example.com')
      ?.find(e => e.method === 'POST' && e.urlTemplate === '/users');
    
    // Status should still be mocked-only, not code-only
    expect(endpointAfterScan?.status).toBe('mocked-only');
    expect(endpointAfterScan?.mockExists).toBe(true);
    expect(endpointAfterScan?.codeLocations.length).toBeGreaterThan(0);
  });

  it('keeps observed status when code scan finds observed endpoints', () => {
    const events: NetworkEvent[] = [
      {
        id: 'evt-1',
        requestId: 'req-1',
        timestamp: '2024-01-01T00:00:00Z',
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'GET',
        url: 'https://api.example.com/users/123',
        path: '/users/123',
        source: 'upstream' as const,
        status: 200,
        durationMs: 50
      }
    ];

    const scannedEndpoints: ScannedEndpoint[] = [
      {
        method: 'GET',
        urlTemplate: '/users/{id}',
        filePath: 'src/api/users.ts',
        line: 10,
        column: 5,
        componentName: 'UserService',
        callType: 'fetch',
        resolvedUrl: 'https://api.example.com/users/:id'
      }
    ];

    const inventory = buildEndpointInventory(events, scannedEndpoints);
    const endpoint = inventory.byHost.get('api.example.com')
      ?.find(e => e.method === 'GET' && e.urlTemplate === '/users/{id}');
    
    // Should remain observed, not become code-only
    expect(endpoint?.status).toMatch(/^observed-/);
  });
});
