/**
 * Enhanced Architecture view components for Atlas documentation.
 * Generates sticky TOC, SVG system diagrams, endpoint inventory with auth badges,
 * code snippets, and comprehensive architectural insights.
 */

import type { NetworkEvent } from './network-event-types';
import type { EndpointAuthInfo } from './atlas-auth-detection';
import type { EndpointInventory, EndpointInventoryItem } from './atlas-endpoint-inventory';
import { generateEndpointSnippets } from './atlas-code-snippets';

interface SystemDiagramNode {
  id: string;
  label: string;
  type: 'screen' | 'app' | 'backend' | 'mocked-backend' | 'code-backend' | 'downstream' | 'thirdparty';
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
  const edges: SystemDiagramEdge[] = [];
  
  // Node positioning (larger for readability)
  const LAYER_GAP = 120;
  const NODE_GAP = 200;
  const NODE_HEIGHT = 45;
  const CHAR_WIDTH = 7; // ~7px per character
  const NODE_PADDING = 20; // padding on each side
  
  // Helper to calculate node width based on text
  const getNodeWidth = (text: string): number => {
    return Math.max(160, text.length * CHAR_WIDTH + NODE_PADDING * 2);
  };
  
  // **GRID LAYOUT ALGORITHM**
  // Row 0: Application (centered)
  // Rows 1..n: All hosts in grid (up to 4 columns), sorted by call count
  // Downstream: Separate band below, under parent host column
  
  const GRID_COLS = 4;
  const ROW_HEIGHT = 80;
  const COL_GAP = 20;
  const ROW_GAP = 100;
  const MARGIN = 50;
  
  // Get all hosts with call counts
  const allHosts = Array.from(inventory.byHost.keys());
  const hostCallCounts = new Map<string, number>();
  allHosts.forEach(host => {
    const hostInventory = inventory.byHost.get(host);
    if (hostInventory) {
      const totalCalls = hostInventory.reduce((sum, e) => sum + (e.callCount || 0), 0);
      hostCallCounts.set(host, totalCalls);
    }
  });
  
  // Sort hosts by call count descending
  const sortedHosts = allHosts.sort((a, b) => 
    (hostCallCounts.get(b) || 0) - (hostCallCounts.get(a) || 0)
  );
  
  // Calculate host statuses
  const hostStatuses = new Map<string, 'mocked' | 'live' | 'error' | 'code-only'>();
  sortedHosts.forEach(host => {
    const hostInventory = inventory.byHost.get(host);
    if (!hostInventory) return;
    
    const hasErrors = hostInventory.some(e => e.errorRate && e.errorRate > 0);
    const allMocked = hostInventory.every(e => e.status === 'mocked-only');
    const hasCodeOnly = hostInventory.some(e => e.status === 'code-only');
    const hasObserved = hostInventory.some(e => e.status.startsWith('observed'));
    
    hostStatuses.set(host, 
      hasErrors ? 'error' :
      allMocked ? 'mocked' :
      hasCodeOnly ? 'code-only' :
      hasObserved ? 'live' : 'live'
    );
  });
  
  // Calculate cell width (widest label + padding)
  const maxHostWidth = Math.max(
    160,
    ...sortedHosts.map(h => getNodeWidth(h))
  );
  const cellWidth = maxHostWidth;
  
  // Calculate grid dimensions
  const cols = Math.min(sortedHosts.length, GRID_COLS);
  const rows = Math.ceil(sortedHosts.length / cols);
  const gridWidth = cols * cellWidth + (cols - 1) * COL_GAP;
  
  // Row 0: Application (centered in grid)
  let y = MARGIN;
  const appX = MARGIN + gridWidth / 2 - cellWidth / 2;
  nodes.push({
    id: 'app',
    label: 'Application',
    type: 'app',
    x: appX,
    y,
    width: cellWidth
  });
  y += ROW_GAP;
  
  // Rows 1..n: Host grid
  const hostPositions = new Map<string, { x: number; y: number; col: number }>();
  sortedHosts.forEach((host, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    
    // Center each row
    const rowCols = Math.min(cols, sortedHosts.length - row * cols);
    const rowWidth = rowCols * cellWidth + (rowCols - 1) * COL_GAP;
    const rowStartX = MARGIN + (gridWidth - rowWidth) / 2;
    
    const x = rowStartX + col * (cellWidth + COL_GAP);
    const nodeY = y + row * ROW_HEIGHT;
    
    hostPositions.set(host, { x, y: nodeY, col });
    
    nodes.push({
      id: `host-${host}`,
      label: host,
      type: hostStatuses.get(host) === 'mocked' ? 'mocked-backend' : 
            hostStatuses.get(host) === 'code-only' ? 'code-backend' :
            'backend',
      x,
      y: nodeY,
      width: cellWidth
    });
  });
  
  y += rows * ROW_HEIGHT + ROW_GAP;
  
  // Downstream: Map each to parent host, position under parent column
  const downstreamHostPaths = new Map<string, { path: string; parentHost: string }>();
  events.forEach(ev => {
    if (ev.parentRequestId && ev.url) {
      try {
        const url = new URL(ev.url);
        const downHost = url.hostname;
        const path = decodeURIComponent(url.pathname);
        
        // Find parent host from the parent request
        const parentEvent = events.find(e => e.requestId === ev.parentRequestId);
        if (parentEvent && parentEvent.url) {
          const parentUrl = new URL(parentEvent.url);
          const parentHost = parentUrl.hostname;
          
          if (!downstreamHostPaths.has(downHost) && sortedHosts.includes(parentHost)) {
            downstreamHostPaths.set(downHost, { path, parentHost });
          }
        }
      } catch {}
    }
  });
  
  downstreamHostPaths.forEach((info, downHost) => {
    const parentPos = hostPositions.get(info.parentHost);
    if (!parentPos) return;
    
    const label = `${downHost} · ${info.path}`;
    nodes.push({
      id: `downstream-${downHost}`,
      label,
      type: 'downstream',
      x: parentPos.x,
      y,
      width: cellWidth
    });
  });
  
  if (downstreamHostPaths.size > 0) {
    y += ROW_HEIGHT;
  }
  
  const contentWidth = gridWidth + MARGIN * 2;
  const maxX = contentWidth;
  
  // Create edges
  // App -> Hosts
  sortedHosts.forEach(host => {
    const hostInventory = inventory.byHost.get(host);
    if (!hostInventory) return;
    
    const status = hostStatuses.get(host) || 'live';
    
    edges.push({
      from: 'app',
      to: `host-${host}`,
      label: `${hostInventory.length} ep`,
      status: status as any,
      count: hostInventory.length
    });
  });
  
  // Hosts -> Downstream (each to its parent only)
  downstreamHostPaths.forEach((info, downHost) => {
    edges.push({
      from: `host-${info.parentHost}`,
      to: `downstream-${downHost}`,
      label: 'nested',
      status: 'live'
    });
  });
  
  // Generate SVG with legend below
  const diagramHeight = y + 40;
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
  
  // Draw edges
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
    
    const x1 = fromNode.x + (fromNode.width || 160) / 2;
    const y1 = fromNode.y + NODE_HEIGHT;
    const x2 = toNode.x + (toNode.width || 160) / 2;
    const y2 = toNode.y;
    
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
      stroke="${color}" stroke-width="2" stroke-dasharray="${strokeDasharray}" marker-end="url(#${marker})" />`;
    
    // Label at midpoint with background rect
    if (edge.label) {
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const labelWidth = edge.label.length * 7 + 8;
      const labelHeight = 18;
      
      // Background rect for label
      svg += `<rect x="${midX - labelWidth/2}" y="${midY - labelHeight/2}" width="${labelWidth}" height="${labelHeight}" rx="3" fill="white" stroke="${color}" stroke-width="1" />`;
      svg += `<text x="${midX}" y="${midY + 4}" font-size="12" fill="${color}" text-anchor="middle" font-weight="600">${escapeHtml(edge.label)}</text>`;
    }
  });
  
  // Draw nodes (full width, no truncation, color-coded)
  nodes.forEach(node => {
    const fillColor = 
      node.type === 'screen' ? '#f3f4f6' :
      node.type === 'app' ? '#dbeafe' :
      node.type === 'mocked-backend' ? '#dcfce7' : // Green for mocked
      node.type === 'code-backend' ? '#f3f4f6' : // Light gray for code-only
      node.type === 'backend' ? '#dbeafe' : // Blue for live
      node.type === 'downstream' ? '#e0e7ff' :
      '#fef3c7';
    
    const strokeColor = 
      node.type === 'screen' ? '#9ca3af' :
      node.type === 'app' ? '#3b82f6' :
      node.type === 'mocked-backend' ? '#22c55e' : // Green stroke
      node.type === 'code-backend' ? '#9ca3af' : // Gray stroke
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
  let html = '<nav class="atlas-toc">';
  html += '<div class="atlas-toc-title">Contents</div>';
  html += '<ul>';
  sections.forEach(section => {
    const id = section.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    html += `<li><a href="#arch-${id}">${escapeHtml(section)}</a></li>`;
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
      const endpointEvents = events.filter(e => e.url && e.url.includes(host) && e.method === endpoint.method);
      
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
      } else if (endpoint.status === 'code-only' || endpoint.status === 'unresolved') {
        // Show unknown for code-only and unresolved (no observed auth)
        html += '<span class="auth-badge auth-unknown">—</span>';
      } else {
        html += '<span class="auth-badge auth-none">None</span>';
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
  const flows: Array<{ root: NetworkEvent; depth: number; count: number }> = [];
  
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
      flows.push({ root, depth, count });
    }
  });
  
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
      
      // Render steps with indentation
      html += '<div class="flow-steps" style="font-size: 0.9em; margin-top: 0.5rem;">';
      steps.forEach((step, idx) => {
        const indent = step.level * 1.5;
        html += `<div style="margin-left: ${indent}rem; margin-top: 0.25rem; display: flex; align-items: center; gap: 0.5rem;">`;
        if (idx > 0) html += `<span style="color: var(--muted-foreground);">→</span>`;
        html += `<code style="flex: 1;">${escapeHtml(step.event.method || 'GET')} ${escapeHtml(step.event.url || '')}</code>`;
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
      html += `<span class="issue-message">${escapeHtml(issue.message)}</span>`;
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
