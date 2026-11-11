/**
 * Lazy-load Node.js built-ins without breaking browser bundles.
 * Uses indirect eval to hide require() from bundlers that fail on Node modules in browser builds.
 * 
 * CSP note: indirect eval (`(0, eval)`) may be blocked by strict CSP policies.
 * However, this is only used as a fallback when modules need Node built-ins.
 * Browser-only code paths should never reach this.
 */
function lazyRequire(moduleName: string): any {
  // Only works in Node.js
  if (typeof process === 'undefined' || !process.versions?.node) {
    return null;
  }
  try {
    // Use indirect eval to prevent bundlers from detecting require
    const req = (0, eval)('require');
    return req(moduleName);
  } catch {
    return null;
  }
}

export function lazyFs(): typeof import('fs') | null {
  return lazyRequire('fs');
}

export function lazyPath(): typeof import('path') | null {
  return lazyRequire('path');
}

export function lazyCrypto(): typeof import('crypto') | null {
  return lazyRequire('crypto');
}

export function lazyBuffer(): { Buffer: typeof Buffer } | null {
  return lazyRequire('buffer');
}
