/**
 * Extract outbound CMS navigation refs from Umbraco-ish props.
 * Algorithm mirrors Atlas `fetch-page-links-tree.ts` (destinationId + internal urls
 * in navigation-shaped / navigation-context nodes) — used for Atlas HTML trees,
 * not a full crawl.
 */

export type AtlasCmsLinkRefType = 'path' | 'id';

export interface AtlasCmsLinkRef {
  type: AtlasCmsLinkRefType;
  value: string;
}

const FILE_EXTENSION_RE =
  /\.(?:jpg|jpeg|png|gif|webp|svg|ico|pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z|mp3|wav|mp4|mov|webm|avi|css|js|json|xml)$/i;
const NAV_CONTEXT_TOKEN_RE =
  /(navigation|link|href|target|route|cta|button|deep|tab|booking|profile)/i;

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

function isInternalPath(rawPath: string): boolean {
  return typeof rawPath === 'string' && rawPath.trim().startsWith('/');
}

function hasNavigationShape(node: Record<string, unknown>): boolean {
  return (
    typeof node.linkType === 'string' ||
    typeof node.destinationType === 'string' ||
    typeof node.target === 'string' ||
    typeof node.queryString === 'string' ||
    typeof node.route === 'object'
  );
}

function isNavigationContext(pathSegments: string[]): boolean {
  return pathSegments.some((segment) => NAV_CONTEXT_TOKEN_RE.test(segment));
}

function keyOf(ref: AtlasCmsLinkRef): string {
  return `${ref.type}:${ref.value}`;
}

function extractRefsFromAny(
  value: unknown,
  refs: AtlasCmsLinkRef[],
  pathSegments: string[] = []
): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      extractRefsFromAny(item, refs, pathSegments);
    }
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  const node = value as Record<string, unknown>;
  const destinationId =
    typeof node.destinationId === 'string' ? node.destinationId.trim() : undefined;
  if (destinationId) {
    refs.push({ type: 'id', value: destinationId });
  }

  if (typeof node.url === 'string') {
    const url = node.url.trim();
    if (
      isInternalPath(url) &&
      (hasNavigationShape(node) || isNavigationContext(pathSegments))
    ) {
      refs.push({ type: 'path', value: normalizePath(url) });
    }
  }

  for (const [key, nested] of Object.entries(node)) {
    extractRefsFromAny(nested, refs, [...pathSegments, key]);
  }
}

function dedupeRefs(refs: AtlasCmsLinkRef[]): AtlasCmsLinkRef[] {
  const seen = new Set<string>();
  const result: AtlasCmsLinkRef[] = [];
  for (const ref of refs) {
    const key = keyOf(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(ref);
  }
  return result;
}

/** Whether a path looks like an app page (not media / asset). */
export function isLikelyAtlasCmsPagePath(rawPath: string): boolean {
  if (!rawPath || !rawPath.startsWith('/')) return false;
  const normalized = normalizePath(rawPath);
  const withoutQuery = normalized.split('?')[0]?.split('#')[0] ?? normalized;
  const lower = withoutQuery.toLowerCase();
  if (!lower || lower === '/') return false;
  if (lower.startsWith('/media/')) return false;
  if (lower.startsWith('/umbraco/')) return false;
  if (FILE_EXTENSION_RE.test(lower)) return false;
  return true;
}

/**
 * Collect unique page link refs from CMS component props (same heuristics as
 * Atlas umbraco page-links tree).
 */
export function extractAtlasCmsLinkRefs(propsSample: unknown): AtlasCmsLinkRef[] {
  const refs: AtlasCmsLinkRef[] = [];
  extractRefsFromAny(propsSample, refs);
  return dedupeRefs(refs).filter((ref) => {
    if (ref.type === 'id') return Boolean(ref.value);
    return isLikelyAtlasCmsPagePath(ref.value);
  });
}

/** Merge link lists by type+value (last write wins on extras). */
export function mergeAtlasCmsLinkRefs(
  existing: AtlasCmsLinkRef[] | undefined,
  incoming: AtlasCmsLinkRef[] | undefined
): AtlasCmsLinkRef[] {
  const byKey = new Map<string, AtlasCmsLinkRef>();
  for (const ref of existing ?? []) {
    byKey.set(keyOf(ref), ref);
  }
  for (const ref of incoming ?? []) {
    byKey.set(keyOf(ref), ref);
  }
  return [...byKey.values()].sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
}
