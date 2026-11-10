import * as esbuild from 'esbuild';
import * as fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Plugin to fail build if Node built-ins are imported
const failOnNodeBuiltins = {
  name: 'fail-on-node-builtins',
  setup(build) {
    const nodeBuiltins = ['fs', 'path', 'crypto', 'buffer', 'stream', 'util', 'os', 'net', 'tls', 'dns', 'url'];
    
    build.onResolve({ filter: /.*/ }, args => {
      if (nodeBuiltins.includes(args.path)) {
        return {
          errors: [{
            text: `❌ FORBIDDEN: Node built-in '${args.path}' imported in browser build at ${args.importer}`,
            location: null
          }]
        };
      }
      return null;
    });
  }
};

try {
  console.log('Building browser bundle (platform=browser, NO node built-ins allowed)...');
  
  const result = await esbuild.build({
    entryPoints: [path.resolve(__dirname, 'src/index.ts')],
    bundle: true,
    platform: 'browser',
    target: 'es2020',
    format: 'esm',
    outfile: 'dist/index.js',
    sourcemap: true,
    minify: false,
    external: [], // NO externals - bundle everything to verify no Node modules
    conditions: ['browser', 'module', 'import'],
    mainFields: ['browser', 'module', 'main'],
    plugins: [failOnNodeBuiltins], // Fail on any Node built-ins - no stubbing allowed
    define: {
      'process.env.NODE_ENV': '"production"',
      'global': 'window'
    },
    loader: {
      '.json': 'json',
      '.ts': 'ts',
      '.tsx': 'tsx'
    },
    logLevel: 'info',
    metafile: true,
  });
  
  console.log('✅ Build succeeded - NO Node built-ins detected');
  
  // Write metafile for analysis
  fs.writeFileSync('dist/meta.json', JSON.stringify(result.metafile, null, 2));
  
  // Copy index.html
  fs.copyFileSync('src/index.html', 'dist/index.html');
  console.log('✅ Copied index.html to dist/');
  
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}
