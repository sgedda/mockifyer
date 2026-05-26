#!/usr/bin/env node
/**
 * Switch between local and published Mockifyer packages
 * 
 * Usage:
 *   npm run switch:local    - Switch to local packages (for development)
 *   npm run switch:published - Switch to published packages (for testing)
 */

const fs = require('fs');
const path = require('path');

const PACKAGE_JSON_PATH = path.resolve(__dirname, '../package.json');
const BACKUP_PATH = path.resolve(__dirname, '../package.json.backup');

const LOCAL_PACKAGES = {
  '@sgedda/mockifyer-core': 'file:../../packages/mockifyer-core',
  '@sgedda/mockifyer-fetch': 'file:../../packages/mockifyer-fetch',
};

const PUBLISHED_PACKAGES = {
  '@sgedda/mockifyer-core': '^1.7.0',
  '@sgedda/mockifyer-fetch': '^1.7.0',
};

function readPackageJson() {
  const content = fs.readFileSync(PACKAGE_JSON_PATH, 'utf8');
  return JSON.parse(content);
}

function writePackageJson(pkg) {
  fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2) + '\n');
}

function backupPackageJson() {
  const pkg = readPackageJson();
  fs.writeFileSync(BACKUP_PATH, JSON.stringify(pkg, null, 2) + '\n');
}

function restorePackageJson() {
  if (fs.existsSync(BACKUP_PATH)) {
    const content = fs.readFileSync(BACKUP_PATH, 'utf8');
    fs.writeFileSync(PACKAGE_JSON_PATH, content);
    fs.unlinkSync(BACKUP_PATH);
    return true;
  }
  return false;
}

function switchToLocal() {
  console.log('🔄 Switching to LOCAL packages...');
  
  const pkg = readPackageJson();
  
  // Backup current state
  backupPackageJson();
  
  // Update dependencies
  Object.keys(LOCAL_PACKAGES).forEach(pkgName => {
    if (pkg.dependencies[pkgName]) {
      console.log(`  ✓ ${pkgName}: ${pkg.dependencies[pkgName]} → ${LOCAL_PACKAGES[pkgName]}`);
      pkg.dependencies[pkgName] = LOCAL_PACKAGES[pkgName];
    }
  });
  
  writePackageJson(pkg);
  
  console.log('\n✅ Switched to LOCAL packages');
  console.log('📦 Run: npm install');
}

function switchToPublished() {
  console.log('🔄 Switching to PUBLISHED packages...');
  
  const pkg = readPackageJson();
  
  // Backup current state
  backupPackageJson();
  
  // Update dependencies
  Object.keys(PUBLISHED_PACKAGES).forEach(pkgName => {
    if (pkg.dependencies[pkgName]) {
      console.log(`  ✓ ${pkgName}: ${pkg.dependencies[pkgName]} → ${PUBLISHED_PACKAGES[pkgName]}`);
      pkg.dependencies[pkgName] = PUBLISHED_PACKAGES[pkgName];
    }
  });
  
  writePackageJson(pkg);
  
  console.log('\n✅ Switched to PUBLISHED packages');
  console.log('📦 Run: npm install');
}

function showStatus() {
  const pkg = readPackageJson();
  console.log('📦 Current package configuration:\n');
  
  Object.keys(LOCAL_PACKAGES).forEach(pkgName => {
    const current = pkg.dependencies[pkgName];
    const isLocal = current && current.startsWith('file:');
    const status = isLocal ? '🔧 LOCAL' : '📦 PUBLISHED';
    console.log(`  ${status} ${pkgName}: ${current}`);
  });
}

// Main
const command = process.argv[2];

switch (command) {
  case 'local':
  case 'use:local':
    switchToLocal();
    break;
    
  case 'published':
  case 'use:published':
  case 'npm':
    switchToPublished();
    break;
    
  case 'status':
    showStatus();
    break;
    
  case 'restore':
    if (restorePackageJson()) {
      console.log('✅ Restored package.json from backup');
    } else {
      console.log('❌ No backup found');
    }
    break;
    
  default:
    console.log('Usage: node scripts/switch-packages.js <command>');
    console.log('');
    console.log('Commands:');
    console.log('  local, use:local      Switch to local packages (file: paths)');
    console.log('  published, use:published, npm  Switch to published packages (version numbers)');
    console.log('  status                Show current package configuration');
    console.log('  restore               Restore package.json from backup');
    console.log('');
    showStatus();
    process.exit(1);
}
