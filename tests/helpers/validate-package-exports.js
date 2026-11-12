#!/usr/bin/env node

/**
 * Validate package exports without Jest's moduleNameMapper.
 * 
 * This script runs in a plain Node.js context to test actual package.json
 * "exports" resolution, which Jest's moduleNameMapper would otherwise bypass.
 * 
 * Works without building packages by validating the exports configuration structure.
 */

const path = require('path');
const fs = require('fs');

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
const corePackagePath = path.resolve(repoRoot, 'packages/mockifyer-core');
const corePackageJsonPath = path.resolve(corePackagePath, 'package.json');
const coreDistPath = path.resolve(corePackagePath, 'dist');

// Check if package is built
const isBuilt = fs.existsSync(coreDistPath);

// Read and validate package.json exports
const packageJson = JSON.parse(fs.readFileSync(corePackageJsonPath, 'utf8'));

if (!packageJson.exports) {
  console.error('✗ package.json missing "exports" field');
  process.exit(1);
}

// Extract subpath from import specifier (e.g., '@sgedda/mockifyer-core/utils/build-utils' -> './utils/build-utils')
const packageName = '@sgedda/mockifyer-core';

console.log('Validating core subpath exports...\n');

for (const importSpecifier of coreSubpathImports) {
  const subpath = importSpecifier.replace(packageName, '.').replace(/^\.\//, './');
  
  // Check export entry exists
  if (!packageJson.exports[subpath]) {
    console.error(`✗ ${importSpecifier}`);
    console.error(`  Missing export entry for: ${subpath}`);
    process.exit(1);
  }
  
  // If built, also check that the target file exists
  if (isBuilt) {
    const exportEntry = packageJson.exports[subpath];
    const targetPath = typeof exportEntry === 'string' 
      ? exportEntry 
      : exportEntry.default;
    
    if (targetPath) {
      const fullPath = path.resolve(corePackagePath, targetPath);
      if (!fs.existsSync(fullPath)) {
        console.error(`✗ ${importSpecifier}`);
        console.error(`  Export target file missing: ${targetPath}`);
        process.exit(1);
      }
      console.log(`✓ ${importSpecifier} (export entry + file present)`);
    } else {
      console.log(`✓ ${importSpecifier} (export entry present)`);
    }
  } else {
    console.log(`✓ ${importSpecifier} (export entry present)`);
  }
}

// Specifically check the production bug case
const bugCaseSubpath = './utils/record-responses-matcher';
console.log('\nValidating record-responses-matcher (production bug case)...');
if (!packageJson.exports[bugCaseSubpath]) {
  console.error('✗ @sgedda/mockifyer-core/utils/record-responses-matcher');
  console.error(`  Missing export entry for: ${bugCaseSubpath}`);
  process.exit(1);
}

if (isBuilt) {
  const exportEntry = packageJson.exports[bugCaseSubpath];
  const targetPath = typeof exportEntry === 'string' 
    ? exportEntry 
    : exportEntry.default;
  
  if (targetPath) {
    const fullPath = path.resolve(corePackagePath, targetPath);
    if (!fs.existsSync(fullPath)) {
      console.error('✗ @sgedda/mockifyer-core/utils/record-responses-matcher');
      console.error(`  Export target file missing: ${targetPath}`);
      process.exit(1);
    }
  }
}

console.log('✓ @sgedda/mockifyer-core/utils/record-responses-matcher');

const validationType = isBuilt ? 'exports + files' : 'exports structure';
console.log(`\n✓ All package exports validated successfully (${validationType})`);

console.log('\n✓ All package exports validated successfully');
process.exit(0);
