import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { normalizeViteDashboardBase } from '../src/utils/dashboard-base-path'

const base = normalizeViteDashboardBase(process.env.VITE_MOCKIFYER_DASHBOARD_BASE)

function devApiProxy() {
  if (base === '/') {
    return {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    }
  }
  const prefix = base.replace(/\/$/, '')
  return {
    [`${prefix}/api`]: {
      target: 'http://localhost:3002',
      changeOrigin: true,
      rewrite: (p: string) => p.slice(prefix.length) || '/',
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: devApiProxy(),
  },
  build: {
    outDir: '../public',
    emptyOutDir: true, // Clean public directory before build (old HTML files are replaced)
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
    },
  },
})

