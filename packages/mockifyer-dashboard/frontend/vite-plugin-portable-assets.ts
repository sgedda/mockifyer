import type { Plugin } from 'vite'
import { injectPortableDashboardAssets } from './src/lib/portable-dashboard-assets'

/**
 * After Vite emits relative `./assets/*` URLs, replace them with a boot script
 * that loads `/<mount>/assets/*` so a host SPA fallback cannot serve index.html
 * as JavaScript on `/mockifyer/overrides/`.
 */
export function dashboardPortableAssetsPlugin(base: string): Plugin {
  return {
    name: 'mockifyer-dashboard-portable-assets',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (base !== './') {
          return html
        }
        return injectPortableDashboardAssets(html)
      },
    },
  }
}
