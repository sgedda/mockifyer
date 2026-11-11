const { execSync } = require('child_process');
const path = require('path');

async function globalSetup() {
  console.log('\n=== Building root packages before e2e tests ===\n');
  
  // Use the build-all script from the repo root
  const repoRoot = path.resolve(__dirname, '../..');
  
  try {
    console.log('Running packages/build-all.sh...');
    execSync('sh packages/build-all.sh', {
      stdio: 'inherit',
      cwd: repoRoot,
    });
    console.log('\n=== Package build complete! ===\n');
  } catch (error) {
    console.error('Failed to build packages:', error);
    // Don't fail completely - packages might already be built
    console.log('Continuing with tests...\n');
  }

  console.log('\n=== Building frontend for e2e tests ===\n');
  const mockifyerWebDir = path.resolve(__dirname, '..');
  
  try {
    console.log('Running frontend build...');
    execSync('npm run build:frontend', {
      stdio: 'inherit',
      cwd: mockifyerWebDir,
    });
    console.log('\n=== Frontend build complete! ===\n');
  } catch (error) {
    console.error('Failed to build frontend:', error);
    throw error; // Frontend build is required for tests to work
  }
}

module.exports = globalSetup;
