/**
 * Regression test for ERR_PACKAGE_PATH_NOT_EXPORTED.
 *
 * Validates that every @sgedda/mockifyer-core/<subpath> import used by
 * axios, fetch, and dashboard is listed in core's package.json "exports".
 *
 * This test requires packages to be built first (dist/ directories must exist).
 * 
 * Runs validation in a separate Node.js process to bypass Jest's moduleNameMapper,
 * which would otherwise map imports to source files and skip package.json exports.
 */

import { execSync } from 'child_process';
import { resolve } from 'path';

describe('package exports validation', () => {
  it('validates package.json exports without Jest moduleNameMapper interference', () => {
    const helperScript = resolve(__dirname, 'helpers/validate-package-exports.js');
    
    // Run the validation script in a plain Node.js process (no Jest moduleNameMapper)
    expect(() => {
      execSync(`node "${helperScript}"`, {
        cwd: resolve(__dirname, '..'),
        encoding: 'utf8',
        stdio: 'pipe',
      });
    }).not.toThrow();
  });
});
