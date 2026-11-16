/**
 * Test that merging unresolved and resolved endpoints preserves all data.
 * Bugbot 4581311982: Unresolved merge overwrites existing items
 */

import { buildEndpointInventory } from '../packages/mockifyer-core/src/utils/atlas-endpoint-inventory';
import type { NetworkEvent } from '../packages/mockifyer-core/src/utils/network-event-types';
import type { ScannedEndpoint } from '../packages/mockifyer-core/src/utils/atlas-code-scanner';

describe('Unresolved endpoint merging', () => {
  it('preserves resolved scan when unresolved traffic promotes unresolved scan', () => {
    // This is the specific scenario Bugbot warns about:
    // 1. Unresolved code scan -> creates entry in "Unresolved base URL"
    // 2. Resolved code scan -> creates entry in "api.example.com"
    // 3. Traffic arrives -> moves unresolved entry to "api.example.com", should NOT overwrite #2
    
    const scannedEndpoints: ScannedEndpoint[] = [
      // First: unresolved scan (processed first, goes to "Unresolved base URL")
      {
        method: 'GET',
        urlTemplate: '/data/{id}',
        filePath: 'src/unresolved-caller.ts',
        line: 5,
        column: 10,
        callType: 'fetch',
        resolvedUrl: undefined
      },
      // Second: resolved scan (goes directly to "api.example.com")
      {
        method: 'GET',
        urlTemplate: '/data/{id}',
        filePath: 'src/resolved-caller.ts',
        line: 15,
        column: 20,
        callType: 'axios',
        resolvedUrl: 'https://api.example.com/data/{id}'
      }
    ];

    // Now traffic arrives - it will try to move the unresolved entry
    const events: NetworkEvent[] = [
      {
        id: 'evt-1',
        requestId: 'req-1',
        timestamp: '2024-01-01T00:00:00Z',
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'GET',
        url: 'https://api.example.com/data/999',
        path: '/data/999',
        source: 'upstream' as const,
        status: 200,
        durationMs: 60
      }
    ];

    const inventory = buildEndpointInventory(events, scannedEndpoints);
    
    const apiHost = inventory.byHost.get('api.example.com');
    expect(apiHost?.length).toBe(1);
    
    const endpoint = apiHost?.[0];
    // CRITICAL: Should have BOTH code locations, not lose the resolved one
    expect(endpoint?.codeLocations.length).toBe(2);
    const files = endpoint?.codeLocations.map(c => c.filePath).sort();
    expect(files).toEqual(['src/resolved-caller.ts', 'src/unresolved-caller.ts']);
  });

  it('merges unresolved code scan with later traffic without losing data', () => {
    // First: unresolved code scan (no resolvedUrl)
    const scannedEndpoints: ScannedEndpoint[] = [
      {
        method: 'GET',
        urlTemplate: '/users/{id}',
        filePath: 'src/users.ts',
        line: 10,
        column: 5,
        callType: 'fetch',
        resolvedUrl: undefined  // Unresolved
      }
    ];

    // Later: traffic for the same endpoint
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

    const inventory = buildEndpointInventory(events, scannedEndpoints);
    
    // Should have one merged endpoint
    const apiHost = inventory.byHost.get('api.example.com');
    expect(apiHost?.length).toBe(1);
    
    const endpoint = apiHost?.[0];
    expect(endpoint?.urlTemplate).toBe('/users/{id}');
    // Should have both code location and observation
    expect(endpoint?.codeLocations.length).toBe(1);
    expect(endpoint?.observations.length).toBe(1);
    expect(endpoint?.status).toMatch(/^observed-/);
  });

  it('merges both resolved and unresolved code scans with traffic without losing data', () => {
    // Both resolved and unresolved scans for the same endpoint
    const scannedEndpoints: ScannedEndpoint[] = [
      {
        method: 'POST',
        urlTemplate: '/items/{id}',
        filePath: 'src/items-resolved.ts',
        line: 20,
        column: 10,
        callType: 'axios',
        resolvedUrl: 'https://api.example.com/items/{id}'  // Resolved
      },
      {
        method: 'POST',
        urlTemplate: '/items/{id}',
        filePath: 'src/items-unresolved.ts',
        line: 30,
        column: 5,
        callType: 'fetch',
        resolvedUrl: undefined  // Unresolved
      }
    ];

    // Later: traffic for the same endpoint (but processed as unresolved initially, then moved)
    const events: NetworkEvent[] = [
      {
        id: 'evt-1',
        requestId: 'req-1',
        timestamp: '2024-01-01T00:00:00Z',
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'POST',
        url: 'https://api.example.com/items/456',
        path: '/items/456',
        source: 'upstream' as const,
        status: 201,
        durationMs: 80
      }
    ];

    const inventory = buildEndpointInventory(events, scannedEndpoints);
    
    const apiHost = inventory.byHost.get('api.example.com');
    expect(apiHost?.length).toBe(1);
    
    const endpoint = apiHost?.[0];
    expect(endpoint?.urlTemplate).toBe('/items/{id}');
    // Should preserve BOTH code locations (resolved + unresolved)
    expect(endpoint?.codeLocations.length).toBe(2);
    const filePaths = endpoint?.codeLocations.map(c => c.filePath).sort();
    expect(filePaths).toEqual(['src/items-resolved.ts', 'src/items-unresolved.ts']);
    // Should have observation from traffic
    expect(endpoint?.observations.length).toBe(1);
    expect(endpoint?.status).toMatch(/^observed-/);
  });

  it('merges mock flag from resolved scan when unresolved endpoint moves', () => {
    const scannedEndpoints: ScannedEndpoint[] = [
      {
        method: 'DELETE',
        urlTemplate: '/resources/{id}',
        filePath: 'src/resources.ts',
        line: 30,
        column: 15,
        callType: 'fetch',
        resolvedUrl: 'https://api.example.com/resources/{id}'
      }
    ];

    const mockFiles = [
      { method: 'DELETE', url: 'https://api.example.com/resources/789' }
    ];

    const events: NetworkEvent[] = [
      {
        id: 'evt-1',
        requestId: 'req-1',
        timestamp: '2024-01-01T00:00:00Z',
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'DELETE',
        url: 'https://api.example.com/resources/789',
        path: '/resources/789',
        source: 'upstream' as const,
        status: 204,
        durationMs: 30
      }
    ];

    const inventory = buildEndpointInventory(events, scannedEndpoints, mockFiles);
    
    const apiHost = inventory.byHost.get('api.example.com');
    const endpoint = apiHost?.find(e => e.method === 'DELETE');
    
    expect(endpoint).toBeDefined();
    // Should preserve mockExists flag
    expect(endpoint?.mockExists).toBe(true);
    expect(endpoint?.codeLocations.length).toBe(1);
    expect(endpoint?.observations.length).toBe(1);
  });
});
