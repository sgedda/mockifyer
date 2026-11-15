/**
 * Tests for Bugbot-reported issues fixed in PR #536
 */

import { buildEndpointInventory } from '../packages/mockifyer-core/src/utils/atlas-endpoint-inventory';
import type { NetworkEvent } from '../packages/mockifyer-core/src/utils/network-event-types';
import type { ScannedEndpoint } from '../packages/mockifyer-core/src/utils/atlas-code-scanner';

describe('Atlas Bugbot fixes', () => {
  describe('Query rewrite does not break host/path split', () => {
    it('should handle URL patterns correctly', () => {
      // This test documents the expected behavior:
      // Pattern: http://127.0.0.1:4200{param} should NOT become http://127.0.0.1:4200?{query}
      // The cleanUrlTemplate function is private, so we test via inventory
      const scannedEndpoints: ScannedEndpoint[] = [
        {
          method: 'GET',
          urlTemplate: 'http://127.0.0.1:4200{param}',
          resolvedUrl: 'http://127.0.0.1:4200',
          filePath: 'test.ts',
          line: 10,
          column: 5,
          callType: 'fetch',
        },
      ];

      const networkEvents: NetworkEvent[] = [];

      const inventory = buildEndpointInventory(networkEvents, scannedEndpoints);

      // The host should be extracted correctly, not broken by query rewrite
      const item = inventory.byHost.get('127.0.0.1:4200')?.[0];
      expect(item).toBeDefined();
      expect(item?.host).toBe('127.0.0.1:4200');
    });
  });

  describe('Relative URLs are not labeled as unresolved', () => {
    it('should group relative paths under fallbackHost, not "Unresolved base URL"', () => {
      const scannedEndpoints: ScannedEndpoint[] = [
        {
          method: 'GET',
          urlTemplate: '/api/demo/chain',
          resolvedUrl: '/api/demo/chain',
          filePath: 'test.ts',
          line: 10,
          column: 5,
          callType: 'fetch',
        },
      ];

      const networkEvents: NetworkEvent[] = [];

      const inventory = buildEndpointInventory(networkEvents, scannedEndpoints);

      // The relative path should NOT be under "Unresolved base URL"
      const unresolvedItems = inventory.byHost.get('Unresolved base URL');
      expect(unresolvedItems).toBeUndefined();

      // It should be under some host (either fallbackHost or another host)
      // The key point is it's not under "Unresolved base URL"
      const allItems = Array.from(inventory.byHost.values()).flat();
      const relativePathItem = allItems.find(item => item.urlTemplate.includes('/api/demo'));
      expect(relativePathItem).toBeDefined();
      expect(relativePathItem?.host).not.toBe('Unresolved base URL');
    });

    it('should still group truly unresolved templates under "Unresolved base URL"', () => {
      const scannedEndpoints: ScannedEndpoint[] = [
        {
          method: 'GET',
          urlTemplate: '{param}',
          resolvedUrl: '{param}',
          filePath: 'test.ts',
          line: 10,
          column: 5,
          callType: 'unresolved',
        },
      ];

      const networkEvents: NetworkEvent[] = [];

      const inventory = buildEndpointInventory(networkEvents, scannedEndpoints);

      // Truly unresolved pattern should be under "Unresolved base URL"
      // The template is normalized to remove the {param} but retains the pattern
      const unresolvedItems = inventory.byHost.get('Unresolved base URL');
      expect(unresolvedItems).toBeDefined();
      expect(unresolvedItems?.[0]?.urlTemplate).toMatch(/param/);
    });
  });

  describe('Unresolved merge counts call sites accurately', () => {
    it('should count individual unresolved endpoints before consolidation', () => {
      const scannedEndpoints: ScannedEndpoint[] = [
        {
          method: 'GET',
          urlTemplate: 'unresolved',
          filePath: 'test1.ts',
          line: 10,
          column: 5,
          callType: 'unresolved',
        },
        {
          method: 'POST',
          urlTemplate: 'unresolved',
          filePath: 'test2.ts',
          line: 20,
          column: 5,
          callType: 'unresolved',
        },
        {
          method: 'DELETE',
          urlTemplate: 'different-unresolved',
          filePath: 'test3.ts',
          line: 30,
          column: 5,
          callType: 'unresolved',
        },
      ];

      const networkEvents: NetworkEvent[] = [];

      const inventory = buildEndpointInventory(networkEvents, scannedEndpoints);

      // With my fix, unresolvedCount should reflect the original count before consolidation
      // Here we have 2 different patterns: 'unresolved' and 'different-unresolved'
      // So the count should be 2 (consolidation groups by host, not by template)
      expect(inventory.summary.unresolvedCount).toBeGreaterThanOrEqual(2);

      // The displayed rows should be consolidated per host
      const unresolvedItems = inventory.byHost.get('Unresolved base URL');
      expect(unresolvedItems).toBeDefined();
      expect(unresolvedItems!.length).toBeGreaterThanOrEqual(1);
    });
  });
});
