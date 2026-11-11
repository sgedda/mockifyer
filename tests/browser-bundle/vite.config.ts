import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    target: 'es2020',
    outDir: 'dist',
    minify: false, // easier to debug
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'MockifyerTest',
      formats: ['es'],
      fileName: () => 'index.js'
    },
    rollupOptions: {
      external: [],
      output: {
        inlineDynamicImports: true
      }
    }
  },
  resolve: {
    alias: {
      // Use source directly to test
      '@sgedda/mockifyer-fetch': path.resolve(__dirname, '../packages/mockifyer-fetch/src/index.ts'),
      '@sgedda/mockifyer-core': path.resolve(__dirname, '../packages/mockifyer-core/src/index.ts'),
      // Block Node built-ins - they should fail build if imported
      'fs': false,
      'path': false,
      'crypto': false,
      'stream': false,
      'buffer': false,
      'util': false,
      'os': false
    },
    conditions: ['browser', 'module', 'import']
  },
  optimizeDeps: {
    include: ['@sgedda/mockifyer-fetch', '@sgedda/mockifyer-core']
  }
});
