/**
 * Test that chain detection works when parentRequestId points to parent's id field.
 */

import { buildEndpointInventory } from '../packages/mockifyer-core/src/utils/atlas-endpoint-inventory';
import type { NetworkEvent } from '../packages/mockifyer-core/src/utils/network-event-types';

describe('Atlas chain detection', () => {
  it('detects chains when parentRequestId points to parent id', () => {
    const events: NetworkEvent[] = [
      {
        id: 'evt-parent',
        requestId: 'req-parent',
        timestamp: '2024-01-01T00:00:00Z',
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'GET',
        url: 'https://gateway.example.com/api/trips',
        path: '/api/trips',
        source: 'upstream' as const,
        status: 200,
        durationMs: 100
      },
      {
        id: 'evt-child',
        requestId: 'req-child',
        parentRequestId: 'evt-parent', // Points to parent's id, not requestId
        timestamp: '2024-01-01T00:00:01Z',
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'GET',
        url: 'https://downstream.example.com/api/data',
        path: '/api/data',
        source: 'upstream' as const,
        status: 200,
        durationMs: 50
      }
    ];

    const inventory = buildEndpointInventory(events, []);
    
    // Parent endpoint should have chain status
    const gateway = inventory.byHost.get('gateway.example.com');
    expect(gateway).toBeDefined();
    const parentEndpoint = gateway?.find(e => e.urlTemplate === '/api/trips');
    expect(parentEndpoint).toBeDefined();
    expect(parentEndpoint?.status).toBe('observed-with-chain');
    
    // Child endpoint should exist
    const downstream = inventory.byHost.get('downstream.example.com');
    expect(downstream).toBeDefined();
    expect(downstream?.find(e => e.urlTemplate === '/api/data')).toBeDefined();
  });

  it('detects chains when parentRequestId points to parent requestId', () => {
    const events: NetworkEvent[] = [
      {
        id: 'evt-parent',
        requestId: 'req-parent',
        timestamp: '2024-01-01T00:00:00Z',
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'GET',
        url: 'https://gateway.example.com/api/trips',
        path: '/api/trips',
        source: 'upstream' as const,
        status: 200,
        durationMs: 100
      },
      {
        id: 'evt-child',
        requestId: 'req-child',
        parentRequestId: 'req-parent', // Points to parent's requestId
        timestamp: '2024-01-01T00:00:01Z',
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'GET',
        url: 'https://downstream.example.com/api/data',
        path: '/api/data',
        source: 'upstream' as const,
        status: 200,
        durationMs: 50
      }
    ];

    const inventory = buildEndpointInventory(events, []);
    
    const gateway = inventory.byHost.get('gateway.example.com');
    const parentEndpoint = gateway?.find(e => e.urlTemplate === '/api/trips');
    expect(parentEndpoint?.status).toBe('observed-with-chain');
  });
});
