/**
 * Test: OpenAPI paths collide across hosts
 * Bug ID: 4577776585
 * 
 * generateOpenApiSpec keys operations only by urlTemplate and method,
 * then lists every host under servers. Same path on two hosts overwrites
 * one operation, and consumers cannot tell which server owns which endpoint.
 */

import { generateOpenApiSpec } from '../packages/mockifyer-core/src/utils/atlas-endpoint-inventory';
import type { EndpointInventory } from '../packages/mockifyer-core/src/utils/atlas-endpoint-inventory';

describe('OpenAPI paths should not collide across hosts', () => {
  it('should preserve operations from different hosts with same path and method', () => {
    const inventory: EndpointInventory = {
      byHost: new Map([
        ['api.service-a.com', [{
          host: 'api.service-a.com',
          method: 'GET',
          urlTemplate: '/users/{id}',
          status: 'observed-no-chain',
          observations: [{
            requestId: 'req-a-1',
            timestamp: new Date().toISOString(),
            durationMs: 100,
            status: 200,
            childCount: 0
          }],
          callCount: 1,
          avgDurationMs: 100,
          codeLocations: [],
          mockExists: false
        }]],
        ['api.service-b.com', [{
          host: 'api.service-b.com',
          method: 'GET',
          urlTemplate: '/users/{id}',
          status: 'observed-no-chain',
          observations: [{
            requestId: 'req-b-1',
            timestamp: new Date().toISOString(),
            durationMs: 200,
            status: 200,
            childCount: 0
          }],
          callCount: 1,
          avgDurationMs: 200,
          codeLocations: [],
          mockExists: false
        }]]
      ]),
      all: [],
      summary: {
        totalEndpoints: 2,
        observedCount: 2,
        mockedOnlyCount: 0,
        codeOnlyCount: 0,
        unresolvedCount: 0,
        hostCoverage: [
          { host: 'api.service-a.com', total: 1, exercised: 1, coveragePercent: 100 },
          { host: 'api.service-b.com', total: 1, exercised: 1, coveragePercent: 100 }
        ]
      }
    };

    // Populate all array from byHost
    for (const endpoints of inventory.byHost.values()) {
      inventory.all.push(...endpoints);
    }

    const spec = generateOpenApiSpec(inventory, {
      title: 'Test API',
      version: '1.0.0'
    });

    // Both hosts should be in servers
    expect(spec.servers).toHaveLength(2);
    expect(spec.servers).toContainEqual({ url: 'https://api.service-a.com' });
    expect(spec.servers).toContainEqual({ url: 'https://api.service-b.com' });

    // FIXED: Operation should now use x-oneOf to list all variants with x-host
    const paths = spec.paths as Record<string, any>;
    expect(paths['/users/{id}']).toBeDefined();
    expect(paths['/users/{id}'].get).toBeDefined();
    
    // Check for collision handling with x-oneOf
    const getOp = paths['/users/{id}'].get;
    expect(getOp['x-oneOf']).toBeDefined();
    expect(getOp['x-oneOf']).toHaveLength(2);
    
    // OpenAPI 3.0 requires responses on every operation (Bug 4582036201)
    expect(getOp.responses).toBeDefined();
    expect(getOp.responses['200']).toBeDefined();
    
    // Each variant should have x-host to identify which server it belongs to
    const hostA = getOp['x-oneOf'].find((v: any) => v['x-host'] === 'api.service-a.com');
    const hostB = getOp['x-oneOf'].find((v: any) => v['x-host'] === 'api.service-b.com');
    
    expect(hostA).toBeDefined();
    expect(hostA.description).toContain('100ms');
    expect(hostA.responses).toBeDefined(); // Each variant should also have responses
    
    expect(hostB).toBeDefined();
    expect(hostB.description).toContain('200ms');
    expect(hostB.responses).toBeDefined();
  });
});
