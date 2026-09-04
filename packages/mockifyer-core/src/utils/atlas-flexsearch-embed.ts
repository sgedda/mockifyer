/**
 * Load FlexSearch Light for embedding into Atlas HTML (file:// self-contained).
 */

let cachedScript: string | undefined;

/**
 * Returns a `<script>` block with FlexSearch Light, or empty string when unavailable.
 * Safe for HTML embedding (`</script>` escaped).
 */
export function getFlexSearchEmbedScript(): string {
  if (cachedScript !== undefined) return cachedScript;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    const bundlePath = path.join(
      path.dirname(require.resolve('flexsearch')),
      'flexsearch.light.min.js'
    );
    if (!fs.existsSync(bundlePath)) {
      cachedScript = '';
      return cachedScript;
    }
    const raw = fs.readFileSync(bundlePath, 'utf8');
    // Prevent early </script> termination if present in the min bundle.
    const safe = raw.replace(/<\/script/gi, '<\\/script');
    cachedScript = `<script>\n${safe}\n</script>`;
    return cachedScript;
  } catch {
    cachedScript = '';
    return cachedScript;
  }
}
