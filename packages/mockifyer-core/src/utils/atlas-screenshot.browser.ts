/**
 * Browser stub for atlas-screenshot.
 * Screenshot capture requires fs access, not available in browsers.
 */

export function captureScreenshot(_url: string, _options?: any): Promise<Buffer | null> {
  // Browser: no screenshot capability
  return Promise.resolve(null);
}

export function saveScreenshot(_buffer: Buffer, _path: string): Promise<void> {
  // Browser: no-op (no filesystem)
  return Promise.resolve();
}
