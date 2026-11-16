/**
 * Test that malformed URLs with template syntax get normalized.
 * Bugbot 4581311976: Malformed URLs skip placeholder normalization
 */

import { buildEndpointInventory } from '../packages/mockifyer-core/src/utils/atlas-endpoint-inventory';
import type { NetworkEvent } from '../packages/mockifyer-core/src/utils/network-event-types';
import type { ScannedEndpoint } from '../packages/mockifyer-core/src/utils/atlas-code-scanner';

describe('Malformed URL placeholder normalization', () => {
  it('normalizes {param} in malformed URLs to {id}', () => {
    // Malformed URL from code scanner
    const scannedEndpoints: ScannedEndpoint[] = [
      {
        method: 'GET',
        urlTemplate: '/{param}',
        filePath: 'src/api.ts',
        line: 10,
        column: 5,
        callType: 'fetch',
        resolvedUrl: 'http://localhost:4200{param}'  // Malformed: {param} right after port
      }
    ];

    // Traffic with numeric ID that will normalize to /{id}
    const events: NetworkEvent[] = [
      {
        id: 'evt-1',
        requestId: 'req-1',
        timestamp: '2024-01-01T00:00:00Z',
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'GET',
        url: 'http://localhost:4200/123',  // Numeric ID
        path: '/123',
        source: 'upstream' as const,
        status: 200,
        durationMs: 50
      }
    ];

    const inventory = buildEndpointInventory(events, scannedEndpoints);
    
    // Should merge into one endpoint with template /{id}
    // Not two separate endpoints: /{param} and /{id}
    const localhost = inventory.byHost.get('localhost:4200');
    expect(localhost?.length).toBe(1);
    expect(localhost?.[0].urlTemplate).toBe('/{id}');
    expect(localhost?.[0].codeLocations.length).toBeGreaterThan(0);
    expect(localhost?.[0].observations.length).toBeGreaterThan(0);
  });

  it('normalizes {param} in malformed URL with path', () => {
    const scannedEndpoints: ScannedEndpoint[] = [
      {
        method: 'POST',
        urlTemplate: '/{param}/graphql',
        filePath: 'src/graphql.ts',
        line: 20,
        column: 10,
        callType: 'fetch',
        resolvedUrl: 'https://api.example.com{param}/graphql'  // Malformed
      }
    ];

    const events: NetworkEvent[] = [
      {
        id: 'evt-1',
        requestId: 'req-1',
        timestamp: '2024-01-01T00:00:00Z',
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'POST',
        url: 'https://api.example.com/123/graphql',  // Numeric ID that will normalize to {id}
        path: '/123/graphql',
        source: 'upstream' as const,
        status: 200,
        durationMs: 80
      }
    ];

    const inventory = buildEndpointInventory(events, scannedEndpoints);
    
    // Should merge with template /{id}/graphql
    const apiHost = inventory.byHost.get('api.example.com');
    expect(apiHost?.length).toBe(1);
    expect(apiHost?.[0].urlTemplate).toBe('/{id}/graphql');
    expect(apiHost?.[0].codeLocations.length).toBeGreaterThan(0);
    expect(apiHost?.[0].observations.length).toBeGreaterThan(0);
  });
});
