import * as esbuild from 'esbuild';

const result = await esbuild.build({
  entryPoints: ['./packages/mockifyer-core/src/index.browser.ts'],
  bundle: true,
  platform: 'browser',
  write: false,
  metafile: true,
  logLevel: 'silent',
});

const problematic = [
  'atlas-doc-html',
  'crypto-digest', 
  'mirror-proxy-recording-to-client',
  'network-body-spill',
  'request-correlation',
  'scenario',
  'serialize-proxy-request-body'
];

console.log('=== Import Chains to Problematic Files ===\n');

for (const target of problematic) {
  console.log(`\n${target}:`);
  const targetPattern = new RegExp(`${target}\\.(ts|js)$`);
  
  // Find files that import the target
  for (const [file, data] of Object.entries(result.metafile.inputs)) {
    if (data.imports) {
      for (const imp of data.imports) {
        if (targetPattern.test(imp.path)) {
          console.log(`  ← ${file}`);
        }
      }
    }
  }
}
