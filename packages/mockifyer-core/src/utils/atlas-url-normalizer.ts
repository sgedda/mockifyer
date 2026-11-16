/**
 * URL template normalization for Atlas endpoint discovery.
 * Converts concrete URLs to templates: /users/123 -> /users/{id}, /repos/abc-def -> /repos/{slug}
 */

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const HASH_PATTERN = /\b[0-9a-f]{32,64}\b/gi;
const NUMERIC_ID_PATTERN = /\/\d+(?=\/|$)/g;
// Only match slugs with mixed alphanumeric (e.g., "post-123-abc"), not static kebab-case routes
const SLUG_PATTERN = /\/(?=.*[a-z])(?=.*\d)[a-z0-9]+-[a-z0-9-]+(?=\/|$)/gi;

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
    // Decode URL-encoded characters like %7B -> {, %7D -> }
    let path = decodeURIComponent(urlObj.pathname);
    const parameters: string[] = [];

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
