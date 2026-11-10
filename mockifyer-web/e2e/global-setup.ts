import { execSync } from 'child_process';

async function globalSetup() {
  console.log('Building root packages before e2e tests...');
  
  const packagesToBuild = [
    'mockifyer-core',
    'mockifyer-axios',
    'mockifyer-fetch',
  ];
  
  for (const pkg of packagesToBuild) {
    console.log(`Building ${pkg}...`);
    try {
      execSync(`cd ../../packages/${pkg} && npm install && npm run build`, {
        stdio: 'inherit',
        cwd: __dirname,
      });
    } catch (error) {
      console.error(`Failed to build ${pkg}:`, error);
      // Continue anyway - packages might already be built
    }
  }
  
  console.log('Package build complete!');
}

export default globalSetup;
