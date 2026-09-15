import type { Plugin } from 'vite'
import { replaceDashboardPageSuffixesLiteral } from './src/lib/dashboard-mount'
import { injectPortableDashboardAssets } from './src/lib/portable-dashboard-assets'

/**
 * After Vite emits relative `./assets/*` URLs, replace them with a boot script
 * that loads `/<mount>/assets/*` so a host SPA fallback cannot serve index.html
 * as JavaScript on `/mockifyer/overrides/`.
 */
export function dashboardPortableAssetsPlugin(base: string): Plugin {
  return {
    name: 'mockifyer-dashboard-portable-assets',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const withSuffixes = replaceDashboardPageSuffixesLiteral(html)
        if (base !== './') {
          return withSuffixes
        }
        return injectPortableDashboardAssets(withSuffixes)
      },
    },
  }
}
