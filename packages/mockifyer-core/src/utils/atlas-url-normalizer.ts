/**
 * URL template normalization for Atlas endpoint discovery.
 * Converts concrete URLs to templates: /users/123 -> /users/{id}, /repos/abc-def -> /repos/{slug}
 */

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const HASH_PATTERN = /\b[0-9a-f]{32,64}\b/gi;
const NUMERIC_ID_PATTERN = /\/\d+(?=\/|$)/g;
// Slug pattern: hyphenated segment with BOTH letters and digits within the segment
// Lookaheads are scoped to stop at next / or end, not scan entire remaining path
const SLUG_PATTERN = /\/(?=[^\/]*\d)(?=[^\/]*[a-z])[a-z0-9]+-[a-z0-9-]+(?=\/|$)/gi;

export interface NormalizedUrl {
  template: string;
  parameters: string[];
}

/**
 * Normalize a URL path into a template with placeholders.
 * Examples:
 *   /users/42 -> /users/{id}
 *   /repos/abc123-def -> /repos/{slug}
 *   /posts/550e8400-e29b-41d4-a716-446655440000 -> /posts/{uuid}
 *   /files/abc123def456hash -> /files/{hash}
 */
export function normalizeUrlToTemplate(url: string): NormalizedUrl {
  try {
    const urlObj = new URL(url, 'http://dummy');
    // Decode URL-encoded characters EXCEPT %2F (encoded slash) to prevent segment splitting
    // %2F in a path represents a slash character within a filename, not a path separator
    const pathname = urlObj.pathname.replace(/%2F/gi, '\x00ENCODED_SLASH\x00');
    let path: string;
    try {
      path = decodeURIComponent(pathname).replace(/\x00ENCODED_SLASH\x00/g, '%2F');
    } catch {
      // If decode fails, use original
      path = urlObj.pathname;
    }
    const parameters: string[] = [];

    // First, normalize any template syntax (:id, {userId}) that might be in the URL
    // This handles code scanner URLs like /users/:id
    path = normalizeTemplatePlaceholders(path);

    // UUIDs
    path = path.replace(UUID_PATTERN, () => {
      parameters.push('uuid');
      return '{uuid}';
    });

    // Long hashes (MD5, SHA1, SHA256)
    path = path.replace(HASH_PATTERN, () => {
      parameters.push('hash');
      return '{hash}';
    });

    // Slugs (hyphenated identifiers like 'my-post-title')
    path = path.replace(SLUG_PATTERN, (match) => {
      parameters.push('slug');
      return '/{slug}';
    });

    // Numeric IDs
    path = path.replace(NUMERIC_ID_PATTERN, () => {
      parameters.push('id');
      return '/{id}';
    });

    return { template: path, parameters };
  } catch {
    // If URL parsing fails, return original
    return { template: url, parameters: [] };
  }
}

/**
 * Normalize template placeholders to a consistent format.
 * Converts Express-style (:id) and infers types from parameter names.
 * Examples:
 *   /users/:id -> /users/{id}
 *   /posts/:userId -> /posts/{id}
 *   /repos/{slug} -> /repos/{slug}
 *   /items/{param} -> /items/{id}
 */
export function normalizeTemplatePlaceholders(template: string): string {
  let normalized = template;
  
  // Express-style :param -> {param}
  normalized = normalized.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '{$1}');
  
  // Infer type from parameter name (for code scanner templates)
  // UUID-like names (case-insensitive)
  normalized = normalized.replace(/\{(?:uuid|guid)\}/gi, '{uuid}');
  // Hash-like names (case-insensitive)
  normalized = normalized.replace(/\{(?:hash|checksum|sha)\}/gi, '{hash}');
  // Slug-like names (case-insensitive)
  normalized = normalized.replace(/\{(?:slug|name|title|key)\}/gi, '{slug}');
  // Generic {param} or plain {id} (case-insensitive)
  normalized = normalized.replace(/\{(?:param|id)\}/gi, '{id}');
  // CamelCase *Id suffixes like {userId}, {postId} (case-sensitive to not match {uuid})
  normalized = normalized.replace(/\{[a-z][a-zA-Z0-9]*Id\}/g, '{id}');
  
  return normalized;
}

/**
 * Merge multiple URL observations into a single template.
 * Takes the most general template that covers all observations.
 */
export function mergeUrlTemplates(urls: string[]): NormalizedUrl {
  if (urls.length === 0) return { template: '', parameters: [] };
  if (urls.length === 1) return normalizeUrlToTemplate(urls[0]);

  const normalized = urls.map(u => normalizeUrlToTemplate(u));
  
  // Use the first as base, merge parameters
  const allParams = new Set<string>();
  normalized.forEach(n => n.parameters.forEach(p => allParams.add(p)));

  return {
    template: normalized[0].template,
    parameters: Array.from(allParams)
  };
}
