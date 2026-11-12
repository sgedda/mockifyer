#!/usr/bin/env node

/**
 * Validate package exports without Jest's moduleNameMapper.
 * 
 * This script runs in a plain Node.js context to test actual package.json
 * "exports" resolution, which Jest's moduleNameMapper would otherwise bypass.
 */

const path = require('path');

// Subpaths to validate
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

const repoRoot = path.resolve(__dirname, '../..');
// Resolve from axios's node_modules where core is installed as a file: dependency
const axiosNodeModules = path.resolve(repoRoot, 'packages/mockifyer-axios/node_modules');

// Test 1: Validate all core subpath exports
console.log('Validating core subpath exports...');
for (const importSpecifier of coreSubpathImports) {
  try {
    require.resolve(importSpecifier, { paths: [axiosNodeModules] });
    console.log(`✓ ${importSpecifier}`);
  } catch (error) {
    console.error(`✗ ${importSpecifier}`);
    console.error(`  Error: ${error.message}`);
    process.exit(1);
  }
}

// Test 2: Specifically test the production bug case
console.log('\nValidating record-responses-matcher (production bug case)...');
try {
  require.resolve('@sgedda/mockifyer-core/utils/record-responses-matcher', {
    paths: [axiosNodeModules],
  });
  console.log('✓ @sgedda/mockifyer-core/utils/record-responses-matcher');
} catch (error) {
  console.error('✗ @sgedda/mockifyer-core/utils/record-responses-matcher');
  console.error(`  Error: ${error.message}`);
  process.exit(1);
}

// Test 3: Load axios and follow its import graph to ensure no ERR_PACKAGE_PATH_NOT_EXPORTED
console.log('\nValidating axios package loads without ERR_PACKAGE_PATH_NOT_EXPORTED...');
try {
  // Directly load axios package from its built location
  const axiosPackagePath = path.resolve(repoRoot, 'packages/mockifyer-axios');
  const axiosMainPath = path.resolve(axiosPackagePath, 'dist/index.js');
  // Actually require to evaluate axios's import graph
  require(axiosMainPath);
  console.log('✓ @sgedda/mockifyer-axios (loaded successfully)');
} catch (error) {
  console.error('✗ @sgedda/mockifyer-axios');
  console.error(`  Error: ${error.message}`);
  process.exit(1);
}

console.log('\n✓ All package exports validated successfully');
process.exit(0);
