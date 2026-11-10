/**
 * Match a URL path against a slot path pattern.
 * `*` matches a single path segment. No `**` in v1.
 */
export function matchPathPattern(pathname: string, pathPattern: string): boolean {
  const path = normalizePathname(pathname);
  const pattern = normalizePathname(pathPattern);

  if (!pattern.startsWith('/')) {
    return false;
  }

  const pathParts = path.split('/').filter(Boolean);
  const patternParts = pattern.split('/').filter(Boolean);

  if (pathParts.length !== patternParts.length) {
    return false;
  }

  for (let i = 0; i < patternParts.length; i++) {
    const expected = patternParts[i]!;
    const actual = pathParts[i]!;
    if (expected === '*') continue;
    if (expected !== actual) return false;
  }

  return true;
}

/**
 * Extract pathname from a full URL or path-only string.
 */
export function pathnameFromUrl(url: string): string {
  if (!url) return '/';
  try {
    if (url.includes('://')) {
      const parsed = new URL(url);
      return parsed.pathname || '/';
    }
  } catch {
    // fall through
  }
  const withoutQuery = url.split('?')[0] || '/';
  return withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
}

/**
 * Extract hostname from a full URL, or undefined for path-only.
 */
export function hostFromUrl(url: string): string | undefined {
  if (!url || !url.includes('://')) return undefined;
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

function normalizePathname(pathname: string): string {
  if (!pathname) return '/';
  let p = pathname.trim();
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}
