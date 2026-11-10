import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  await esbuild.build({
    entryPoints: [path.resolve(__dirname, 'src/index.ts')],
    bundle: true,
    platform: 'browser',
    target: 'es2020',
    format: 'esm',
    outfile: 'dist/index.js',
    sourcemap: true,
    minify: false,
    external: [], // bundle everything
    conditions: ['browser', 'module', 'import'], // Use browser export conditions
    mainFields: ['browser', 'module', 'main'], // Prefer browser field
    alias: {
      // These should never be pulled in for browser builds
    },
    define: {
      'process.env.NODE_ENV': '"production"',
      'global': 'window'
    },
    logLevel: 'info',
  });
  console.log('✅ Build succeeded');
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}
