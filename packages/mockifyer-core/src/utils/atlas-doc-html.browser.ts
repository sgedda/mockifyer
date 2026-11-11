/**
 * Browser stub for atlas-doc-html.
 * Atlas HTML generation requires fs access, not available in browsers.
 */

export function generateAtlasHtml(_data: any, _options?: any): Promise<string> {
  // Browser: return empty HTML
  return Promise.resolve('<html><body>Atlas requires Node.js</body></html>');
}

export function writeAtlasHtml(_html: string, _path: string): Promise<void> {
  // Browser: no-op (no filesystem)
  return Promise.resolve();
}
