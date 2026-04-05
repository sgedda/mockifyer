import { MockData } from '../types';

/**
 * Computes a structured { dir, filename } for saving a mock file.
 *
 * Directory structure (relative to scenario root):
 *   {hostname}/graphql/{operationName}.json        ← GraphQL (/graphql endpoint)
 *   {hostname}/rest/{path…}/{method}[_{id}].json   ← REST  (/rest/… endpoint)
 *   {hostname}/{path…}/{method}.json               ← everything else
 *
 * The filename is kept short: {dateStr}_{METHOD}[_{identifier}].json
 */
export function getMockFilePath(
  mockData: MockData,
  dateStr: string
): { dir: string; filename: string } {
  const url = mockData.request.url || '';
  const method = (mockData.request.method || 'GET').toUpperCase();

  let host = 'unknown';
  let pathSegments: string[] = [];

  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    pathSegments = parsed.pathname.split('/').filter(Boolean);
  } catch {
    // fallback: use raw URL slug
    const urlSafe = url.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '_');
    return { dir: 'unknown', filename: `${method}_${urlSafe.substring(0, 60)}_${dateStr}.json` };
  }

  // Sanitize hostname (keep dots so it reads like a domain)
  const hostSafe = host.replace(/[^a-zA-Z0-9.-]/g, '_');

  // Detect type and remaining path segments
  const graphqlIdx = pathSegments.lastIndexOf('graphql');
  const restIdx = pathSegments.indexOf('rest');

  let type: string;
  let remainingSegments: string[];

  if (graphqlIdx >= 0) {
    type = 'graphql';
    remainingSegments = pathSegments.slice(graphqlIdx + 1); // usually empty
  } else if (restIdx >= 0) {
    type = 'rest';
    remainingSegments = pathSegments.slice(restIdx + 1);
  } else {
    type = '';
    remainingSegments = pathSegments;
  }

  // Build short identifier from request body
  let identifier = '';
  if (mockData.request.data) {
    try {
      const body =
        typeof mockData.request.data === 'string'
          ? JSON.parse(mockData.request.data)
          : mockData.request.data;

      if (body.operationName) {
        identifier = body.operationName;
      } else if (body.path) {
        identifier = body.path;
      } else if (body.webAppName) {
        identifier = body.webAppName;
      }
    } catch {
      // ignore
    }
  }

  // Sanitize identifier
  identifier = identifier.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 60);

  const dirParts = [hostSafe, type, ...remainingSegments].filter(Boolean);
  const dir = dirParts.join('/');
  const filename = identifier
    ? `${method}_${identifier}_${dateStr}.json`
    : `${method}_${dateStr}.json`;

  return { dir, filename };
}

/**
 * Formats a Date into the standard Mockifyer dateStr used in filenames.
 */
export function formatDateStr(date: Date = new Date()): string {
  return date
    .toISOString()
    .replace(/T/, '_')
    .replace(/\..+/, '')
    .replace(/:/g, '-');
}
