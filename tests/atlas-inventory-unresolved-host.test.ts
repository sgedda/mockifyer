/**
 * Test that code-only endpoints with unresolved base URLs are grouped
 * under 'Unresolved base URL', not attached to observed external hosts.
 */

import { buildEndpointInventory } from '../packages/mockifyer-core/src/utils/atlas-endpoint-inventory';
import type { NetworkEvent } from '../packages/mockifyer-core/src/utils/network-event-types';

describe('Atlas inventory unresolved host grouping', () => {
  test('code-only endpoints with no resolved URL use "Unresolved base URL" host', () => {
    const networkEvents: NetworkEvent[] = [
      {
        id: 'ev-1',
        method: 'GET',
        url: 'https://api.example.com/data',
        timestamp: new Date().toISOString(),
        source: 'upstream',
        transport: 'fetch',
        status: 200,
        scenario: 'default',
      },
    ];

    const scannedEndpoints = [
      {
        method: 'POST',
        urlTemplate: '{param}/graphql',
        filePath: '/app/api/graphql.ts',
        line: 25,
        column: 10,
        callType: 'fetch' as const,
        resolvedUrl: undefined, // No resolved URL
      },
      {
        method: 'GET',
        urlTemplate: 'unresolved',
        filePath: '/app/api/client.ts',
        line: 30,
        column: 5,
        callType: 'unresolved' as const,
        resolvedUrl: undefined,
      },
    ];

    const inventory = buildEndpointInventory(networkEvents, scannedEndpoints);

    // Observed endpoint should be under its own host
    expect(inventory.byHost.has('api.example.com')).toBe(true);
    const externalEndpoints = inventory.byHost.get('api.example.com');
    expect(externalEndpoints?.length).toBe(1);
    expect(externalEndpoints?.[0].urlTemplate).toBe('/data');

    // Code-only unresolved endpoints should be under 'Unresolved base URL'
    expect(inventory.byHost.has('Unresolved base URL')).toBe(true);
    const unresolvedEndpoints = inventory.byHost.get('Unresolved base URL');
    expect(unresolvedEndpoints).toBeDefined();
    expect(unresolvedEndpoints!.length).toBeGreaterThan(0);
    
    // Should have unresolved entries
    const hasUnresolved = unresolvedEndpoints!.some(e => e.urlTemplate === 'unresolved' || e.urlTemplate.includes('graphql'));
    expect(hasUnresolved).toBe(true)

    // Should NOT be grouped under external host
    expect(externalEndpoints?.some(e => e.urlTemplate.includes('graphql'))).toBe(false);
    expect(externalEndpoints?.some(e => e.urlTemplate === 'unresolved')).toBe(false);
  });

  test('resolved code-only endpoints use their proper host', () => {
    const scannedEndpoints = [
      {
        method: 'POST',
        urlTemplate: '/graphql',
        filePath: '/app/api/graphql.ts',
        line: 25,
        column: 10,
        callType: 'fetch' as const,
        resolvedUrl: 'http://127.0.0.1:4200/graphql',
      },
    ];

    const inventory = buildEndpointInventory([], scannedEndpoints);

    expect(inventory.byHost.has('127.0.0.1:4200')).toBe(true);
    expect(inventory.byHost.has('Unresolved base URL')).toBe(false);
    
    const endpoints = inventory.byHost.get('127.0.0.1:4200');
    expect(endpoints?.length).toBe(1);
    expect(endpoints?.[0].urlTemplate).toBe('/graphql');
    expect(endpoints?.[0].status).toBe('code-only');
  });

  test('unresolved endpoints never use fallback host from observed traffic', () => {
    const networkEvents: NetworkEvent[] = [
      {
        id: 'ev-1',
        method: 'GET',
        url: 'https://api.adviceslip.com/advice',
        timestamp: new Date().toISOString(),
        source: 'upstream',
        transport: 'fetch',
        status: 200,
        scenario: 'default',
      },
      {
        id: 'ev-2',
        method: 'GET',
        url: 'https://api.open-meteo.com/forecast',
        timestamp: new Date().toISOString(),
        source: 'upstream',
        transport: 'fetch',
        status: 200,
        scenario: 'default',
      },
    ];

    const scannedEndpoints = [
      {
        method: 'GET',
        urlTemplate: 'unresolved',
        filePath: '/app/server.ts',
        line: 33,
        column: 10,
        callType: 'unresolved' as const,
        resolvedUrl: undefined,
      },
    ];

    const inventory = buildEndpointInventory(networkEvents, scannedEndpoints);

    // Should NOT be under any observed host
    expect(inventory.byHost.get('api.adviceslip.com')?.some(e => e.urlTemplate === 'unresolved')).toBe(false);
    expect(inventory.byHost.get('api.open-meteo.com')?.some(e => e.urlTemplate === 'unresolved')).toBe(false);

    // Should be under 'Unresolved base URL'
    expect(inventory.byHost.has('Unresolved base URL')).toBe(true);
    const unresolvedEndpoints = inventory.byHost.get('Unresolved base URL');
    expect(unresolvedEndpoints?.length).toBe(1);
    expect(unresolvedEndpoints?.[0].urlTemplate).toBe('unresolved');
  });
});
