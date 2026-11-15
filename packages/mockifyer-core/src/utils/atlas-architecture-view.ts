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
  const NODE_GAP = 180;
  const NODE_WIDTH = 160;
  const NODE_HEIGHT = 45;
  let y = 60;
  
  // Layer 1: Screens
  if (screens && screens.length > 0) {
    screens.slice(0, 5).forEach((screen, i) => {
      nodes.push({
        id: `screen-${i}`,
        label: screen,
        type: 'screen',
        x: 50 + i * NODE_GAP,
        y
      });
    });
    y += LAYER_GAP;
  }
  
  // Layer 2: App
  nodes.push({
    id: 'app',
    label: 'Application',
    type: 'app',
    x: 250,
    y
  });
  y += LAYER_GAP;
  
  // Layer 3: Backend hosts (color-coded by status)
  const hosts = Array.from(inventory.byHost.keys()).slice(0, 5);
  const hostStatuses = new Map<string, 'mocked' | 'live' | 'error' | 'code-only'>();
  
  hosts.forEach(host => {
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
  
  hosts.forEach((host, i) => {
    nodes.push({
      id: `host-${host}`,
      label: host,
      type: hostStatuses.get(host) === 'mocked' ? 'mocked-backend' : 
            hostStatuses.get(host) === 'code-only' ? 'code-backend' :
            'backend',
      x: 50 + i * NODE_GAP,
      y
    });
  });
  y += LAYER_GAP;
  
  // Layer 4: Downstream services (from chains)
  const downstreamHosts = new Set<string>();
  events.forEach(ev => {
    if (ev.parentRequestId && ev.url) {
      try {
        const url = new URL(ev.url);
        downstreamHosts.add(url.hostname);
      } catch {}
    }
  });
  
  const downstream = Array.from(downstreamHosts).slice(0, 4);
  downstream.forEach((host, i) => {
    nodes.push({
      id: `downstream-${host}`,
      label: host,
      type: 'downstream',
      x: 100 + i * NODE_GAP,
      y
    });
  });
  
  // Create edges
  // Screen -> App
  if (screens && screens.length > 0) {
    screens.slice(0, 5).forEach((_, i) => {
      edges.push({
        from: `screen-${i}`,
        to: 'app',
        label: '',
        status: 'live'
      });
    });
  }
  
  // App -> Hosts (position labels to avoid overlap)
  hosts.forEach((host, i) => {
    const hostInventory = inventory.byHost.get(host);
    if (!hostInventory) return;
    
    const entries = hostInventory;
    const status = hostStatuses.get(host) || 'live';
    
    edges.push({
      from: 'app',
      to: `host-${host}`,
      label: `${entries.length} ep`,
      status: status as any,
      count: entries.length
    });
  });
  
  // Hosts -> Downstream (from chains)
  downstream.forEach(host => {
    edges.push({
      from: hosts.length > 0 ? `host-${hosts[0]}` : 'app',
      to: `downstream-${host}`,
      label: 'nested',
      status: 'live'
    });
  });
  
  // Generate SVG with legend below
  const contentWidth = Math.max(800, hosts.length * NODE_GAP + 100);
  const diagramHeight = y + 40;
  const legendHeight = 60;
  const totalHeight = diagramHeight + legendHeight;
  
  let svg = `<svg viewBox="0 0 ${contentWidth} ${totalHeight}" xmlns="http://www.w3.org/2000/svg" class="atlas-system-diagram" style="width: 100%; height: auto; min-height: 400px;">`;
  
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
    
    const x1 = fromNode.x + NODE_WIDTH / 2;
    const y1 = fromNode.y + NODE_HEIGHT;
    const x2 = toNode.x + NODE_WIDTH / 2;
    const y2 = toNode.y;
    
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
      stroke="${color}" stroke-width="2" stroke-dasharray="${strokeDasharray}" marker-end="url(#${marker})" />`;
    
    // Position label slightly offset to avoid overlaps
    if (edge.label) {
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      // Offset label slightly to the side based on index to avoid stacking
      const offset = (edges.indexOf(edge) % 2 === 0 ? 15 : -15);
      svg += `<text x="${midX + offset}" y="${midY}" font-size="12" fill="${color}" text-anchor="middle" font-weight="600">${escapeHtml(edge.label)}</text>`;
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
    
    svg += `<rect x="${node.x}" y="${node.y}" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="6" 
      fill="${fillColor}" stroke="${strokeColor}" stroke-width="2" ${node.type === 'code-backend' ? 'stroke-dasharray="5,5"' : ''} />`;
    
    // Show full label, wrapping if needed
    const label = node.label.length > 22 ? node.label.slice(0, 22) : node.label;
    svg += `<text x="${node.x + NODE_WIDTH/2}" y="${node.y + NODE_HEIGHT/2 + 5}" font-size="13" text-anchor="middle" fill="#1f2937" font-weight="500">${escapeHtml(label)}</text>`;
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
      
      html += '<tr>';
      html += `<td><span class="method method-${endpoint.method.toLowerCase()}">${endpoint.method}</span></td>`;
      html += `<td><code class="url-template">${escapeHtml(endpoint.urlTemplate)}</code></td>`;
      
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
      const snippets = generateEndpointSnippets(
        endpoint.method,
        exampleUrl,
        endpointEvents.length > 0 ? [endpointEvents[0]] : undefined,
        auth
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
      html += `<div class="flow-root"><code>${escapeHtml(flow.root.method || 'GET')} ${escapeHtml(flow.root.url || '')}</code></div>`;
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
