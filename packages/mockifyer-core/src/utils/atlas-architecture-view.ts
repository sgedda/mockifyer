/**
 * Enhanced Architecture view components for Atlas documentation.
 * Generates sticky TOC, SVG system diagrams, endpoint inventory with auth badges,
 * code snippets, and comprehensive architectural insights.
 */

import type { NetworkEvent } from './network-event-types';
import type { EndpointAuthInfo } from './atlas-auth-detection';
import type { EndpointInventory, EndpointInventoryItem } from './atlas-endpoint-inventory';
import { generateEndpointSnippets } from './atlas-code-snippets';
import * as dagre from '@dagrejs/dagre';

interface SystemDiagramNode {
  id: string;
  label: string;
  type: 'screen' | 'app' | 'backend' | 'mocked-backend' | 'code-backend' | 'error-backend' | 'downstream' | 'thirdparty';
  x: number;
  y: number;
  width?: number;
}

interface SystemDiagramEdge {
  from: string;
  to: string;
  label: string;
  status: 'mocked' | 'live' | 'error' | 'code-only' | 'unexercised';
  count?: number;
}

/**
 * Generate inline SVG system diagram (offline, no CDN).
 * Shows: screens -> app -> backend hosts -> downstream services
 * Edges colored by status, dashed for code-only/unexercised
 */
export function generateSystemDiagramSVG(
  inventory: EndpointInventory,
  events: readonly NetworkEvent[],
  screens?: string[]
): string {
  const nodes: SystemDiagramNode[] = [];
  
  // Node positioning constants
  const NODE_HEIGHT = 45;
  const CHAR_WIDTH = 7; // ~7px per character
  const NODE_PADDING = 20; // padding on each side
  const TIER_GAP = 120; // Vertical gap between tiers
  const NODE_GAP = 40;  // Horizontal gap between nodes in same tier
  const MARGIN = 50;
  
  // Helper to calculate node width based on text
  const getNodeWidth = (text: string): number => {
    return Math.max(160, text.length * CHAR_WIDTH + NODE_PADDING * 2);
  };
  
  // Build parent-child relationships from events
  // Treat unresolved parentRequestId as Application (parent not in captured events)
  const parentChildMap = new Map<string, Set<string>>(); // parent host -> Set<child hosts>
  const childParentMap = new Map<string, Set<string>>(); // child host -> Set<parent hosts>
  const appChildren = new Set<string>(); // Hosts called directly by Application
  
  events.forEach(ev => {
    if (!ev.host) return;
    
    if (!ev.parentRequestId) {
      // No parent = Application
      appChildren.add(ev.host);
    } else {
      const parentEvent = events.find(e => e.requestId === ev.parentRequestId || e.id === ev.parentRequestId);
      if (!parentEvent) {
        // Unresolved parent = Application
        appChildren.add(ev.host);
      } else if (parentEvent.host && parentEvent.host !== ev.host) {
        // Host → host
        if (!parentChildMap.has(parentEvent.host)) {
          parentChildMap.set(parentEvent.host, new Set());
        }
        parentChildMap.get(parentEvent.host)!.add(ev.host);
        
        if (!childParentMap.has(ev.host)) {
          childParentMap.set(ev.host, new Set());
        }
        childParentMap.get(ev.host)!.add(parentEvent.host);
      }
    }
  });
  
  // Get all hosts
  const allHosts = Array.from(inventory.byHost.keys());
  
  // Use dagre for graph layout
  const g = new dagre.graphlib.Graph();
  g.setGraph({ 
    rankdir: 'TB',
    ranksep: 80,
    nodesep: 30,
    marginx: 40,
    marginy: 40
  });
  g.setDefaultEdgeLabel(() => ({}));
  
  // Calculate host statuses
  const hostStatuses = new Map<string, 'mocked' | 'live' | 'error' | 'code-only'>();
  allHosts.forEach(host => {
    const hostInventory = inventory.byHost.get(host);
    if (!hostInventory) return;
    
    const hasErrors = hostInventory.some(e => e.errorRate && e.errorRate > 0);
    const allMocked = hostInventory.every(e => e.status === 'mocked-only');
    const hasCodeOnly = hostInventory.some(e => e.status === 'code-only');
    const hasObserved = hostInventory.some(e => e.status.startsWith('observed'));
    
    hostStatuses.set(host, 
      hasErrors ? 'error' :
      allMocked ? 'mocked' :
      hasCodeOnly && !hasObserved ? 'code-only' : 
      hasObserved ? 'live' : 'code-only'
    );
  });
  
  // Add nodes to dagre graph with real dimensions
  const appWidth = getNodeWidth('Application');
  g.setNode('app', { 
    label: 'Application',
    width: appWidth,
    height: NODE_HEIGHT
  });
  
  allHosts.forEach(host => {
    const width = getNodeWidth(host);
    g.setNode(`host-${host}`, {
      label: host,
      width,
      height: NODE_HEIGHT
    });
  });
  
  // Add edges to dagre graph
  // App -> hosts
  appChildren.forEach(host => {
    g.setEdge('app', `host-${host}`);
  });
  
  // Host -> host
  parentChildMap.forEach((children, parentHost) => {
    children.forEach(childHost => {
      g.setEdge(`host-${parentHost}`, `host-${childHost}`);
    });
  });
  
  // Run dagre layout
  dagre.layout(g);
  
  // Extract node positions from dagre
  g.nodes().forEach(nodeId => {
    const node = g.node(nodeId);
    const host = nodeId === 'app' ? null : nodeId.replace('host-', '');
    
    nodes.push({
      id: nodeId,
      label: node.label,
      type: nodeId === 'app' ? 'app' :
            hostStatuses.get(host!) === 'mocked' ? 'mocked-backend' :
            hostStatuses.get(host!) === 'code-only' ? 'code-backend' :
            hostStatuses.get(host!) === 'error' ? 'error-backend' :
            'backend',
      x: node.x - node.width / 2, // dagre uses center, we use top-left
      y: node.y - node.height / 2,
      width: node.width
    });
  });
  
  // Calculate diagram bounds
  const graphBounds = g.graph();
  const contentWidth = (graphBounds.width || 800) + MARGIN * 2;
  const diagramHeight = (graphBounds.height || 600) + MARGIN * 2;
  
  // Create edges with dagre waypoints
  const edges: Array<{
    from: string;
    to: string;
    label: string | undefined;
    status: 'live' | 'error' | 'code-only' | 'mocked' | 'unexercised';
    count: number;
    points?: Array<{x: number, y: number}>;
  }> = [];
  
  // Extract edges from dagre with points
  g.edges().forEach(e => {
    const edge = g.edge(e);
    const fromNodeId = e.v;
    const toNodeId = e.w;
    
    // Determine label and status
    let label: string | undefined;
    let status: 'live' | 'error' | 'code-only' | 'mocked' | 'unexercised' = 'live';
    let count = 0;
    
    if (toNodeId.startsWith('host-')) {
      const host = toNodeId.replace('host-', '');
      const hostInventory = inventory.byHost.get(host);
      if (hostInventory) {
        count = hostInventory.length;
        label = `${count} ep`;
      }
      const hostStatus = hostStatuses.get(host);
      if (hostStatus === 'mocked') status = 'mocked';
      else if (hostStatus === 'error') status = 'error';
      else if (hostStatus === 'code-only') status = 'code-only';
    }
    
    edges.push({
      from: fromNodeId,
      to: toNodeId,
      label,
      status,
      count,
      points: edge.points || []
    });
  });
  
  // Generate SVG with legend below
  const legendHeight = 60;
  const totalHeight = diagramHeight + legendHeight;
  
  let svg = `<svg viewBox="0 0 ${contentWidth} ${totalHeight}" xmlns="http://www.w3.org/2000/svg" class="atlas-system-diagram" style="width: 100%; height: auto; min-height: 400px;" preserveAspectRatio="xMidYMid meet">`;
  
  // Define arrow markers (Mock=green, Live=blue, Error=red, Code-only=grey)
  svg += `<defs>
    <marker id="arrow-live" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="#3b82f6" />
    </marker>
    <marker id="arrow-mocked" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="#22c55e" />
    </marker>
    <marker id="arrow-error" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="#ef4444" />
    </marker>
    <marker id="arrow-code-only" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="#9ca3af" />
    </marker>
  </defs>`;
  
  // Draw edges with smooth curves - each edge gets its own curve to avoid long shared segments
  edges.forEach(edge => {
    const fromNode = nodes.find(n => n.id === edge.from);
    const toNode = nodes.find(n => n.id === edge.to);
    if (!fromNode || !toNode) return;
    
    const color = 
      edge.status === 'error' ? '#ef4444' :
      edge.status === 'mocked' ? '#22c55e' :
      edge.status === 'code-only' ? '#9ca3af' :
      '#3b82f6';
    
    const strokeDasharray = (edge.status === 'code-only' || edge.status === 'unexercised') ? '5,5' : 'none';
    const marker = `arrow-${edge.status === 'error' ? 'error' : edge.status === 'mocked' ? 'mocked' : edge.status === 'code-only' ? 'code-only' : 'live'}`;
    
    // Use dagre's edge points for smooth path
    const points = edge.points || [];
    let pathData: string;
    
    if (points.length >= 2) {
      // Draw smooth monotone curve through dagre points
      pathData = `M ${points[0].x} ${points[0].y}`;
      
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const offset = Math.min(dist * 0.4, 40);
        
        // Control points for smooth curve
        const cx1 = p0.x;
        const cy1 = p0.y + offset;
        const cx2 = p1.x;
        const cy2 = p1.y - offset;
        
        pathData += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p1.x} ${p1.y}`;
      }
    } else {
      // Fallback: direct line from node centers
      const x1 = fromNode.x + (fromNode.width || 160) / 2;
      const y1 = fromNode.y + NODE_HEIGHT;
      const x2 = toNode.x + (toNode.width || 160) / 2;
      const y2 = toNode.y;
      
      const verticalDistance = y2 - y1;
      const controlPointOffset = verticalDistance * 0.4;
      
      pathData = `M ${x1} ${y1} C ${x1} ${y1 + controlPointOffset}, ${x2} ${y2 - controlPointOffset}, ${x2} ${y2}`;
    }
    
    svg += `<path d="${pathData}" 
      stroke="${color}" stroke-width="2" stroke-dasharray="${strokeDasharray}" 
      fill="none" marker-end="url(#${marker})" 
      data-from="${edge.from}" data-to="${edge.to}" />`;
    
    // Label at midpoint
    if (edge.label && points.length >= 2) {
      const midIdx = Math.floor(points.length / 2);
      const labelX = points[midIdx].x;
      const labelY = points[midIdx].y;
      const labelWidth = edge.label.length * 7 + 8;
      const labelHeight = 18;
      
      svg += `<rect x="${labelX - labelWidth/2}" y="${labelY - labelHeight/2}" width="${labelWidth}" height="${labelHeight}" rx="3" fill="white" stroke="${color}" stroke-width="1" />`;
      svg += `<text x="${labelX}" y="${labelY + 4}" font-size="12" fill="${color}" text-anchor="middle" font-weight="600">${escapeHtml(edge.label)}</text>`;
    }
  });
  
  // Draw nodes (full width, no truncation, color-coded)
  nodes.forEach(node => {
    const fillColor = 
      node.type === 'screen' ? '#f3f4f6' :
      node.type === 'app' ? '#dbeafe' :
      node.type === 'mocked-backend' ? '#dcfce7' : // Green for mocked
      node.type === 'code-backend' ? '#f3f4f6' : // Light gray for code-only
      node.type === 'error-backend' ? '#fee2e2' : // Red for error (bug #41)
      node.type === 'backend' ? '#dbeafe' : // Blue for live
      node.type === 'downstream' ? '#e0e7ff' :
      '#fef3c7';
    
    const strokeColor = 
      node.type === 'screen' ? '#9ca3af' :
      node.type === 'app' ? '#3b82f6' :
      node.type === 'mocked-backend' ? '#22c55e' : // Green stroke
      node.type === 'code-backend' ? '#9ca3af' : // Gray stroke
      node.type === 'error-backend' ? '#ef4444' : // Red stroke for error (bug #41)
      node.type === 'backend' ? '#3b82f6' : // Blue stroke
      node.type === 'downstream' ? '#6366f1' :
      '#f59e0b';
    
    const nodeWidth = node.width || 160;
    svg += `<rect x="${node.x}" y="${node.y}" width="${nodeWidth}" height="${NODE_HEIGHT}" rx="6" 
      fill="${fillColor}" stroke="${strokeColor}" stroke-width="2" ${node.type === 'code-backend' ? 'stroke-dasharray="5,5"' : ''} data-node-id="${escapeHtml(node.id)}" />`;
    
    // Show full label (no truncation needed now)
    svg += `<text x="${node.x + nodeWidth/2}" y="${node.y + NODE_HEIGHT/2 + 5}" font-size="13" text-anchor="middle" fill="#1f2937" font-weight="500">${escapeHtml(node.label)}</text>`;
  });
  
  // Add legend below diagram
  const legendY = diagramHeight + 20;
  const legendX = 40;
  svg += `<g class="legend">`;
  svg += `<text x="${legendX}" y="${legendY}" font-size="13" font-weight="600" fill="#374151">Legend:</text>`;
  
  // Mocked (green)
  svg += `<rect x="${legendX}" y="${legendY + 12}" width="70" height="24" rx="4" fill="#dcfce7" stroke="#22c55e" stroke-width="2" />`;
  svg += `<text x="${legendX + 35}" y="${legendY + 28}" font-size="11" text-anchor="middle" fill="#1f2937" font-weight="500">Mocked</text>`;
  
  // Live (blue)
  svg += `<rect x="${legendX + 90}" y="${legendY + 12}" width="60" height="24" rx="4" fill="#dbeafe" stroke="#3b82f6" stroke-width="2" />`;
  svg += `<text x="${legendX + 120}" y="${legendY + 28}" font-size="11" text-anchor="middle" fill="#1f2937" font-weight="500">Live</text>`;
  
  // Error (red)
  svg += `<rect x="${legendX + 170}" y="${legendY + 12}" width="60" height="24" rx="4" fill="#fee2e2" stroke="#ef4444" stroke-width="2" />`;
  svg += `<text x="${legendX + 200}" y="${legendY + 28}" font-size="11" text-anchor="middle" fill="#1f2937" font-weight="500">Error</text>`;
  
  // Code-only (gray dashed)
  svg += `<rect x="${legendX + 250}" y="${legendY + 12}" width="85" height="24" rx="4" fill="#f3f4f6" stroke="#9ca3af" stroke-width="2" stroke-dasharray="5,5" />`;
  svg += `<text x="${legendX + 292}" y="${legendY + 28}" font-size="11" text-anchor="middle" fill="#1f2937" font-weight="500">Code-only</text>`;
  
  svg += `</g>`;
  svg += '</svg>';
  
  return svg;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

/**
 * Generate sticky table of contents for Architecture view.
 */
export function generateArchitectureTOC(sections: string[]): string {
  // Map section titles to their actual IDs (some have simplified IDs)
  const sectionIds: Record<string, string> = {
    'Services & Endpoints': 'endpoints',
    'Issues & Gaps': 'issues'
  };
  
  let html = '<nav class="atlas-toc">';
  html += '<div class="atlas-toc-title">Contents</div>';
  html += '<ul>';
  sections.forEach(section => {
    // Use mapped ID if available, otherwise generate from title
    const baseId = sectionIds[section] || section.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    html += `<li><a href="#arch-${baseId}">${escapeHtml(section)}</a></li>`;
  });
  html += '</ul>';
  html += '</nav>';
  return html;
}

/**
 * Generate endpoint inventory section with auth badges and snippets.
 */
export function generateEndpointInventoryHTML(
  inventory: EndpointInventory,
  events: readonly NetworkEvent[],
  authByEndpoint?: Map<string, EndpointAuthInfo>
): string {
  let html = '<div class="atlas-inventory" id="arch-endpoints">';
  html += '<h2>Services & Endpoints</h2>';
  
  for (const [host, endpoints] of inventory.byHost.entries()) {
    html += '<div class="atlas-host-section">';
    html += `<h3>${escapeHtml(host)}</h3>`;
    html += '<div class="atlas-host-stats">';
    html += `<span class="stat">${endpoints.length} endpoints</span>`;
    const totalCalls = endpoints.reduce((sum, e) => sum + e.callCount, 0);
    html += `<span class="stat">${totalCalls} calls</span>`;
    const hasErrors = endpoints.some(e => e.errorRate && e.errorRate > 0);
    if (hasErrors) {
      html += `<span class="stat error">Has errors</span>`;
    }
    html += '</div>';
    
    html += '<table class="atlas-endpoint-table">';
    html += '<thead><tr><th>Method</th><th>Endpoint</th><th>Auth</th><th>Status</th><th>Calls</th><th>Actions</th></tr></thead>';
    html += '<tbody>';
    
    endpoints.forEach((endpoint, index) => {
      const key = `${host}-${index}`;
      const auth = authByEndpoint?.get(`${host}::${endpoint.method}::${endpoint.urlTemplate}`);
      const endpointEvents = events.filter(e => {
        if (!e.url || !e.url.includes(host) || e.method !== endpoint.method) return false;
        try {
          const url = new URL(e.url);
          const normalizedPath = url.pathname.replace(/\/+$/, '').replace(/^\/+/, '/');
          const normalizedTemplate = endpoint.urlTemplate.replace(/\/+$/, '').replace(/^\/+/, '/');
          if (normalizedPath === normalizedTemplate) return true;
          const escapedTemplate = normalizedTemplate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const pattern = escapedTemplate.replace(/\\{[^}]+\\}/g, '[^/]+');
          return normalizedPath.match(new RegExp(`^${pattern}$`));
        } catch {
          return false;
        }
      });
      
      // Get auth label for detail pane
      const authLabel = auth ? (
        auth.scheme === 'bearer' ? 'Bearer' :
        auth.scheme === 'api-key' ? 'API Key' :
        auth.scheme === 'basic' ? 'Basic' :
        auth.scheme === 'cookie' ? 'Cookie' :
        auth.scheme || 'Auth'
      ) : (endpoint.status === 'code-only' || endpoint.status === 'unresolved' ? '—' : 'None');
      
      html += `<tr class="atlas-endpoint-row" data-host="${escapeHtml(host)}" data-method="${escapeHtml(endpoint.method)}" data-template="${escapeHtml(endpoint.urlTemplate)}" data-status="${escapeHtml(endpoint.status)}" data-calls="${endpoint.callCount}" data-auth="${escapeHtml(authLabel)}" style="cursor: pointer;">`;
      html += `<td><span class="method method-${endpoint.method.toLowerCase()}">${endpoint.method}</span></td>`;
      
      // Show file location for unresolved URLs
      if (endpoint.urlTemplate === 'unresolved' && endpoint.codeLocations.length > 0) {
        const loc = endpoint.codeLocations[0];
        const filePath = loc.filePath.replace(/^.*\//, ''); // Show only filename
        html += `<td><em style="color: var(--muted-foreground); font-size: 0.9em;">`;
        html += `Unresolved in ${escapeHtml(filePath)}:${loc.line}`;
        if (loc.component) html += ` (${escapeHtml(loc.component)})`;
        html += `</em></td>`;
      } else {
        html += `<td><code class="url-template">${escapeHtml(endpoint.urlTemplate)}</code></td>`;
      }
      
      // Auth badge
      html += '<td>';
      if (auth) {
        const authLabel = auth.scheme === 'bearer' ? 'Bearer' :
                         auth.scheme === 'api-key' ? 'API Key' :
                         auth.scheme === 'basic' ? 'Basic' :
                         auth.scheme === 'cookie' ? 'Cookie' :
                         auth.scheme || 'Auth';
        html += `<span class="auth-badge auth-${auth.scheme}">${escapeHtml(authLabel)}</span>`;
      } else {
        // Show consistent 'none' badge for all endpoints without detected auth
        html += '<span class="auth-badge auth-none">none</span>';
      }
      html += '</td>';
      
      // Status badge
      html += '<td>';
      const statusClass = endpoint.status.replace(/-/g, '_');
      const statusLabel = endpoint.status === 'observed-with-chain' ? 'Live (Nested)' :
                         endpoint.status === 'observed-no-chain' ? 'Live' :
                         endpoint.status === 'mocked-only' ? 'Mocked' :
                         endpoint.status === 'code-only' ? 'Code Only' :
                         'Unresolved';
      html += `<span class="status-badge status-${statusClass}">${statusLabel}</span>`;
      html += '</td>';
      
      html += `<td>${endpoint.callCount}</td>`;
      
      // Action buttons (copy snippets)
      html += '<td class="atlas-actions">';
      html += `<button type="button" class="btn-snippet" data-endpoint-key="${escapeHtml(key)}" data-host="${escapeHtml(host)}">📋 Snippets</button>`;
      html += '</td>';
      html += '</tr>';
      
      // Hidden snippet panel (shown on click)
      const exampleUrl = `https://${host}${endpoint.urlTemplate}`;
      // Only include auth for observed endpoints (not code-only or unresolved)
      const snippetAuth = (endpoint.status === 'code-only' || endpoint.status === 'unresolved') ? undefined : auth;
      const snippets = generateEndpointSnippets(
        endpoint.method,
        exampleUrl,
        endpointEvents.length > 0 ? [endpointEvents[0]] : undefined,
        snippetAuth
      );
      
      html += `<tr class="snippet-panel" id="snippets-${escapeHtml(key)}" style="display:none">`;
      html += '<td colspan="6">';
      html += '<div class="snippet-tabs">';
      html += `<button type="button" class="snippet-tab active" data-lang="curl">cURL</button>`;
      html += `<button type="button" class="snippet-tab" data-lang="fetch">fetch</button>`;
      html += `<button type="button" class="snippet-tab" data-lang="axios">axios</button>`;
      html += '</div>';
      html += `<pre class="snippet-code snippet-curl active"><code>${escapeHtml(snippets.curl)}</code></pre>`;
      html += `<pre class="snippet-code snippet-fetch"><code>${escapeHtml(snippets.fetch)}</code></pre>`;
      html += `<pre class="snippet-code snippet-axios"><code>${escapeHtml(snippets.axios)}</code></pre>`;
      html += '<button type="button" class="btn-copy-snippet">Copy</button>';
      html += '</td>';
      html += '</tr>';
    });
    
    html += '</tbody></table>';
    html += '</div>';
  }
  
  html += '</div>';
  return html;
}

/**
 * Generate key flows section showing downstream depth.
 */
export function generateKeyFlowsHTML(
  events: readonly NetworkEvent[],
  maxFlows: number = 5
): string {
  // Group by root parent (no parentRequestId)
  const rootEvents = events.filter(e => !e.parentRequestId);
  
  // Build flow trees
  const flows: Array<{ root: NetworkEvent; depth: number; count: number; orphaned: boolean }> = [];
  
  rootEvents.forEach(root => {
    let depth = 1;
    let count = 1;
    
    // Find all children recursively (check both id and requestId)
    const findChildren = (parentId: string, currentDepth: number) => {
      const children = events.filter(e => e.parentRequestId === parentId);
      if (children.length > 0) {
        depth = Math.max(depth, currentDepth + 1);
        count += children.length;
        children.forEach(child => {
          // Use requestId if available, fall back to id
          const childId = (child as any).requestId || child.id;
          if (childId) findChildren(childId, currentDepth + 1);
        });
      }
    };
    
    // Use requestId if available, fall back to id
    const rootId = (root as any).requestId || root.id;
    if (rootId) findChildren(rootId, 1);
    
    if (depth > 1) {
      flows.push({ root, depth, count, orphaned: false });
    }
  });
  
  // If no captured roots, look for orphaned chains (events with children but no root)
  if (flows.length === 0) {
    const childSet = new Set<string>();
    events.forEach(e => {
      if (e.parentRequestId) childSet.add(e.parentRequestId);
    });
    
    // Find earliest events that have children (potential chain heads)
    const chainHeads = events.filter(e => {
      const eventId = (e as any).requestId || e.id;
      return eventId && childSet.has(eventId);
    });
    
    chainHeads.forEach(head => {
      let depth = 1;
      let count = 1;
      
      const findChildren = (parentId: string, currentDepth: number) => {
        const children = events.filter(e => e.parentRequestId === parentId);
        if (children.length > 0) {
          depth = Math.max(depth, currentDepth + 1);
          count += children.length;
          children.forEach(child => {
            const childId = (child as any).requestId || child.id;
            if (childId) findChildren(childId, currentDepth + 1);
          });
        }
      };
      
      const headId = (head as any).requestId || head.id;
      if (headId) findChildren(headId, 1);
      
      if (depth > 1) {
        flows.push({ root: head, depth, count, orphaned: true });
      }
    });
  }
  
  // Sort by depth descending
  flows.sort((a, b) => b.depth - a.depth);
  
  let html = '<div class="atlas-key-flows" id="arch-key-flows">';
  html += '<h2>Key Flows</h2>';
  
  if (flows.length === 0) {
    html += '<p class="empty">No nested flows detected. Enable request correlation to track downstream calls.</p>';
  } else {
    html += `<p class="meta">Top ${Math.min(maxFlows, flows.length)} flows by downstream depth:</p>`;
    
    flows.slice(0, maxFlows).forEach((flow, i) => {
      html += '<div class="flow-card">';
      html += `<div class="flow-header">`;
      html += `<strong>Flow ${i + 1}</strong>`;
      if (flow.orphaned) {
        html += `<span class="badge" style="background: #f59e0b; color: white;">root not captured</span>`;
      }
      html += `<span class="badge depth">Depth: ${flow.depth}</span>`;
      html += `<span class="badge count">${flow.count} total hops</span>`;
      html += '</div>';
      
      // Build step list
      const steps: Array<{ event: NetworkEvent; level: number }> = [{ event: flow.root, level: 0 }];
      const buildSteps = (parentId: string, level: number) => {
        const children = events.filter(e => e.parentRequestId === parentId);
        children.forEach(child => {
          steps.push({ event: child, level });
          const childId = (child as any).requestId || child.id;
          if (childId) buildSteps(childId, level + 1);
        });
      };
      const rootId = (flow.root as any).requestId || flow.root.id;
      if (rootId) buildSteps(rootId, 1);
      
      // Collapse repeated identical calls
      const collapsed: Array<{ event: NetworkEvent; level: number; count: number }> = [];
      steps.forEach((step, idx) => {
        const prev = collapsed[collapsed.length - 1];
        const sameCall = prev && 
          prev.event.method === step.event.method &&
          prev.event.url === step.event.url &&
          prev.level === step.level;
        
        if (sameCall) {
          prev.count++;
        } else {
          collapsed.push({ ...step, count: 1 });
        }
      });
      
      // Render steps with indentation
      html += '<div class="flow-steps" style="font-size: 0.9em; margin-top: 0.5rem;">';
      collapsed.forEach((step, idx) => {
        const indent = step.level * 1.5;
        html += `<div style="margin-left: ${indent}rem; margin-top: 0.25rem; display: flex; align-items: center; gap: 0.5rem;">`;
        if (idx > 0) html += `<span style="color: var(--muted-foreground);">→</span>`;
        
        // Truncate long URLs with query strings
        const url = step.event.url || '';
        let displayUrl = url;
        if (url.includes('?') && url.length > 80) {
          const [base, query] = url.split('?');
          displayUrl = base + '?...';
        } else if (url.length > 80) {
          displayUrl = url.substring(0, 77) + '...';
        }
        
        html += `<code style="flex: 1; max-width: 500px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(url)}">${escapeHtml(step.event.method || 'GET')} ${escapeHtml(displayUrl)}</code>`;
        
        if (step.count > 1) {
          html += `<span style="color: var(--muted-foreground); font-weight: 600;">×${step.count}</span>`;
        }
        
        if (step.event.status) {
          const statusColor = step.event.status >= 400 ? '#ef4444' : step.event.status >= 300 ? '#f59e0b' : '#22c55e';
          html += `<span style="color: ${statusColor}; font-weight: 500;">${step.event.status}</span>`;
        }
        if (step.event.durationMs) {
          html += `<span class="meta">${Math.round(step.event.durationMs)}ms</span>`;
        }
        html += '</div>';
      });
      html += '</div>';
      
      html += '</div>';
    });
  }
  
  html += '</div>';
  return html;
}

/**
 * Generate issues & gaps section.
 */
export function generateIssuesHTML(
  inventory: EndpointInventory,
  events: readonly NetworkEvent[]
): string {
  const issues: Array<{ severity: 'error' | 'warning' | 'info'; message: string }> = [];
  
  // Find slow endpoints (>1s average)
  events.forEach(e => {
    if (e.durationMs && e.durationMs > 1000) {
      issues.push({
        severity: 'warning',
        message: `Slow request: ${e.method} ${e.url} took ${Math.round(e.durationMs)}ms`
      });
    }
  });
  
  // Find failing endpoints
  events.forEach(e => {
    if (e.status && e.status >= 400) {
      issues.push({
        severity: 'error',
        message: `Failed request: ${e.method} ${e.url} returned ${e.status}`
      });
    }
  });
  
  // Collect code-only endpoints (never exercised) for grouping
  const neverExercised: Array<{ method: string; host: string; path: string }> = [];
  for (const [host, endpoints] of inventory.byHost.entries()) {
    for (const endpoint of endpoints) {
      if (endpoint.status === 'code-only') {
        neverExercised.push({
          method: endpoint.method,
          host,
          path: endpoint.urlTemplate
        });
      }
    }
  }
  
  let html = '<div class="atlas-issues" id="arch-issues">';
  html += '<h2>Issues & Gaps</h2>';
  
  if (issues.length === 0 && neverExercised.length === 0) {
    html += '<p class="empty">✓ No issues detected</p>';
  } else {
    html += '<ul class="issue-list">';
    
    // Show errors and warnings first
    issues.slice(0, 20).forEach(issue => {
      html += `<li class="issue issue-${issue.severity}">`;
      html += `<span class="issue-icon">${issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️'}</span>`;
      // Truncate long URLs with title for full text
      const message = issue.message.length > 120 
        ? issue.message.substring(0, 117) + '...'
        : issue.message;
      html += `<span class="issue-message" title="${escapeHtml(issue.message)}" style="word-break: break-word; max-width: 100%;">${escapeHtml(message)}</span>`;
      html += '</li>';
    });
    if (issues.length > 20) {
      html += `<li class="meta">+${issues.length - 20} more issues</li>`;
    }
    
    // Group never-exercised endpoints into a collapsible section
    if (neverExercised.length > 0) {
      html += '<li class="issue issue-info">';
      html += '<details style="margin: 0;">';
      html += `<summary style="cursor: pointer; font-weight: 500;">`;
      html += '⚠️ ';
      html += `${neverExercised.length} endpoint${neverExercised.length === 1 ? '' : 's'} found in code but never exercised (click to expand)`;
      html += '</summary>';
      html += '<ul style="margin: 0.5rem 0 0 1.5rem; padding: 0; list-style: none;">';
      neverExercised.forEach(ep => {
        html += '<li style="margin: 0.25rem 0; font-family: monospace; font-size: 0.9em;">';
        html += `<code>${escapeHtml(ep.method)} ${escapeHtml(ep.host)}${escapeHtml(ep.path)}</code>`;
        html += '</li>';
      });
      html += '</ul>';
      html += '</details>';
      html += '</li>';
    }
    
    html += '</ul>';
  }
  
  html += '</div>';
  return html;
}
