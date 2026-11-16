/**
 * Test that code scan templates merge with traffic templates.
 * Code may use :id or {param} while traffic normalizes to {id}/{uuid}/{slug}.
 */

import { buildEndpointInventory } from '../packages/mockifyer-core/src/utils/atlas-endpoint-inventory';
import type { NetworkEvent } from '../packages/mockifyer-core/src/utils/network-event-types';
import type { ScannedEndpoint } from '../packages/mockifyer-core/src/utils/atlas-code-scanner';

describe('Atlas template merging', () => {
  it('merges code template :id with traffic template {id}', () => {
    const events: NetworkEvent[] = [
      {
        id: 'evt-1',
        requestId: 'req-1',
        timestamp: '2024-01-01T00:00:00Z',
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'GET',
        url: 'https://api.example.com/users/123',  // Will normalize to /users/{id}
        path: '/users/123',
        source: 'upstream' as const,
        status: 200,
        durationMs: 50
      }
    ];

    const scannedEndpoints: ScannedEndpoint[] = [
      {
        method: 'GET',
        urlTemplate: '/users/:id',  // Express-style template
        filePath: 'src/routes/users.ts',
        line: 10,
        column: 5,
        callType: 'fetch',
        resolvedUrl: 'https://api.example.com/users/:id'
      }
    ];

    const inventory = buildEndpointInventory(events, scannedEndpoints);
    const endpoint = inventory.byHost.get('api.example.com')
      ?.find(e => e.method === 'GET' && e.urlTemplate === '/users/{id}');
    
    // Should merge into one endpoint with both observations and code location
    expect(endpoint).toBeDefined();
    expect(endpoint?.observations.length).toBeGreaterThan(0);
    expect(endpoint?.codeLocations.length).toBeGreaterThan(0);
    expect(endpoint?.status).toMatch(/^observed-/);
  });

  it('merges code template {param} with traffic template {id}', () => {
    const events: NetworkEvent[] = [
      {
        id: 'evt-1',
        requestId: 'req-1',
        timestamp: '2024-01-01T00:00:00Z',
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'POST',
        url: 'https://api.example.com/items/42',  // Will normalize to /items/{id}
        path: '/items/42',
        source: 'upstream' as const,
        status: 201,
        durationMs: 30
      }
    ];

    const scannedEndpoints: ScannedEndpoint[] = [
      {
        method: 'POST',
        urlTemplate: '/items/{param}',  // Generic param template
        filePath: 'src/api/items.ts',
        line: 20,
        column: 10,
        callType: 'axios',
        resolvedUrl: undefined  // Unresolved
      }
    ];

    const inventory = buildEndpointInventory(events, scannedEndpoints);
    
    // Should merge into one endpoint
    const endpoint = inventory.byHost.get('api.example.com')
      ?.find(e => e.method === 'POST' && e.urlTemplate === '/items/{id}');
    
    expect(endpoint).toBeDefined();
    expect(endpoint?.observations.length).toBeGreaterThan(0);
    expect(endpoint?.codeLocations.length).toBeGreaterThan(0);
  });

  it('creates separate endpoints when templates truly differ', () => {
    const events: NetworkEvent[] = [
      {
        id: 'evt-1',
        requestId: 'req-1',
        timestamp: '2024-01-01T00:00:00Z',
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'GET',
        url: 'https://api.example.com/posts/123',
        path: '/posts/123',
        source: 'upstream' as const,
        status: 200,
        durationMs: 50
      }
    ];

    const scannedEndpoints: ScannedEndpoint[] = [
      {
        method: 'GET',
        urlTemplate: '/comments/:id',  // Different path
        filePath: 'src/api/comments.ts',
        line: 5,
        column: 3,
        callType: 'fetch',
        resolvedUrl: 'https://api.example.com/comments/:id'
      }
    ];

    const inventory = buildEndpointInventory(events, scannedEndpoints);
    const endpoints = inventory.byHost.get('api.example.com');
    
    // Should have two separate endpoints
    expect(endpoints?.length).toBe(2);
    expect(endpoints?.find(e => e.urlTemplate === '/posts/{id}')).toBeDefined();
    expect(endpoints?.find(e => e.urlTemplate === '/comments/{id}')).toBeDefined();
  });
});
