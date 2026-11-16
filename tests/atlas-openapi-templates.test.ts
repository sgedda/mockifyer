/**
 * Test that OpenAPI export uses templated paths from inventory.
 * Without templates, /users/123 and /users/456 become separate operations.
 */

import { buildEndpointInventory, generateOpenApiSpec } from '../packages/mockifyer-core/src/utils/atlas-endpoint-inventory';
import type { NetworkEvent } from '../packages/mockifyer-core/src/utils/network-event-types';

describe('Atlas OpenAPI templates', () => {
  it('generates templated paths from multiple concrete URLs', () => {
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
      },
      {
        id: 'evt-2',
        requestId: 'req-2',
        timestamp: '2024-01-01T00:00:01Z',
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'GET',
        url: 'https://api.example.com/users/456',
        path: '/users/456',
        source: 'upstream' as const,
        status: 200,
        durationMs: 45
      },
      {
        id: 'evt-3',
        requestId: 'req-3',
        timestamp: '2024-01-01T00:00:02Z',
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'POST',
        url: 'https://api.example.com/posts/789',
        path: '/posts/789',
        source: 'upstream' as const,
        status: 201,
        durationMs: 80
      }
    ];

    const inventory = buildEndpointInventory(events, []);
    const openapi = generateOpenApiSpec(inventory, {
      title: 'Test API',
      version: '1.0.0',
      description: 'Test spec'
    });

    // Should have templated paths, not concrete ones
    expect(openapi.paths).toBeDefined();
    const paths = openapi.paths as Record<string, any>;
    
    // Should have /users/{id}, not /users/123 and /users/456
    expect(paths['/users/{id}']).toBeDefined();
    expect(paths['/users/123']).toBeUndefined();
    expect(paths['/users/456']).toBeUndefined();
    
    // Should have /posts/{id}
    expect(paths['/posts/{id}']).toBeDefined();
    expect(paths['/posts/789']).toBeUndefined();
    
    // Each path should have the correct method
    expect(paths['/users/{id}'].get).toBeDefined();
    expect(paths['/posts/{id}'].post).toBeDefined();
  });

  it('recognizes UUID patterns in URLs', () => {
    const events: NetworkEvent[] = [
      {
        id: 'evt-1',
        requestId: 'req-1',
        timestamp: '2024-01-01T00:00:00Z',
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'GET',
        url: 'https://api.example.com/users/550e8400-e29b-41d4-a716-446655440000',
        path: '/users/550e8400-e29b-41d4-a716-446655440000',
        source: 'upstream' as const,
        status: 200,
        durationMs: 50
      }
    ];

    const inventory = buildEndpointInventory(events, []);
    const openapi = generateOpenApiSpec(inventory, {
      title: 'Test API',
      version: '1.0.0'
    });

    const paths = openapi.paths as Record<string, any>;
    
    // Should have /users/{uuid}, not the concrete UUID
    expect(paths['/users/{uuid}']).toBeDefined();
    expect(paths['/users/550e8400-e29b-41d4-a716-446655440000']).toBeUndefined();
    
    // Should have a GET operation
    const getOp = paths['/users/{uuid}'].get;
    expect(getOp).toBeDefined();
    expect(getOp.summary).toContain('GET');
  });

  it('merges observations from multiple concrete URLs into one operation', () => {
    const events: NetworkEvent[] = [
      {
        id: 'evt-1',
        requestId: 'req-1',
        timestamp: '2024-01-01T00:00:00Z',
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'GET',
        url: 'https://api.example.com/items/1',
        path: '/items/1',
        source: 'upstream' as const,
        status: 200,
        durationMs: 50
      },
      {
        id: 'evt-2',
        requestId: 'req-2',
        timestamp: '2024-01-01T00:00:01Z',
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'GET',
        url: 'https://api.example.com/items/2',
        path: '/items/2',
        source: 'upstream' as const,
        status: 200,
        durationMs: 45
      },
      {
        id: 'evt-3',
        requestId: 'req-3',
        timestamp: '2024-01-01T00:00:02Z',
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'GET',
        url: 'https://api.example.com/items/3',
        path: '/items/3',
        source: 'upstream' as const,
        status: 404,
        durationMs: 30
      }
    ];

    const inventory = buildEndpointInventory(events, []);
    
    // The inventory should have 1 endpoint with 3 observations
    const endpoint = inventory.byHost.get('api.example.com')?.find(e => e.urlTemplate === '/items/{id}');
    expect(endpoint).toBeDefined();
    expect(endpoint?.observations.length).toBe(3);
    
    // OpenAPI should have 1 operation (not 3 separate paths for /items/1, /items/2, /items/3)
    const openapi = generateOpenApiSpec(inventory, { title: 'Test API', version: '1.0.0' });
    const paths = openapi.paths as Record<string, any>;
    
    // Should have /items/{id}, not concrete paths
    expect(paths['/items/{id}']).toBeDefined();
    expect(paths['/items/1']).toBeUndefined();
    expect(paths['/items/2']).toBeUndefined();
    expect(paths['/items/3']).toBeUndefined();
    
    const getOp = paths['/items/{id}'].get;
    expect(getOp).toBeDefined();
    expect(getOp.responses).toBeDefined();
    
    // Should mention the 3 observations in description
    expect(getOp.description).toContain('3 time');
  });
});
