/**
 * Regression test for ERR_PACKAGE_PATH_NOT_EXPORTED.
 *
 * Validates that every @sgedda/mockifyer-core/<subpath> import used by
 * axios, fetch, and dashboard is listed in core's package.json "exports".
 *
 * This test requires packages to be built first (dist/ directories must exist).
 */

import { resolve } from 'path';

describe('package exports validation', () => {
  // All @sgedda/mockifyer-core subpath imports used by other packages
  const coreSubpathImports = [
    '@sgedda/mockifyer-core/utils/build-utils',
    '@sgedda/mockifyer-core/utils/apply-proxy-record-on-miss-env',
    '@sgedda/mockifyer-core/utils/mirror-proxy-recording-to-client',
    '@sgedda/mockifyer-core/utils/init-mockifyer-presets',
    '@sgedda/mockifyer-core/utils/perform-dashboard-proxy-request',
    '@sgedda/mockifyer-core/utils/proxy-upstream-tls-insecure',
    '@sgedda/mockifyer-core/utils/crypto-digest',
    '@sgedda/mockifyer-core/utils/dashboard-central-proxy-health',
    '@sgedda/mockifyer-core/utils/record-responses-matcher',
    '@sgedda/mockifyer-core/utils/fixture-pool/runtime-cache',
  ];

  it('exports all subpaths imported by axios, fetch, and dashboard', () => {
    const corePackagePath = resolve(__dirname, '../packages/mockifyer-core');
    
    for (const importSpecifier of coreSubpathImports) {
      expect(() => {
        // This will throw ERR_PACKAGE_PATH_NOT_EXPORTED if the subpath is not in "exports"
        require.resolve(importSpecifier, { paths: [corePackagePath] });
      }).not.toThrow();
    }
  });

  it('resolves the specific record-responses-matcher subpath that caused the production bug', () => {
    const corePackagePath = resolve(__dirname, '../packages/mockifyer-core');
    
    expect(() => {
      require.resolve('@sgedda/mockifyer-core/utils/record-responses-matcher', {
        paths: [corePackagePath],
      });
    }).not.toThrow();
  });

  it('can load the axios package without ERR_PACKAGE_PATH_NOT_EXPORTED', () => {
    const axiosPackagePath = resolve(__dirname, '../packages/mockifyer-axios');
    
    expect(() => {
      require.resolve('@sgedda/mockifyer-axios', { paths: [axiosPackagePath] });
    }).not.toThrow();
  });
});
