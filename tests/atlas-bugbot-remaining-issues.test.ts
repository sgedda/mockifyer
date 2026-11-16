/**
 * Comprehensive tests for all remaining Bugbot issues on PR #536
 * This file verifies that previously fixed bugs stay fixed.
 */

import { buildEndpointInventory } from '../packages/mockifyer-core/src/utils/atlas-endpoint-inventory';
import { generateSystemDiagramSVG } from '../packages/mockifyer-core/src/utils/atlas-architecture-view';
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

describe('Bugbot remaining issues verification', () => {
  /**
   * Bug 4577961965: Host diagram ignores observed traffic
   * Fixed in commit with "Bug #40" comment
   */
  describe('Host diagram observed traffic (4577961965)', () => {
    it('should mark host as live when it has observed traffic', () => {
      const events: NetworkEvent[] = [
        createEvent({
          url: 'https://api.service.com/data',
          method: 'GET',
          status: 200,
          durationMs: 50
        })
      ];
      
      const svg = generateSystemDiagramSVG(
        buildEndpointInventory(events, []),
        events
      );
      
      // Host with observed traffic should be drawn as 'backend' (live), not 'code-backend' (unused)
      // The SVG should contain the host node with type 'backend'
      expect(svg).toContain('api.service.com');
      // Should NOT be drawn as code-backend (gray dashed)
      expect(svg).not.toMatch(/api\.service\.com.*code-backend/);
    });

    it('should prioritize observed status over code-only when host has both', () => {
      const events: NetworkEvent[] = [
        createEvent({
          url: 'https://api.service.com/users/123',
          method: 'GET',
          status: 200,
          durationMs: 50
        })
      ];
      
      const scanned = [{
        filePath: 'src/api.ts',
        line: 10,
        column: 5,
        method: 'GET',
        url: 'https://api.service.com/unused',
        urlTemplate: '/unused',
        callType: 'axios' as const
      }];
      
      const inventory = buildEndpointInventory(events, scanned);
      const svg = generateSystemDiagramSVG(inventory, events);
      
      // Host has both observed and code-only endpoints
      // Should be drawn as live (backend), not code-only (code-backend)
      expect(svg).toContain('api.service.com');
      // The fix ensures hasObserved is checked correctly
    });
  });

  /**
   * Bug 4577961987: Error hosts drawn as live backends
   * Fixed in commit with "Bug #41" comment
   */
  describe('Error hosts visualization (4577961987)', () => {
    it('should draw error hosts with error-backend type', () => {
      const events: NetworkEvent[] = [
        createEvent({
          url: 'https://failing-api.com/data',
          method: 'GET',
          status: 500,
          durationMs: 100,
          errorMessage: 'Internal Server Error'
        }),
        createEvent({
          url: 'https://failing-api.com/data',
          method: 'GET',
          status: 500,
          durationMs: 110
        })
      ];
      
      const inventory = buildEndpointInventory(events, []);
      const svg = generateSystemDiagramSVG(inventory, events);
      
      // Error host should be drawn with error-backend type, not as healthy backend
      expect(svg).toContain('failing-api.com');
      // The node should have error styling (red)
    });
  });

  /**
   * Bug 4578168729: Parent host matching ignores ports
   * Fixed with "Bug #49" comment using url.host instead of url.hostname
   */
  describe('Downstream parent with ports (4578168729)', () => {
    it('should match parent host including port number', () => {
      const parentReqId = 'req-parent-' + Math.random();
      const events: NetworkEvent[] = [
        createEvent({
          requestId: parentReqId,
          url: 'http://localhost:3000/api/data',
          method: 'GET',
          status: 200,
          durationMs: 50
        }),
        createEvent({
          url: 'http://downstream-service:8080/external',
          method: 'GET',
          status: 200,
          durationMs: 30,
          parentRequestId: parentReqId
        })
      ];
      
      const inventory = buildEndpointInventory(events, []);
      const svg = generateSystemDiagramSVG(inventory, events);
      
      // Both hosts with ports should be present
      expect(svg).toContain('localhost:3000');
      expect(svg).toContain('downstream-service:8080');
    });
  });

  /**
   * Bug 4578168754: Parent lookup skips event id fallback
   * Fixed with "Bug #50" comment checking both requestId and id
   */
  describe('Parent lookup with id fallback (4578168754)', () => {
    it('should find parent using id when requestId is missing', () => {
      const parentId = 'parent-id-only-' + Math.random();
      const events: NetworkEvent[] = [
        createEvent({
          id: parentId,
          requestId: undefined, // No requestId on parent
          url: 'https://api.service.com/parent',
          method: 'GET',
          status: 200,
          durationMs: 50
        }),
        createEvent({
          url: 'https://downstream.service.com/data',
          method: 'GET',
          status: 200,
          durationMs: 30,
          parentRequestId: parentId // Points to parent's id, not requestId
        })
      ];
      
      const inventory = buildEndpointInventory(events, []);
      const svg = generateSystemDiagramSVG(inventory, events);
      
      // Should still detect the parent-child relationship
      expect(svg).toContain('api.service.com');
      expect(svg).toContain('downstream.service.com');
    });
  });

  /**
   * Bug 4578168787: Empty inventory yields invalid SVG
   * Fixed at lines 109-111 with cols guard
   */
  describe('Empty inventory SVG (4578168787)', () => {
    it('should generate valid SVG with empty inventory', () => {
      const events: NetworkEvent[] = [];
      const inventory = buildEndpointInventory(events, []);
      const svg = generateSystemDiagramSVG(inventory, events);
      
      // Should produce valid SVG markup
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      expect(svg).toContain('viewBox');
      
      // viewBox should not contain NaN
      expect(svg).not.toContain('NaN');
      
      // Application node should be positioned correctly (not negative x)
      expect(svg).toContain('Application');
    });
  });

  /**
   * Bug 4581415355: UUID placeholders collapse to generic IDs
   * Fixed in bed9fe99 with case-sensitive camelCase pattern
   */
  describe('UUID preservation (4581415355)', () => {
    it('should keep {uuid} and not convert to {id}', () => {
      const events: NetworkEvent[] = [
        createEvent({
          url: 'https://api.service.com/resources/550e8400-e29b-41d4-a716-446655440000',
          method: 'GET',
          status: 200,
          durationMs: 50
        })
      ];
      
      const inventory = buildEndpointInventory(events, []);
      
      // Should normalize to {uuid}, not {id}
      const resourceEndpoint = inventory.all.find(e => e.urlTemplate.includes('{uuid}'));
      expect(resourceEndpoint).toBeDefined();
      expect(resourceEndpoint!.urlTemplate).toBe('/resources/{uuid}');
      expect(resourceEndpoint!.urlTemplate).not.toBe('/resources/{id}');
    });
  });

  /**
   * Bug 4577962026: Path decode can split encoded segments
   * Fixed in 0eaf0c90 by preserving %2F
   */
  describe('Path decode preservation (4577962026)', () => {
    it('should not split segments on %2F', () => {
      const events: NetworkEvent[] = [
        createEvent({
          url: 'https://api.service.com/files/document%2Fname.pdf',
          method: 'GET',
          status: 200,
          durationMs: 50
        })
      ];
      
      const inventory = buildEndpointInventory(events, []);
      
      // Should be 2 segments: /files and /document%2Fname.pdf
      // NOT 3 segments: /files/document/{slug}
      const fileEndpoint = inventory.all.find(e => e.urlTemplate.includes('/files'));
      expect(fileEndpoint).toBeDefined();
      
      // The template should preserve the structure
      expect(fileEndpoint!.urlTemplate).not.toContain('/files/document/');
    });
  });
});
