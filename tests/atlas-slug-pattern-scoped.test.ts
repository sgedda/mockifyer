/**
 * Test that slug pattern matching is scoped to individual segments.
 * A static kebab-case route followed by a numeric ID should not
 * collapse the static route to a slug.
 */

import { normalizeUrlToTemplate } from '../packages/mockifyer-core/src/utils/atlas-url-normalizer';

describe('Slug pattern scoping', () => {
  it('does not collapse static route when later segment has numbers', () => {
    // /health-check is static, /items/123 has an ID
    // The static route should NOT become {slug} just because 123 appears later
    const result = normalizeUrlToTemplate('https://api.example.com/health-check/items/123');
    
    // Should be /health-check/items/{id}, not /{slug}/items/{id}
    expect(result.template).toBe('/health-check/items/{id}');
  });

  it('handles multiple static kebab-case segments', () => {
    const result = normalizeUrlToTemplate('https://api.example.com/api/health-check/status-info/current');
    
    // All are static kebab-case, no IDs
    expect(result.template).toBe('/api/health-check/status-info/current');
  });

  it('still matches actual slugs with mixed content', () => {
    // A slug that has both letters and numbers within the same segment
    const result = normalizeUrlToTemplate('https://api.example.com/posts/my-post-123-abc');
    
    // This segment itself has mixed content, so it's a slug
    expect(result.template).toBe('/posts/{slug}');
  });

  it('distinguishes adjacent segments correctly', () => {
    // First segment is pure letters (static), second has numbers (dynamic)
    const result = normalizeUrlToTemplate('https://api.example.com/user-profile/item-456');
    
    // user-profile: only letters -> static
    // item-456: mixed alphanumeric -> slug
    expect(result.template).toBe('/user-profile/{slug}');
  });

  it('handles static route followed by UUID', () => {
    const result = normalizeUrlToTemplate('https://api.example.com/health-check/550e8400-e29b-41d4-a716-446655440000');
    
    // health-check should stay static, UUID should be normalized
    expect(result.template).toBe('/health-check/{uuid}');
  });
});
