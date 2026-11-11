/**
 * Browser stub for network-body-spill.
 * Body spilling to disk requires fs access, not available in browsers.
 */

export function spillBodyToDisk(_body: any, _path: string): Promise<void> {
  // Browser: no-op (no filesystem)
  return Promise.resolve();
}

export function readSpilledBody(_path: string): Promise<any> {
  // Browser: no spilled bodies
  return Promise.resolve(null);
}

export function shouldSpillBody(_size: number): boolean {
  // Browser: never spill
  return false;
}
