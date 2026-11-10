import * as esbuild from 'esbuild';

const result = await esbuild.build({
  entryPoints: ['./packages/mockifyer-core/src/index.browser.ts'],
  bundle: true,
  platform: 'browser',
  write: false,
  metafile: true,
  logLevel: 'silent',
});

const targets = ['scenario.ts', 'crypto-digest.ts', 'network-body-spill.ts', 'atlas-doc-html.ts', 'atlas-screenshot.ts'];
const imports = {};

// Build reverse map
for (const [file, data] of Object.entries(result.metafile.inputs)) {
  for (const imp of data.imports || []) {
    if (!imports[imp.path]) imports[imp.path] = [];
    imports[imp.path].push(file);
  }
}

// Find ALL modules being bundled
const bundled = new Set(Object.keys(result.metafile.inputs));

console.log('Files in bundle:', bundled.size);
console.log('\nExported modules still in bundle that import problematic files:\n');

for (const target of targets) {
  const pattern = target.replace('.ts', '');
  const importers = [];
  
  for (const file of bundled) {
    if (file.includes(pattern)) continue; // Skip the target itself
    const content = Object.keys(result.metafile.inputs).find(f => f === file);
    if (!content) continue;
    
    // Check if this file imports the target
    const data = result.metafile.inputs[file];
    if (data.imports) {
      for (const imp of data.imports) {
        if (imp.path.includes(pattern)) {
          importers.push(file);
        }
      }
    }
  }
  
  if (importers.length > 0) {
    console.log(`${target}:`);
    importers.slice(0, 5).forEach(f => console.log(`  ${f}`));
  }
}
