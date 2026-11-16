/**
 * Test for edge-node intersection bug (Issue from e2e run 43827277971).
 * Verifies that no edge passes through a node rectangle that isn't its endpoint.
 */

import { generateSystemDiagramSVG } from '../packages/mockifyer-core/src/utils/atlas-architecture-view';
import { buildEndpointInventory } from '../packages/mockifyer-core/src/utils/atlas-endpoint-inventory';
import type { NetworkEvent } from '../packages/mockifyer-core/src/utils/network-event-types';
import type { ScannedEndpoint } from '../packages/mockifyer-core/src/utils/atlas-code-scanner';
import * as fs from 'fs';
import * as path from 'path';

interface NodeRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface EdgeLine {
  from: string; // data-from attribute
  to: string;   // data-to attribute
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  points: Array<{x: number, y: number}>; // Sampled points along the edge path
}

/**
 * Parse SVG and extract node rectangles with their data-node-id attributes.
 */
function extractNodeRects(svg: string): NodeRect[] {
  const nodes: NodeRect[] = [];
  
  // Match <rect ...data-node-id="xxx"...>
  const rectPattern = /<rect[^>]*>/g;
  
  let match;
  while ((match = rectPattern.exec(svg)) !== null) {
    const rectTag = match[0];
    
    // Extract data-node-id
    const idMatch = rectTag.match(/data-node-id="([^"]+)"/);
    if (!idMatch) continue; // Skip rects without data-node-id
    
    // Extract x, y, width, height
    const xMatch = rectTag.match(/\sx="([^"]+)"/);
    const yMatch = rectTag.match(/\sy="([^"]+)"/);
    const widthMatch = rectTag.match(/\swidth="([^"]+)"/);
    const heightMatch = rectTag.match(/\sheight="([^"]+)"/);
    
    if (xMatch && yMatch && widthMatch && heightMatch) {
      nodes.push({
        id: idMatch[1],
        x: parseFloat(xMatch[1]),
        y: parseFloat(yMatch[1]),
        width: parseFloat(widthMatch[1]),
        height: parseFloat(heightMatch[1])
      });
    }
  }
  
  return nodes;
}

/**
 * Sample points along a cubic Bezier curve.
 * B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
 */
function sampleBezierCurve(
  p0: {x: number, y: number},
  p1: {x: number, y: number},
  p2: {x: number, y: number},
  p3: {x: number, y: number},
  samples: number = 50
): Array<{x: number, y: number}> {
  const points: Array<{x: number, y: number}> = [];
  
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const t1 = 1 - t;
    
    const x = t1*t1*t1 * p0.x + 3*t1*t1*t * p1.x + 3*t1*t*t * p2.x + t*t*t * p3.x;
    const y = t1*t1*t1 * p0.y + 3*t1*t1*t * p1.y + 3*t1*t*t * p2.y + t*t*t * p3.y;
    
    points.push({ x, y });
  }
  
  return points;
}

/**
 * Parse SVG path data (supports M...L... and M...C... commands).
 * Returns sampled points along the path for intersection checking.
 */
function parsePathData(pathData: string, samples: number = 50): Array<{x: number, y: number}> {
  const points: Array<{x: number, y: number}> = [];
  
  // Parse path commands - handle commas better
  const normalized = pathData.replace(/,/g, ' ').replace(/([MLCmlc])/g, ' $1 ').trim();
  const tokens = normalized.split(/\s+/).filter(t => t.length > 0);
  
  let i = 0;
  let currentX = 0, currentY = 0;
  
  while (i < tokens.length) {
    const cmd = tokens[i];
    
    if (cmd === 'M' || cmd === 'm') {
      currentX = parseFloat(tokens[i + 1]);
      currentY = parseFloat(tokens[i + 2]);
      points.push({ x: currentX, y: currentY });
      i += 3;
    } else if (cmd === 'L' || cmd === 'l') {
      currentX = parseFloat(tokens[i + 1]);
      currentY = parseFloat(tokens[i + 2]);
      points.push({ x: currentX, y: currentY });
      i += 3;
    } else if (cmd === 'C' || cmd === 'c') {
      const cx1 = parseFloat(tokens[i + 1]);
      const cy1 = parseFloat(tokens[i + 2]);
      const cx2 = parseFloat(tokens[i + 3]);
      const cy2 = parseFloat(tokens[i + 4]);
      const x = parseFloat(tokens[i + 5]);
      const y = parseFloat(tokens[i + 6]);
      
      // Sample the cubic Bezier curve
      const curvePoints = sampleBezierCurve(
        { x: currentX, y: currentY },
        { x: cx1, y: cy1 },
        { x: cx2, y: cy2 },
        { x, y },
        samples
      );
      
      points.push(...curvePoints);
      currentX = x;
      currentY = y;
      i += 7;
    } else {
      i++;
    }
  }
  
  return points;
}

/**
 * Parse SVG and extract edge paths (supports <path> elements with curves).
 */
function extractEdgeLines(svg: string): EdgeLine[] {
  const edges: EdgeLine[] = [];
  
  // Match <path ...> with marker-end
  const pathPattern = /<path[^>]*marker-end[^>]*>/g;
  let match;
  
  while ((match = pathPattern.exec(svg)) !== null) {
    const pathTag = match[0];
    
    const dMatch = pathTag.match(/\sd="([^"]+)"/);
    const fromMatch = pathTag.match(/\sdata-from="([^"]+)"/);
    const toMatch = pathTag.match(/\sdata-to="([^"]+)"/);
    
    if (!dMatch || !fromMatch || !toMatch) continue;
    
    const points = parsePathData(dMatch[1], 100); // More samples for accurate intersection checking
    
    if (points.length >= 2) {
      const first = points[0];
      const last = points[points.length - 1];
      
      edges.push({
        from: fromMatch[1],
        to: toMatch[1],
        x1: first.x,
        y1: first.y,
        x2: last.x,
        y2: last.y,
        points
      });
    }
  }
  
  return edges;
}

/**
 * Check if a point (x, y) is inside a rectangle.
 */
function pointInRect(px: number, py: number, rect: {x: number, y: number, width: number, height: number}): boolean {
  return px >= rect.x && px <= rect.x + rect.width &&
         py >= rect.y && py <= rect.y + rect.height;
}

/**
 * Sample points along a line segment and check if any pass through a rect.
 */
function lineIntersectsRect(line: EdgeLine, rect: NodeRect, samples = 20): boolean {
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = line.x1 + t * (line.x2 - line.x1);
    const y = line.y1 + t * (line.y2 - line.y1);
    
    if (pointInRect(x, y, rect)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Find which node a point belongs to (for determining edge endpoints).
 */
function findNodeAtPoint(x: number, y: number, nodes: NodeRect[], tolerance = 5): NodeRect | null {
  for (const node of nodes) {
    // Check if point is near the top or bottom edge of the node (edge connection points)
    const centerX = node.x + node.width / 2;
    const topY = node.y;
    const bottomY = node.y + node.height;
    
    if (Math.abs(x - centerX) < tolerance) {
      if (Math.abs(y - topY) < tolerance || Math.abs(y - bottomY) < tolerance) {
        return node;
      }
    }
  }
  
  return null;
}

describe('Atlas Edge-Node Intersections (Real Data)', () => {
  let fixtureEvents: NetworkEvent[];
  
  beforeAll(() => {
    const fixturePath = path.join(__dirname, 'fixtures', 'atlas-real-trimmed.json');
    fixtureEvents = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  });
  
  it('should not have edges passing through non-endpoint nodes', () => {
    const inventory = buildEndpointInventory(fixtureEvents, []);
    const svg = generateSystemDiagramSVG(inventory, fixtureEvents);
    
    const nodes = extractNodeRects(svg);
    const edges = extractEdgeLines(svg);
    
    expect(nodes.length).toBeGreaterThan(0);
    expect(edges.length).toBeGreaterThan(0);
    
    // For each edge, determine its source and target nodes
    const intersections: Array<{
      edge: EdgeLine;
      source: string;
      target: string;
      intersectedNode: string;
      point: { x: number; y: number };
    }> = [];
    
    edges.forEach((edge) => {
      // Use data attributes for endpoint IDs (more reliable than geometry)
      const fromId = edge.from;
      const toId = edge.to;
      
      // Check if any point on the edge passes through any OTHER node (with 2px inset)
      nodes.forEach(node => {
        // Skip if this node is an endpoint of this edge
        if (node.id === fromId || node.id === toId) return;
        
        // Create inset rect (2px inset from all sides)
        const inset = 2;
        const insetRect = {
          x: node.x + inset,
          y: node.y + inset,
          width: node.width - 2 * inset,
          height: node.height - 2 * inset
        };
        
        // Check each sampled point along the edge
        for (const point of edge.points) {
          if (pointInRect(point.x, point.y, insetRect)) {
            intersections.push({
              edge,
              source: fromId,
              target: toId,
              intersectedNode: node.id,
              point: { x: point.x, y: point.y }
            });
            return; // Stop checking this node once we found an intersection
          }
        }
      });
    });
    
    // Report intersections with details
    const summary = intersections.map(i => 
      `${i.source} → ${i.target} passes through ${i.intersectedNode}`
    );
    
    if (intersections.length > 0) {
      console.log(`\nIntersections detected (${intersections.length} total):`);
      summary.forEach(s => console.log(`  ${s}`));
    }
    
    expect(intersections).toEqual([]);
  });
  
  it('should route edge from app to api.frankfurter.app without crossing api.open-meteo.com', () => {
    const inventory = buildEndpointInventory(fixtureEvents, []);
    const svg = generateSystemDiagramSVG(inventory, fixtureEvents);
    
    const nodes = extractNodeRects(svg);
    const edges = extractEdgeLines(svg);
    
    const frankfurterNode = nodes.find(n => n.id === 'host-api.frankfurter.app');
    const openMeteoNode = nodes.find(n => n.id === 'host-api.open-meteo.com');
    const appNode = nodes.find(n => n.id === 'app');
    
    if (!frankfurterNode || !openMeteoNode || !appNode) {
      // Skip if these specific hosts aren't in the fixture
      return;
    }
    
    // Find edge from app to frankfurter
    const frankfurterEdge = edges.find(e => {
      const sourceNode = findNodeAtPoint(e.x1, e.y1, nodes);
      const targetNode = findNodeAtPoint(e.x2, e.y2, nodes);
      return sourceNode?.id === 'app' && targetNode?.id === 'host-api.frankfurter.app';
    });
    
    if (frankfurterEdge) {
      const crossesOpenMeteo = lineIntersectsRect(frankfurterEdge, openMeteoNode);
      expect(crossesOpenMeteo).toBe(false);
    }
  });
  
  it('should have no two edges overlapping for more than 10 sampled points', () => {
    const inventory = buildEndpointInventory(fixtureEvents, []);
    const svg = generateSystemDiagramSVG(inventory, fixtureEvents);
    
    const edges = extractEdgeLines(svg);
    
    // Check pairwise edge overlaps
    // Ignore first and last 20px where edges legitimately converge on shared nodes
    const overlaps: Array<{ edge1: number, edge2: number, overlapCount: number }> = [];
    
    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        const points1 = edges[i].points || [];
        const points2 = edges[j].points || [];
        
        // Filter out points within 20px of edge endpoints
        const filterPoints = (points: Array<{x: number, y: number}>, edge: typeof edges[0]) => {
          if (points.length < 2) return points;
          const first = points[0];
          const last = points[points.length - 1];
          return points.filter(p => {
            const distToStart = Math.sqrt((p.x - first.x)**2 + (p.y - first.y)**2);
            const distToEnd = Math.sqrt((p.x - last.x)**2 + (p.y - last.y)**2);
            return distToStart > 20 && distToEnd > 20;
          });
        };
        
        const filtered1 = filterPoints(points1, edges[i]);
        const filtered2 = filterPoints(points2, edges[j]);
        
        // Count overlapping points (within 2px tolerance)
        let overlapCount = 0;
        for (const p1 of filtered1) {
          for (const p2 of filtered2) {
            const dist = Math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2);
            if (dist < 2) {
              overlapCount++;
              break; // Count each p1 only once
            }
          }
        }
        
        if (overlapCount > 10) {
          overlaps.push({ edge1: i, edge2: j, overlapCount });
        }
      }
    }
    
    if (overlaps.length > 0) {
      console.log('\nEdge overlaps detected:');
      overlaps.forEach(({ edge1, edge2, overlapCount }) => {
        console.log(`  ${edges[edge1].from} → ${edges[edge1].to} overlaps ${edges[edge2].from} → ${edges[edge2].to}: ${overlapCount} points`);
      });
    }
    
    expect(overlaps.length).toBe(0);
  });
  
  it('should have frankfurter edge coming from host-127.0.0.1:4203', () => {
    const inventory = buildEndpointInventory(fixtureEvents, []);
    const svg = generateSystemDiagramSVG(inventory, fixtureEvents);
    
    const nodes = extractNodeRects(svg);
    const edges = extractEdgeLines(svg);
    
    // Find frankfurter node
    const frankfurterNode = nodes.find(n => n.id === 'host-api.frankfurter.app');
    if (!frankfurterNode) return; // Skip if not in fixture
    
    // Find edge from 4203 to frankfurter using data attributes
    const frankfurterEdgeFrom4203 = edges.find(e => 
      e.from === 'host-127.0.0.1:4203' && e.to === 'host-api.frankfurter.app'
    );
    
    expect(frankfurterEdgeFrom4203).toBeDefined();
  });
  
  it('should have 127.0.0.1:4201 with edge from Application', () => {
    const inventory = buildEndpointInventory(fixtureEvents, []);
    const svg = generateSystemDiagramSVG(inventory, fixtureEvents);
    
    const nodes = extractNodeRects(svg);
    const edges = extractEdgeLines(svg);
    
    // Find 4201 node
    const node4201 = nodes.find(n => n.id === 'host-127.0.0.1:4201');
    expect(node4201).toBeDefined();
    
    // Find edge from app to 4201 using data attributes
    const edge4201 = edges.find(e => 
      e.from === 'app' && e.to === 'host-127.0.0.1:4201'
    );
    
    expect(edge4201).toBeDefined();
  });
  
  it('should have exactly one edge for every distinct parent-host→child-host pair in fixture', () => {
    const inventory = buildEndpointInventory(fixtureEvents, []);
    const svg = generateSystemDiagramSVG(inventory, fixtureEvents);
    
    const nodes = extractNodeRects(svg);
    const edges = extractEdgeLines(svg);
    
    // Build expected parent-child pairs from fixture
    const expectedPairs = new Set<string>();
    fixtureEvents.forEach(ev => {
      if (ev.parentRequestId && ev.host) {
        const parentEvent = fixtureEvents.find(e => 
          e.requestId === ev.parentRequestId || (e as any).id === ev.parentRequestId
        );
        if (parentEvent && parentEvent.host && parentEvent.host !== ev.host) {
          expectedPairs.add(`${parentEvent.host}→${ev.host}`);
        }
      }
    });
    
    // Extract actual edges from SVG using data attributes
    const actualPairs = new Set<string>();
    edges.forEach(edge => {
      // Use data-from and data-to attributes
      const fromId = edge.from;
      const toId = edge.to;
      
      // Extract host from node ID (e.g., 'host-127.0.0.1:4203' -> '127.0.0.1:4203')
      const sourceHost = fromId === 'app' ? 'app' : fromId.replace('host-', '');
      const targetHost = toId.replace('host-', '');
      
      if (sourceHost !== 'app') { // Only count host→host edges
        actualPairs.add(`${sourceHost}→${targetHost}`);
      }
    });
    
    // Every expected pair should have exactly one edge
    const missing: string[] = [];
    expectedPairs.forEach(pair => {
      if (!actualPairs.has(pair)) {
        missing.push(pair);
      }
    });
    
    expect(missing).toEqual([]);
    expect(actualPairs.size).toBe(expectedPairs.size);
  });
  
  it('should fit legend inside viewBox on narrow graphs (1-2 hosts)', () => {
    // Create minimal inventory with 1-2 hosts
    const minimalEvents: NetworkEvent[] = [
      {
        id: 'evt1',
        timestamp: new Date().toISOString(),
        scenario: 'test',
        source: 'upstream' as const,
        transport: 'fetch' as const,
        url: 'https://api.example.com/test',
        host: 'api.example.com',
        method: 'GET',
        path: '/test',
        status: 200
      }
    ];
    
    const inventory = buildEndpointInventory(minimalEvents, []);
    const svg = generateSystemDiagramSVG(inventory, minimalEvents);
    
    // Extract viewBox (format: "minX minY width height")
    const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
    expect(viewBoxMatch).toBeTruthy();
    const [, , width] = viewBoxMatch![1].split(' ').map(Number);
    
    // Legend spans from x=40 to approximately x=550 (legendX + 410 + text width)
    // The "Caller not recorded" text at x=410 is ~20 chars * 7px = ~140px wide
    const legendRightEdge = 40 + 410 + 20 * 7;
    
    expect(width).toBeGreaterThanOrEqual(legendRightEdge);
  });
  
  it('should give parentless inventory hosts an Application edge', () => {
    // Create inventory with a code-only host that has no events
    const events: NetworkEvent[] = [];
    
    const codeOnlyEndpoints: ScannedEndpoint[] = [
      {
        method: 'GET',
        urlTemplate: 'https://api.phantom.com/never-called',
        resolvedUrl: 'https://api.phantom.com/never-called',
        filePath: 'test.ts',
        line: 1,
        column: 1,
        callType: 'fetch'
      }
    ];
    
    const inventory = buildEndpointInventory(events, codeOnlyEndpoints);
    const svg = generateSystemDiagramSVG(inventory, events);
    
    const nodes = extractNodeRects(svg);
    const edges = extractEdgeLines(svg);
    
    // Find the phantom host node
    const phantomNode = nodes.find(n => n.id === 'host-api.phantom.com');
    expect(phantomNode).toBeDefined();
    
    // Find edge from app to phantom host
    const phantomEdge = edges.find(e => 
      e.from === 'app' && e.to === 'host-api.phantom.com'
    );
    expect(phantomEdge).toBeDefined();
    
    // The edge should be marked as inferred (data-inferred="true")
    const pathMatch = svg.match(/<path[^>]*data-from="app"[^>]*data-to="host-api\.phantom\.com"[^>]*>/);
    expect(pathMatch).toBeTruthy();
    expect(pathMatch![0]).toContain('data-inferred="true"');
  });
  
  it('should extract host from url when host field is missing and detect parent-child links', () => {
    // Events without host field but with url field (host should be parsed from url)
    const events: NetworkEvent[] = [
      {
        id: 'parent-evt',
        requestId: 'req-parent',
        timestamp: new Date().toISOString(),
        scenario: 'test',
        source: 'upstream' as const,
        transport: 'fetch' as const,
        url: 'https://api.parent.com/data',
        method: 'GET',
        path: '/data',
        status: 200
        // NO host field - should be parsed from url
      },
      {
        id: 'child-evt',
        requestId: 'req-child',
        parentRequestId: 'req-parent', // Child of parent-evt
        timestamp: new Date().toISOString(),
        scenario: 'test',
        source: 'upstream' as const,
        transport: 'fetch' as const,
        url: 'https://api.child.com/nested',
        method: 'GET',
        path: '/nested',
        status: 200
        // NO host field - should be parsed from url
      }
    ];
    
    const inventory = buildEndpointInventory(events, []);
    const svg = generateSystemDiagramSVG(inventory, events);
    
    const nodes = extractNodeRects(svg);
    const edges = extractEdgeLines(svg);
    
    // Verify both hosts are in the diagram
    const parentNode = nodes.find(n => n.id === 'host-api.parent.com');
    const childNode = nodes.find(n => n.id === 'host-api.child.com');
    expect(parentNode).toBeDefined();
    expect(childNode).toBeDefined();
    
    // Verify Application -> parent edge exists
    const appToParentEdge = edges.find(e => 
      e.from === 'app' && e.to === 'host-api.parent.com'
    );
    expect(appToParentEdge).toBeDefined();
    
    // Verify parent -> child edge exists (not Application -> child)
    const parentToChildEdge = edges.find(e => 
      e.from === 'host-api.parent.com' && e.to === 'host-api.child.com'
    );
    expect(parentToChildEdge).toBeDefined();
    
    // Verify child does NOT have a direct Application edge
    const appToChildEdge = edges.find(e => 
      e.from === 'app' && e.to === 'host-api.child.com'
    );
    expect(appToChildEdge).toBeUndefined();
  });
});
