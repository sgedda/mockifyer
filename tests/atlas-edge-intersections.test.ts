/**
 * Test for edge-node intersection bug (Issue from e2e run 43827277971).
 * Verifies that no edge passes through a node rectangle that isn't its endpoint.
 */

import { generateSystemDiagramSVG } from '../packages/mockifyer-core/src/utils/atlas-architecture-view';
import { buildEndpointInventory } from '../packages/mockifyer-core/src/utils/atlas-endpoint-inventory';
import type { NetworkEvent } from '../packages/mockifyer-core/src/utils/network-event-types';
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
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  points?: Array<{x: number, y: number}>; // Sampled points along the edge path
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
function parsePathData(pathData: string): Array<{x: number, y: number}> {
  const points: Array<{x: number, y: number}> = [];
  
  // Parse path commands
  const commands = pathData.trim().split(/\s+/);
  let i = 0;
  let currentX = 0, currentY = 0;
  
  while (i < commands.length) {
    const cmd = commands[i];
    
    if (cmd === 'M') {
      // Move to
      currentX = parseFloat(commands[i + 1]);
      currentY = parseFloat(commands[i + 2]);
      points.push({ x: currentX, y: currentY });
      i += 3;
    } else if (cmd === 'L') {
      // Line to
      currentX = parseFloat(commands[i + 1]);
      currentY = parseFloat(commands[i + 2]);
      points.push({ x: currentX, y: currentY });
      i += 3;
    } else if (cmd === 'C') {
      // Cubic Bezier curve
      const cx1 = parseFloat(commands[i + 1].replace(',', ''));
      const cy1 = parseFloat(commands[i + 2].replace(',', ''));
      const cx2 = parseFloat(commands[i + 3]);
      const cy2 = parseFloat(commands[i + 4].replace(',', ''));
      const x = parseFloat(commands[i + 5]);
      const y = parseFloat(commands[i + 6]);
      
      // Sample the curve
      const curvePoints = sampleBezierCurve(
        { x: currentX, y: currentY },
        { x: cx1, y: cy1 },
        { x: cx2, y: cy2 },
        { x, y }
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
  
  // Match <path d="..." marker-end="...">
  const pathPattern = /<path[^>]*>/g;
  let match;
  
  while ((match = pathPattern.exec(svg)) !== null) {
    const pathTag = match[0];
    if (!pathTag.includes('marker-end')) continue;
    
    const dMatch = pathTag.match(/\sd="([^"]+)"/);
    if (!dMatch) continue;
    
    const points = parsePathData(dMatch[1]);
    
    if (points.length >= 2) {
      const first = points[0];
      const last = points[points.length - 1];
      
      edges.push({
        from: '',
        to: '',
        x1: first.x,
        y1: first.y,
        x2: last.x,
        y2: last.y,
        points: points // Store all sampled points for intersection checking
      });
    }
  }
  
  return edges;
}

/**
 * Check if a point (x, y) is inside a rectangle.
 */
function pointInRect(px: number, py: number, rect: NodeRect): boolean {
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
    
    edges.forEach((edge, edgeIdx) => {
      const sourceNode = findNodeAtPoint(edge.x1, edge.y1, nodes);
      const targetNode = findNodeAtPoint(edge.x2, edge.y2, nodes);
      
      // Get points to check (from sampled curve/path)
      const pointsToCheck = edge.points || [{ x: edge.x1, y: edge.y1 }, { x: edge.x2, y: edge.y2 }];
      
      // Check if any point on the edge passes through any other node
      nodes.forEach(node => {
        // Skip if this node is the source or target
        if (sourceNode && node.id === sourceNode.id) return;
        if (targetNode && node.id === targetNode.id) return;
        
        // Check each sampled point
        for (const point of pointsToCheck) {
          if (pointInRect(point.x, point.y, node)) {
            intersections.push({
              edge,
              source: sourceNode?.id || 'unknown',
              target: targetNode?.id || 'unknown',
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
    const overlaps: Array<{ edge1: number, edge2: number, overlapCount: number }> = [];
    
    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        const points1 = edges[i].points || [];
        const points2 = edges[j].points || [];
        
        // Count overlapping points (within 2px tolerance)
        let overlapCount = 0;
        for (const p1 of points1) {
          for (const p2 of points2) {
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
    
    // Find edge to frankfurter
    const frankfurterEdge = edges.find(e => {
      const target = findNodeAtPoint(e.x2, e.y2, nodes);
      return target?.id === 'host-api.frankfurter.app';
    });
    
    expect(frankfurterEdge).toBeDefined();
    
    // Verify source is 127.0.0.1:4203
    if (frankfurterEdge) {
      const source = findNodeAtPoint(frankfurterEdge.x1, frankfurterEdge.y1, nodes);
      expect(source?.id).toBe('host-127.0.0.1:4203');
    }
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
    
    // Extract actual edges from SVG
    const actualPairs = new Set<string>();
    edges.forEach(edge => {
      const source = findNodeAtPoint(edge.x1, edge.y1, nodes);
      const target = findNodeAtPoint(edge.x2, edge.y2, nodes);
      
      if (source && target) {
        // Extract host from node ID (e.g., 'host-127.0.0.1:4203' -> '127.0.0.1:4203')
        const sourceHost = source.id === 'app' ? 'app' : source.id.replace('host-', '');
        const targetHost = target.id.replace('host-', '');
        
        if (sourceHost !== 'app') { // Only count host→host edges
          actualPairs.add(`${sourceHost}→${targetHost}`);
        }
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
});
