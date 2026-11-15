import { describe, it, expect } from '@jest/globals';
import { buildEndpointInventory } from '../packages/mockifyer-core/dist/utils/atlas-endpoint-inventory.js';

describe('Atlas Inventory - Malformed URL splitting', () => {
  it('should split http://host:port{param} into host and /{param} path', () => {
    const scannedEndpoints = [
      {
        method: 'GET',
        resolvedUrl: 'http://127.0.0.1:4200{param}',
        path: undefined,
        urlTemplate: '{param}',
        filePath: '/test/file.ts',
        line: 10,
        column: 5,
        componentName: 'TestComponent',
        callType: 'fetch' as const,
      },
    ];

    const inventory = buildEndpointInventory([], scannedEndpoints);
    
    expect(inventory.all.length).toBe(1);
    const item = inventory.all[0];
    expect(item.host).toBe('127.0.0.1:4200');
    expect(item.urlTemplate).toBe('/{param}');
  });

  it('should split https://host{param}/path into host and /{param}/path', () => {
    const scannedEndpoints = [
      {
        method: 'POST',
        resolvedUrl: 'https://api.example.com{param}/graphql',
        path: undefined,
        urlTemplate: '{param}/graphql',
        filePath: '/test/file.ts',
        line: 20,
        column: 5,
        componentName: 'TestComponent',
        callType: 'fetch' as const,
      },
    ];

    const inventory = buildEndpointInventory([], scannedEndpoints);
    
    expect(inventory.all.length).toBe(1);
    const item = inventory.all[0];
    expect(item.host).toBe('api.example.com');
    expect(item.urlTemplate).toBe('/{param}/graphql');
  });

  it('should handle properly formed URLs normally', () => {
    const scannedEndpoints = [
      {
        method: 'GET',
        resolvedUrl: 'http://localhost:3000/api/users',
        path: undefined,
        urlTemplate: '/api/users',
        filePath: '/test/file.ts',
        line: 30,
        column: 5,
        componentName: 'TestComponent',
        callType: 'fetch' as const,
      },
    ];

    const inventory = buildEndpointInventory([], scannedEndpoints);
    
    expect(inventory.all.length).toBe(1);
    const item = inventory.all[0];
    expect(item.host).toBe('localhost:3000');
    expect(item.urlTemplate).toBe('/api/users');
  });
});
