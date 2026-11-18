import { generateSystemDiagramSVG } from '../packages/mockifyer-core/src/utils/atlas-architecture-view';
import type { EndpointInventory } from '../packages/mockifyer-core/src/utils/atlas-endpoint-inventory';
import type { NetworkEvent } from '../packages/mockifyer-core/src/utils/network-event-types';

describe('Atlas Architecture View', () => {
  let svg: string;
  let inventory: EndpointInventory;
  let events: NetworkEvent[];

  beforeAll(() => {
    // Create sample inventory with multiple hosts
    inventory = {
      byHost: new Map([
        ['api.example.com', [
          { host: 'api.example.com', method: 'GET', urlTemplate: '/users', status: 'observed-no-chain', observations: [], codeLocations: [], mockExists: false, callCount: 10 },
          { host: 'api.example.com', method: 'GET', urlTemplate: '/posts', status: 'observed-no-chain', observations: [], codeLocations: [], mockExists: false, callCount: 5 },
        ]],
        ['api.other.com', [
          { host: 'api.other.com', method: 'POST', urlTemplate: '/data', status: 'observed-no-chain', observations: [], codeLocations: [], mockExists: false, callCount: 3 },
        ]],
        ['api.third.com', [
          { host: 'api.third.com', method: 'GET', urlTemplate: '/status', status: 'code-only', observations: [], codeLocations: [{ filePath: 'src/api.ts', line: 40 }], mockExists: false, callCount: 0 },
        ]],
        ['api.fourth.com', [
          { host: 'api.fourth.com', method: 'DELETE', urlTemplate: '/items', status: 'mocked-only', observations: [], codeLocations: [], mockExists: true, callCount: 2 },
        ]],
      ]),
      all: [],
      summary: {
        totalEndpoints: 5,
        observedCount: 3,
        mockedOnlyCount: 1,
        codeOnlyCount: 1,
        unresolvedCount: 0,
        hostCoverage: [],
      },
    };

    // Create sample events including nested calls
    events = [
      {
        id: 'evt1',
        requestId: 'req1',
        timestamp: new Date().toISOString(),
        scenario: 'default',
        transport: 'fetch' as const,
        source: 'upstream' as const,
        url: 'http://api.example.com/users',
        method: 'GET',
        status: 200,
        durationMs: 45,
      },
      {
        id: 'evt2',
        requestId: 'req2',
        parentRequestId: 'req1',
        timestamp: new Date().toISOString(),
        scenario: 'default',
        transport: 'fetch' as const,
        source: 'upstream' as const,
        url: 'http://downstream.com/api/info',
        method: 'GET',
        status: 200,
        durationMs: 25,
      },
    ];

    svg = generateSystemDiagramSVG(inventory, events);
  });

  describe('SVG Structure', () => {
    it('should generate valid SVG markup', () => {
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      expect(svg).toContain('viewBox');
      expect(svg).toContain('preserveAspectRatio');
    });

    it('should include atlas-system-diagram class', () => {
      expect(svg).toContain('class="atlas-system-diagram"');
    });

    it('wraps the SVG for mobile full-width scaling with an open control', () => {
      expect(svg).toContain('class="atlas-system-diagram-wrap"');
      expect(svg).toContain('class="atlas-system-diagram-frame"');
      expect(svg).toContain('data-export="open-svg"');
      expect(svg).toContain('Open diagram');
      expect(svg).not.toContain('min-height: 400px');
    });
  });

  describe('Node Structure and Layout', () => {
    interface RectNode {
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }

    function parseNodes(svgString: string): RectNode[] {
      const nodes: RectNode[] = [];
      const rectRegex = /<rect[^>]*data-node-id="([^"]*)"[^>]*>/g;
      let match;

      while ((match = rectRegex.exec(svgString)) !== null) {
        const rectTag = match[0];
        const id = match[1];
        const xMatch = rectTag.match(/x="([^"]*)"/);
        const yMatch = rectTag.match(/y="([^"]*)"/);
        const widthMatch = rectTag.match(/width="([^"]*)"/);
        const heightMatch = rectTag.match(/height="([^"]*)"/);

        if (xMatch && yMatch && widthMatch && heightMatch) {
          nodes.push({
            id,
            x: parseFloat(xMatch[1]),
            y: parseFloat(yMatch[1]),
            width: parseFloat(widthMatch[1]),
            height: parseFloat(heightMatch[1]),
          });
        }
      }

      return nodes;
    }

    function parseViewBox(svgString: string): { width: number; height: number } | null {
      const match = svgString.match(/viewBox="([^"]*)"/);
      if (!match) return null;

      const [, , width, height] = match[1].split(' ').map(Number);
      return { width, height };
    }

    it('should have host count matching inventory plus event-only hosts', () => {
      const nodes = parseNodes(svg);
      const hostNodes = nodes.filter(n => n.id.startsWith('host-'));
      
      // Count unique hosts from both inventory and events
      const allHosts = new Set<string>(inventory.byHost.keys());
      events.forEach(ev => {
        if (ev.url) {
          try {
            const url = new URL(ev.url);
            allHosts.add(url.host);
          } catch {
            // Ignore invalid URLs
          }
        }
      });
      const expectedHostCount = allHosts.size;

      expect(hostNodes.length).toBe(expectedHostCount);
      expect(hostNodes.length).toBeGreaterThan(0);
    });

    it('should have no overlapping node rectangles', () => {
      const nodes = parseNodes(svg);
      const overlaps: Array<{ node1: string; node2: string }> = [];

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];

          // Check if rectangles intersect
          const intersects = !(
            n1.x + n1.width <= n2.x ||
            n1.x >= n2.x + n2.width ||
            n1.y + n1.height <= n2.y ||
            n1.y >= n2.y + n2.height
          );

          if (intersects) {
            overlaps.push({ node1: n1.id, node2: n2.id });
          }
        }
      }

      expect(overlaps).toEqual([]);
    });

    it('should have all nodes within SVG viewBox bounds', () => {
      const nodes = parseNodes(svg);
      const viewBox = parseViewBox(svg);

      expect(viewBox).toBeTruthy();
      expect(nodes.length).toBeGreaterThan(0);

      const violations: Array<{ node: string; issue: string }> = [];

      nodes.forEach(node => {
        if (node.x < 0) {
          violations.push({ node: node.id, issue: 'x < 0' });
        }
        if (node.y < 0) {
          violations.push({ node: node.id, issue: 'y < 0' });
        }
        if (node.x + node.width > viewBox!.width) {
          violations.push({ node: node.id, issue: 'extends beyond right edge' });
        }
        if (node.y + node.height > viewBox!.height) {
          violations.push({ node: node.id, issue: 'extends beyond bottom edge' });
        }
      });

      expect(violations).toEqual([]);
    });

    it('should have data-node-id attributes on all rect nodes', () => {
      const nodes = parseNodes(svg);
      expect(nodes.length).toBeGreaterThan(0);

      nodes.forEach(node => {
        expect(node.id).toBeTruthy();
        expect(node.id.length).toBeGreaterThan(0);
      });
    });

    it('should include Application node', () => {
      const nodes = parseNodes(svg);
      const appNode = nodes.find(n => n.id === 'app');
      expect(appNode).toBeTruthy();
    });

    it('should include all hosts from inventory', () => {
      const nodes = parseNodes(svg);
      const hostNodes = nodes.filter(n => n.id.startsWith('host-'));

      Array.from(inventory.byHost.keys()).forEach(host => {
        const nodeExists = hostNodes.some(n => n.id === `host-${host}`);
        expect(nodeExists).toBe(true);
      });
    });
  });

  describe('Edges', () => {
    it('should have edge paths connecting nodes', () => {
      const pathCount = (svg.match(/<path/g) || []).length;
      expect(pathCount).toBeGreaterThan(0);
    });

    it('should have properly structured path elements with marker-end', () => {
      const pathRegex = /<path[^>]*d="[^"]*"[^>]*marker-end="[^"]*"[^>]*>/g;
      const paths = svg.match(pathRegex) || [];
      expect(paths.length).toBeGreaterThan(0);
    });
  });

  describe('Legend', () => {
    it('should include status legend', () => {
      expect(svg).toContain('Live');
      expect(svg).toContain('Mocked');
      expect(svg).toContain('Code-only');
    });
  });
});
