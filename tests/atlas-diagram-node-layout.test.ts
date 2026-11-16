/**
 * Test that downstream diagram nodes don't overlap.
 * Multiple downstream hosts with same parent should be distributed vertically.
 */

import { generateSystemDiagramSVG } from '../packages/mockifyer-core/src/utils/atlas-architecture-view';
import { buildEndpointInventory } from '../packages/mockifyer-core/src/utils/atlas-endpoint-inventory';
import type { NetworkEvent } from '../packages/mockifyer-core/src/utils/network-event-types';

describe('Atlas diagram node layout', () => {
  it('distributes downstream nodes vertically to avoid overlap', () => {
    // Create events with one parent calling two downstream services
    const events: NetworkEvent[] = [
      {
        id: 'evt-1',
        requestId: 'req-1',
        timestamp: '2024-01-01T00:00:00Z',
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'GET',
        url: 'https://api.example.com/users',
        path: '/users',
        source: 'upstream' as const,
        status: 200,
        durationMs: 100
      },
      {
        id: 'evt-2',
        requestId: 'req-2',
        timestamp: '2024-01-01T00:00:00.050Z',
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'GET',
        url: 'https://auth.example.com/verify',
        path: '/verify',
        source: 'upstream' as const,
        status: 200,
        durationMs: 50,
        parentRequestId: 'req-1'  // Called by parent
      },
      {
        id: 'evt-3',
        requestId: 'req-3',
        timestamp: '2024-01-01T00:00:00.060Z',
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'GET',
        url: 'https://db.example.com/query',
        path: '/query',
        source: 'upstream' as const,
        status: 200,
        durationMs: 40,
        parentRequestId: 'req-1'  // Also called by same parent
      }
    ];

    const inventory = buildEndpointInventory(events, []);
    const svg = generateSystemDiagramSVG(inventory, events);

    // Look for text labels of downstream nodes
    // They should contain the downstream host names
    const hasAuth = svg.includes('auth.example.com');
    const hasDb = svg.includes('db.example.com');
    
    expect(hasAuth).toBe(true);
    expect(hasDb).toBe(true);
    
    // Extract all rect elements with their y positions and heights
    const rectRegex = /<rect[^>]*\sx="([\d.]+)"[^>]*\sy="([\d.]+)"[^>]*\swidth="([\d.]+)"[^>]*\sheight="([\d.]+)"/g;
    const rects: Array<{ x: number; y: number; width: number; height: number }> = [];
    
    let match;
    while ((match = rectRegex.exec(svg)) !== null) {
      rects.push({
        x: parseFloat(match[1]),
        y: parseFloat(match[2]),
        width: parseFloat(match[3]),
        height: parseFloat(match[4])
      });
    }
    
    // Find text elements with downstream host names and their y positions
    const textRegex = /<text[^>]*\sx="[\d.]+"[^>]*\sy="([\d.]+)"[^>]*>([^<]+)<\/text>/g;
    const downstreamTexts: Array<{ y: number; text: string }> = [];
    
    let textMatch;
    while ((textMatch = textRegex.exec(svg)) !== null) {
      const text = textMatch[2];
      // Look for downstream labels that include the path separator "·"
      if ((text.includes('auth.example.com') || text.includes('db.example.com')) && text.includes('·')) {
        downstreamTexts.push({
          y: parseFloat(textMatch[1]),
          text: text
        });
      }
    }
    
    // Should have found 2 downstream text labels
    expect(downstreamTexts.length).toBe(2);
    
    if (downstreamTexts.length >= 2) {
      const [text1, text2] = downstreamTexts.sort((a, b) => a.y - b.y);
      
      // Y positions should be different (not overlapping)
      expect(text1.y).not.toBe(text2.y);
      
      // Should have at least 10px gap between them
      const gap = Math.abs(text2.y - text1.y);
      expect(gap).toBeGreaterThanOrEqual(10);
    }
  });

  it('handles single downstream node without errors', () => {
    const events: NetworkEvent[] = [
      {
        id: 'evt-1',
        requestId: 'req-1',
        timestamp: '2024-01-01T00:00:00Z',
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'GET',
        url: 'https://api.example.com/test',
        path: '/test',
        source: 'upstream' as const,
        status: 200,
        durationMs: 50
      },
      {
        id: 'evt-2',
        requestId: 'req-2',
        timestamp: '2024-01-01T00:00:00.010Z',
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'GET',
        url: 'https://downstream.example.com/data',
        path: '/data',
        source: 'upstream' as const,
        status: 200,
        durationMs: 30,
        parentRequestId: 'req-1'
      }
    ];

    const inventory = buildEndpointInventory(events, []);
    
    // Should not throw
    expect(() => {
      generateSystemDiagramSVG(inventory, events);
    }).not.toThrow();
  });

  it('handles no downstream nodes gracefully', () => {
    const events: NetworkEvent[] = [
      {
        id: 'evt-1',
        requestId: 'req-1',
        timestamp: '2024-01-01T00:00:00Z',
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'GET',
        url: 'https://api.example.com/test',
        path: '/test',
        source: 'upstream' as const,
        status: 200,
        durationMs: 50
      }
    ];

    const inventory = buildEndpointInventory(events, []);
    const svg = generateSystemDiagramSVG(inventory, events);
    
    // Should generate valid SVG
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });
});
