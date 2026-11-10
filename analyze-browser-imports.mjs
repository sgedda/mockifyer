// Analyze browser bundle to find all transitive Node module imports
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const esbuild = require('esbuild');

const nodeBuiltins = ['fs', 'path', 'crypto', 'buffer', 'stream', 'util', 'os', 'net', 'tls', 'dns', 'url', 'http', 'https', 'zlib'];

async function analyzeBrowserImports(entryPoint, label) {
  console.log(`\n=== Analyzing ${label} ===`);
  
  try {
    const result = await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      platform: 'browser',
      write: false,
      metafile: true,
      logLevel: 'silent',
    });
    
    // Analyze imports from metafile
    const inputs = result.metafile.inputs;
    const nodeImports = new Set();
    const problematicFiles = new Set();
    
    for (const [file, data] of Object.entries(inputs)) {
      if (data.imports) {
        for (const imp of data.imports) {
          const path = imp.path;
          // Check if it's trying to import a Node built-in
          for (const builtin of nodeBuiltins) {
            if (path === builtin || path.startsWith(builtin + '/')) {
              nodeImports.add(builtin);
              problematicFiles.add(file);
            }
          }
        }
      }
    }
    
    if (nodeImports.size > 0) {
      console.log(`❌ Found ${nodeImports.size} Node built-ins: ${Array.from(nodeImports).join(', ')}`);
      console.log(`\nProblematic files (${problematicFiles.size}):`);
      for (const file of Array.from(problematicFiles).sort()) {
        console.log(`  ${file}`);
      }
      return {success: false, nodeImports: Array.from(nodeImports), files: Array.from(problematicFiles)};
    } else {
      console.log(`✅ Clean - no Node built-ins detected`);
      return {success: true};
    }
  } catch (error) {
    console.log(`❌ Build failed:`, error.message);
    return {success: false, error: error.message};
  }
}

// Analyze both packages
const coreResult = await analyzeBrowserImports(
  './packages/mockifyer-core/src/index.browser.ts',
  'mockifyer-core/index.browser.ts'
);

const fetchResult = await analyzeBrowserImports(
  './packages/mockifyer-fetch/src/index.browser.ts',
  'mockifyer-fetch/index.browser.ts'
);

console.log('\n=== Summary ===');
console.log('mockifyer-core:', coreResult.success ? '✅ Clean' : `❌ ${coreResult.nodeImports?.length || 0} Node built-ins`);
console.log('mockifyer-fetch:', fetchResult.success ? '✅ Clean' : `❌ ${fetchResult.nodeImports?.length || 0} Node built-ins`);

if (!coreResult.success || !fetchResult.success) {
  console.log('\n⚠️  Browser entries have transitive Node imports - refactoring needed');
  process.exit(1);
} else {
  console.log('\n✅ Both browser entries are clean!');
}
