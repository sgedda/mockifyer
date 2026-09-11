import { DASHBOARD_PAGE_SUFFIXES, inferMountPrefixFromPathname } from './dashboard-mount'

/** Marker so tests can find the injected boot script. */
export const PORTABLE_ASSET_BOOT_MARKER = 'mockifyer-dashboard-portable-assets'

export function normalizeDashboardAssetFile(file: string): string {
  return file.replace(/^\.\//, '').replace(/^\/+/, '')
}

/**
 * Path-absolute asset URL for a dashboard page (e.g. `/mockifyer/overrides/`).
 * Host SPA fallbacks that map `/overrides/assets/*.js` → `index.html` never see this path.
 */
export function resolvePortableDashboardAssetUrl(pathname: string, assetFile: string): string {
  const mount = inferMountPrefixFromPathname(pathname)
  const file = normalizeDashboardAssetFile(assetFile)
  return `${mount}/${file}`.replace(/\/{2,}/g, '/')
}

/**
 * Inline boot that inserts CSS/JS with mount-absolute URLs.
 * Must run before any `./assets/*` tags would have been parsed — callers strip those tags.
 */
export function buildPortableAssetBootScript(cssFiles: string[], jsFiles: string[]): string {
  const suffixesJson = JSON.stringify([...DASHBOARD_PAGE_SUFFIXES])
  const cssJson = JSON.stringify(cssFiles.map(normalizeDashboardAssetFile))
  const jsJson = JSON.stringify(jsFiles.map(normalizeDashboardAssetFile))
  return `/*${PORTABLE_ASSET_BOOT_MARKER}*/
(function () {
  var suffixes = ${suffixesJson};
  var cssFiles = ${cssJson};
  var jsFiles = ${jsJson};
  var raw = (typeof location !== 'undefined' && location.pathname) ? location.pathname : '/';
  var p = String(raw).split('?')[0].replace(/\\/+$/, '') || '/';
  var prefix = '';
  var matched = false;
  var i;
  var s;
  for (i = 0; i < suffixes.length; i++) {
    s = suffixes[i];
    if (p === s) {
      matched = true;
      prefix = '';
      break;
    }
    if (p.length > s.length && p.slice(p.length - s.length) === s) {
      matched = true;
      prefix = p.slice(0, p.length - s.length);
      break;
    }
  }
  if (!matched && p !== '/') {
    prefix = p;
  }
  function assetUrl(file) {
    var f = String(file).replace(/^\\.\\//, '').replace(/^\\/+/, '');
    return (prefix ? prefix : '') + '/' + f;
  }
  if (typeof document === 'undefined' || !document.head) {
    return;
  }
  for (i = 0; i < cssFiles.length; i++) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.crossOrigin = 'anonymous';
    link.href = assetUrl(cssFiles[i]);
    document.head.appendChild(link);
  }
  for (i = 0; i < jsFiles.length; i++) {
    var el = document.createElement('script');
    el.type = 'module';
    el.crossOrigin = 'anonymous';
    el.src = assetUrl(jsFiles[i]);
    document.head.appendChild(el);
  }
})();`
}

/**
 * Rewrite Vite `base: './'` index.html so the host cannot serve HTML as the module bundle
 * for `/mockifyer/overrides/assets/*.js`.
 */
export function injectPortableDashboardAssets(html: string): string {
  if (html.includes(`/*${PORTABLE_ASSET_BOOT_MARKER}*/`)) {
    return html
  }

  const jsFiles: string[] = []
  const cssFiles: string[] = []

  let next = html.replace(/<script\b[^>]*><\/script>/gi, (tag) => {
    const srcMatch = tag.match(/\bsrc="(\.\/assets\/[^"]+)"/i)
    if (!srcMatch) {
      return tag
    }
    jsFiles.push(srcMatch[1])
    return ''
  })

  next = next.replace(/<link\b[^>]*>/gi, (tag) => {
    const hrefMatch = tag.match(/\bhref="(\.\/assets\/[^"]+)"/i)
    if (!hrefMatch) {
      return tag
    }
    const isStylesheet = /rel=["']stylesheet["']/i.test(tag) || hrefMatch[1].endsWith('.css')
    if (!isStylesheet) {
      return tag
    }
    cssFiles.push(hrefMatch[1])
    return ''
  })

  if (jsFiles.length === 0 && cssFiles.length === 0) {
    return html
  }

  const boot = `<script>${buildPortableAssetBootScript(cssFiles, jsFiles)}</script>`
  if (next.includes('</head>')) {
    return next.replace('</head>', `${boot}\n</head>`)
  }
  return `${boot}\n${next}`
}
