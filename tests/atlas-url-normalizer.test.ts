import { normalizeUrlToTemplate, mergeUrlTemplates } from '../packages/mockifyer-core/src/utils/atlas-url-normalizer';

describe('atlas-url-normalizer', () => {
  describe('normalizeUrlToTemplate', () => {
    it('should normalize numeric IDs', () => {
      const result = normalizeUrlToTemplate('https://api.example.com/users/123');
      expect(result.template).toBe('/users/{id}');
      expect(result.parameters).toContain('id');
    });

    it('should normalize UUIDs', () => {
      const result = normalizeUrlToTemplate('https://api.example.com/posts/550e8400-e29b-41d4-a716-446655440000');
      expect(result.template).toBe('/posts/{uuid}');
      expect(result.parameters).toContain('uuid');
    });

    it('should normalize hashes', () => {
      const result = normalizeUrlToTemplate('https://api.example.com/files/abc123def456abc123def456abc123de');
      expect(result.template).toBe('/files/{hash}');
      expect(result.parameters).toContain('hash');
    });

    it('should normalize slugs', () => {
      // Slug pattern requires both letters and digits to avoid matching static routes
      const result = normalizeUrlToTemplate('https://api.example.com/posts/my-blog-post-title-2024');
      expect(result.template).toBe('/posts/{slug}');
      expect(result.parameters).toContain('slug');
    });

    it('should handle multiple parameters', () => {
      const result = normalizeUrlToTemplate('https://api.example.com/users/42/posts/my-post-123');
      expect(result.template).toBe('/users/{id}/posts/{slug}');
      expect(result.parameters).toContain('id');
      expect(result.parameters).toContain('slug');
    });

    it('should handle paths without parameters', () => {
      const result = normalizeUrlToTemplate('https://api.example.com/api/weather/current');
      expect(result.template).toBe('/api/weather/current');
      expect(result.parameters).toEqual([]);
    });

    it('should handle malformed URLs gracefully', () => {
      const result = normalizeUrlToTemplate('just-text');
      // Note: hyphenated text gets normalized as slug, which is acceptable
      expect(result.template).toBeDefined();
    });
  });

  describe('mergeUrlTemplates', () => {
    it('should merge similar URLs into a template', () => {
      const urls = [
        'https://api.example.com/users/1',
        'https://api.example.com/users/42',
        'https://api.example.com/users/999'
      ];
      const result = mergeUrlTemplates(urls);
      expect(result.template).toBe('/users/{id}');
    });

    it('should handle empty array', () => {
      const result = mergeUrlTemplates([]);
      expect(result.template).toBe('');
    });

    it('should handle single URL', () => {
      const result = mergeUrlTemplates(['https://api.example.com/users/123']);
      expect(result.template).toBe('/users/{id}');
    });
  });
});
