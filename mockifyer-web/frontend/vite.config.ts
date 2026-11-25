import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync } from 'fs'
import path from 'path'

const generatorSrcIndex = path.resolve(
  __dirname,
  '../../packages/mockifyer-generator/src/index.ts'
)
const hasLocalGenerator = existsSync(generatorSrcIndex)

const alias: Record<string, string> = {
  '@': path.resolve(__dirname, './src'),
}

// Monorepo: prefer TypeScript sources so Vite can code-split locale chunks.
// Production (mockifyer-web-only context): resolve the published npm package
// (browser-safe "." export — never `./node`).
if (hasLocalGenerator) {
  alias['@sgedda/mockifyer-generator'] = generatorSrcIndex
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias,
  },
  optimizeDeps: {
    include: ['@faker-js/faker/locale/en', 'fflate'],
  },
  server: {
    port: 5174,
    fs: {
      allow: hasLocalGenerator
        ? [path.resolve(__dirname, '../..')]
        : [path.resolve(__dirname, '..')],
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
      // No manualChunks for @faker-js/faker: naming lazy locale entries pulls shared
      // base chunks into those async files, then the static `locale/en` import loads
      // them eagerly. Let Rollup keep en+shared with the generator dynamic import,
      // and sv/de/fr/es as exclusive async chunks (see faker.ts loadLocale).
    },
  },
})
