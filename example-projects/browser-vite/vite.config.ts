import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5173
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    commonjsOptions: {
      include: [/node_modules/, /mockifyer/]
    }
  },
  resolve: {
    mainFields: ['browser', 'module', 'main'],
    conditions: ['browser', 'import', 'module', 'default']
  },
  optimizeDeps: {
    include: ['@sgedda/mockifyer-core', '@sgedda/mockifyer-fetch'],
    esbuildOptions: {
      mainFields: ['browser', 'module', 'main']
    }
  }
})
