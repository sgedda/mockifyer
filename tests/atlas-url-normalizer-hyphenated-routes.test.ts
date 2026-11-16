/**
 * Test that static hyphenated routes are not collapsed to slugs.
 */

import { normalizeUrlToTemplate } from '../packages/mockifyer-core/src/utils/atlas-url-normalizer';

describe('URL normalizer hyphenated routes', () => {
  it('preserves static kebab-case routes without numbers', () => {
    expect(normalizeUrlToTemplate('https://api.example.com/health-check').template).toBe('/health-check');
    expect(normalizeUrlToTemplate('https://api.example.com/user-profile').template).toBe('/user-profile');
    expect(normalizeUrlToTemplate('https://api.example.com/api/v1/some-endpoint').template).toBe('/api/v1/some-endpoint');
  });

  it('normalizes dynamic slugs with mixed alphanumeric', () => {
    expect(normalizeUrlToTemplate('https://api.example.com/posts/my-post-123').template).toBe('/posts/{slug}');
    expect(normalizeUrlToTemplate('https://api.example.com/repos/abc-def-456').template).toBe('/repos/{slug}');
    expect(normalizeUrlToTemplate('https://api.example.com/items/item-42-xyz').template).toBe('/items/{slug}');
  });

  it('distinguishes static routes from dynamic slugs', () => {
    // Static kebab-case routes (no numbers)
    expect(normalizeUrlToTemplate('https://api.example.com/get-started').template).toBe('/get-started');
    expect(normalizeUrlToTemplate('https://api.example.com/api/check-status').template).toBe('/api/check-status');
    
    // Dynamic slugs (with numbers)
    expect(normalizeUrlToTemplate('https://api.example.com/post-123').template).toBe('/{slug}');
    expect(normalizeUrlToTemplate('https://api.example.com/user-456-edit').template).toBe('/{slug}');
  });

  it('still normalizes other ID patterns', () => {
    expect(normalizeUrlToTemplate('https://api.example.com/users/123').template).toBe('/users/{id}');
    expect(normalizeUrlToTemplate('https://api.example.com/repos/550e8400-e29b-41d4-a716-446655440000').template).toBe('/repos/{uuid}');
  });
});
