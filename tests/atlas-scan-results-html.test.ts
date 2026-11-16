/**
 * Test for Bug 4577961926: Scan results never reach HTML export
 * 
 * Bugbot claims: "scannedEndpoints is threaded through buildInteractiveIndex
 * and buildAtlasDocHtmlFiles, but writeAtlasDocHtml still calls
 * buildAtlasDocHtmlFiles with only bodiesRoot"
 */

import { buildEndpointInventory } from '../packages/mockifyer-core/src/utils/atlas-endpoint-inventory';
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

describe('Scan results in HTML export (4577961926)', () => {
  it('should include code-only endpoints from scanner in inventory', () => {
    // Only scanned endpoints, no traffic
    const events: NetworkEvent[] = [];
    
    const scanned = [
      {
        filePath: 'src/api.ts',
        line: 10,
        column: 5,
        method: 'GET',
        url: 'https://api.service.com/admin/settings',
        urlTemplate: '/admin/settings',
        callType: 'axios' as const
      },
      {
        filePath: 'src/api.ts',
        line: 20,
        column: 5,
        method: 'POST',
        url: 'https://api.service.com/admin/update',
        urlTemplate: '/admin/update',
        callType: 'fetch' as const
      }
    ];
    
    const inventory = buildEndpointInventory(events, scanned);
    
    // Scanned endpoints should be in the inventory
    expect(inventory.all.length).toBeGreaterThanOrEqual(2);
    
    const settingsEndpoint = inventory.all.find(e => e.urlTemplate === '/admin/settings');
    expect(settingsEndpoint).toBeDefined();
    expect(settingsEndpoint!.status).toBe('code-only');
    expect(settingsEndpoint!.codeLocations).toHaveLength(1);
    expect(settingsEndpoint!.codeLocations[0].filePath).toBe('src/api.ts');
    
    const updateEndpoint = inventory.all.find(e => e.urlTemplate === '/admin/update');
    expect(updateEndpoint).toBeDefined();
    expect(updateEndpoint!.status).toBe('code-only');
  });

  it('should merge scanned endpoints with observed traffic', () => {
    const events: NetworkEvent[] = [
      createEvent({
        url: 'https://api.service.com/users/123',
        method: 'GET',
        status: 200,
        durationMs: 50
      })
    ];
    
    const scanned = [
      {
        filePath: 'src/api.ts',
        line: 10,
        column: 5,
        method: 'GET',
        url: 'https://api.service.com/users/:id',
        urlTemplate: '/users/{id}',
        callType: 'axios' as const
      },
      {
        filePath: 'src/api.ts',
        line: 20,
        column: 5,
        method: 'DELETE',
        url: 'https://api.service.com/users/:id',
        urlTemplate: '/users/{id}',
        callType: 'axios' as const
      }
    ];
    
    const inventory = buildEndpointInventory(events, scanned);
    
    // Should have GET (observed + code) and DELETE (code-only)
    const getEndpoint = inventory.all.find(e => e.method === 'GET' && e.urlTemplate === '/users/{id}');
    expect(getEndpoint).toBeDefined();
    expect(getEndpoint!.status).toMatch(/observed/); // observed-with-chain or observed-no-chain
    expect(getEndpoint!.codeLocations).toHaveLength(1);
    expect(getEndpoint!.observations).toHaveLength(1);
    
    const deleteEndpoint = inventory.all.find(e => e.method === 'DELETE' && e.urlTemplate === '/users/{id}');
    expect(deleteEndpoint).toBeDefined();
    expect(deleteEndpoint!.status).toBe('code-only');
    expect(deleteEndpoint!.codeLocations).toHaveLength(1);
    expect(deleteEndpoint!.observations).toHaveLength(0);
  });
});
