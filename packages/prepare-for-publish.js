#!/usr/bin/env node
/**
 * Prepares packages for publishing by converting file: references to published versions
 * 
 * This script:
 * - Converts file: references to published versions (^version) before publishing
 * - Can restore file: references after publishing for local development
 * 
 * Usage:
 *   node prepare-for-publish.js        # Convert file: to versions
 *   node prepare-for-publish.js --restore  # Restore file: references
 */

const fs = require('fs');
const path = require('path');

const PACKAGES_DIR = __dirname;
const PACKAGES = ['mockifyer-core', 'mockifyer-axios', 'mockifyer-fetch', 'mockifyer-dashboard', 'mockifyer-test-helper'];

// Map of package names to their file: paths (for restoration)
const FILE_REF_MAP = {
  '@sgedda/mockifyer-core': 'file:../mockifyer-core',
  '@sgedda/mockifyer-fetch': 'file:../mockifyer-fetch',
  '@sgedda/mockifyer-axios': 'file:../mockifyer-axios',
};

/**
 * Get the version of a package from its package.json
 */
function getPackageVersion(packageName) {
  const packageDir = packageName.replace('@sgedda/', '');
  const packageJsonPath = path.join(PACKAGES_DIR, packageDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return `^${pkg.version}`;
  }
  return null;
}

/**
 * Convert file: references to published versions
 */
function convertFileRefsToVersions() {
  console.log('🔄 Converting file: references to published versions...\n');
  
  for (const pkgName of PACKAGES) {
    const packageJsonPath = path.join(PACKAGES_DIR, pkgName, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      console.log(`  ⏭️  Skipping ${pkgName} (package.json not found)\n`);
      continue;
    }
    
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    let changed = false;
    
    // Check dependencies
    if (pkg.dependencies) {
      for (const [depName, depValue] of Object.entries(pkg.dependencies)) {
        if (typeof depValue === 'string' && depValue.startsWith('file:') && FILE_REF_MAP[depName]) {
          const version = getPackageVersion(depName);
          if (version) {
            console.log(`  ${pkgName}: ${depName} ${depValue} → ${version}`);
            pkg.dependencies[depName] = version;
            changed = true;
          } else {
            console.warn(`  ⚠️  ${pkgName}: Could not find version for ${depName}`);
          }
        }
      }
    }
    
    if (changed) {
      fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
      console.log(`  ✅ Updated ${pkgName}/package.json\n`);
    } else {
      console.log(`  ⏭️  No changes needed for ${pkgName}\n`);
    }
  }
  
  console.log('✅ All packages prepared for publishing!');
}

/**
 * Restore file: references for local development
 */
function restoreFileRefs() {
  console.log('🔄 Restoring file: references for local development...\n');
  
  for (const pkgName of PACKAGES) {
    const packageJsonPath = path.join(PACKAGES_DIR, pkgName, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      console.log(`  ⏭️  Skipping ${pkgName} (package.json not found)\n`);
      continue;
    }
    
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    let changed = false;
    
    // Check dependencies
    if (pkg.dependencies) {
      for (const [depName, depValue] of Object.entries(pkg.dependencies)) {
        if (FILE_REF_MAP[depName] && typeof depValue === 'string' && !depValue.startsWith('file:')) {
          // Only restore if it's a version range (starts with ^ or ~)
          if (depValue.match(/^[\^~]/)) {
            console.log(`  ${pkgName}: ${depName} ${depValue} → ${FILE_REF_MAP[depName]}`);
            pkg.dependencies[depName] = FILE_REF_MAP[depName];
            changed = true;
          }
        }
      }
    }
    
    if (changed) {
      fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
      console.log(`  ✅ Updated ${pkgName}/package.json\n`);
    } else {
      console.log(`  ⏭️  No changes needed for ${pkgName}\n`);
    }
  }
  
  console.log('✅ All packages restored for local development!');
}

// Main
const args = process.argv.slice(2);
if (args.includes('--restore')) {
  restoreFileRefs();
} else {
  convertFileRefsToVersions();
}
