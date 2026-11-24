import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const generatorSrc = path.resolve(__dirname, '../../packages/mockifyer-generator/src')

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Prefer TypeScript sources so Vite can code-split locale chunks
      '@sgedda/mockifyer-generator': path.resolve(generatorSrc, 'index.ts'),
    },
  },
  optimizeDeps: {
    include: ['@faker-js/faker/locale/en', 'fflate'],
  },
  server: {
    port: 5174,
    fs: {
      allow: [path.resolve(__dirname, '../..')],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../public',
    emptyOutDir: true,
    // Avoid gzip size pass (extra memory) — Railway Metal builders OOM mid-transform otherwise
    reportCompressedSize: false,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks(id) {
          // Keep the generator engine (+ faker) out of the main SPA bundle.
          // Loaded on demand via loadGeneratorEngine() on the playground route.
          if (id.includes('packages/mockifyer-generator') || id.includes('@faker-js/faker')) {
            return 'mock-data-generator'
          }
          return undefined
        },
      },
    },
  },
})
