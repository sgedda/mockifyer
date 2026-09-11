import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { normalizeViteDashboardBase } from '../src/utils/dashboard-base-path'
import { dashboardPortableAssetsPlugin } from './vite-plugin-portable-assets'

const base = normalizeViteDashboardBase(process.env.VITE_MOCKIFYER_DASHBOARD_BASE)
const dashboardVersion = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')
).version as string

function devApiProxy() {
  if (base === '/' || base === './') {
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
  define: {
    'import.meta.env.VITE_MOCKIFYER_DASHBOARD_VERSION': JSON.stringify(dashboardVersion),
  },
  plugins: [react(), dashboardPortableAssetsPlugin(base)],
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

