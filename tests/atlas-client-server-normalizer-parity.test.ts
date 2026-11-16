/**
 * Test that the client-side URL normalizer embedded in atlas-doc-html.ts
 * produces the same results as the server-side normalizeUrlToTemplate.
 * 
 * This prevents the "Client URL normalizer mismatches server" bug where
 * the client fails to find matching events because templates differ.
 */

import { describe, it, expect } from '@jest/globals';
import { normalizeUrlToTemplate as serverNormalizer } from '../packages/mockifyer-core/src/utils/atlas-url-normalizer';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * Extract and evaluate the client-side normalizeUrlToTemplate from atlas-doc-html.ts
 */
function getClientNormalizer(): (url: string) => { template: string; parameters: string[] } {
  const htmlFilePath = path.join(__dirname, '../packages/mockifyer-core/src/utils/atlas-doc-html.ts');
  const content = fs.readFileSync(htmlFilePath, 'utf-8');
  
  // Extract both normalizeTemplatePlaceholders and normalizeUrlToTemplate
  const placeholderFunctionMatch = content.match(/function normalizeTemplatePlaceholders\(template\) \{[\s\S]*?\n\}/m);
  const urlFunctionMatch = content.match(/function normalizeUrlToTemplate\(url\) \{[\s\S]*?\n\}/m);
  
  if (!urlFunctionMatch) {
    throw new Error('Could not find client normalizeUrlToTemplate function');
  }
  
  let placeholderFunction = placeholderFunctionMatch ? placeholderFunctionMatch[0] : '';
  let urlFunction = urlFunctionMatch[0];
  
  // Replace escaped backslashes for actual execution
  placeholderFunction = placeholderFunction.replace(/\\\\/g, '\\');
  urlFunction = urlFunction.replace(/\\\\/g, '\\');
  
  // Create functions that can be executed
  const wrapped = `
    ${placeholderFunction}
    ${urlFunction}
    return normalizeUrlToTemplate;
  `;
  
  return new Function(wrapped)();
}

describe('Client/Server URL normalizer parity', () => {
  const clientNormalizer = getClientNormalizer();

  const testCases = [
    {
      description: 'UUID normalization',
      url: 'https://api.example.com/posts/550e8400-e29b-41d4-a716-446655440000',
      expectedTemplate: '/posts/{uuid}'
    },
    {
      description: 'Numeric ID normalization',
      url: 'https://api.example.com/users/42',
      expectedTemplate: '/users/{id}'
    },
    {
      description: 'Numeric ID with trailing slash',
      url: 'https://api.example.com/users/123/',
      expectedTemplate: '/users/{id}/'
    },
    {
      description: 'Slug normalization (hyphenated with numbers)',
      url: 'https://blog.example.com/posts/my-first-post-123',
      expectedTemplate: '/posts/{slug}'
    },
    {
      description: 'Slug with multiple hyphens and digits',
      url: 'https://blog.example.com/posts/this-is-a-long-slug-42',
      expectedTemplate: '/posts/{slug}'
    },
    {
      description: 'MD5 hash (32 hex chars)',
      url: 'https://api.example.com/files/5d41402abc4b2a76b9719d911017c592',
      expectedTemplate: '/files/{hash}'
    },
    {
      description: 'SHA1 hash (40 hex chars)',
      url: 'https://api.example.com/files/356a192b7913b04c54574d18c28d46e6395428ab',
      expectedTemplate: '/files/{hash}'
    },
    {
      description: 'SHA256 hash (64 hex chars)',
      url: 'https://api.example.com/files/9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      expectedTemplate: '/files/{hash}'
    },
    {
      description: 'Multiple patterns: ID and UUID',
      url: 'https://api.example.com/users/123/posts/550e8400-e29b-41d4-a716-446655440000',
      expectedTemplate: '/users/{id}/posts/{uuid}'
    },
    {
      description: 'No patterns to normalize',
      url: 'https://api.example.com/health',
      expectedTemplate: '/health'
    },
    {
      description: 'Path with query parameters',
      url: 'https://api.example.com/users/42?include=posts',
      expectedTemplate: '/users/{id}'
    },
    {
      description: 'Slug followed by ID',
      url: 'https://api.example.com/repos/my-repo-v2/issues/123',
      expectedTemplate: '/repos/{slug}/issues/{id}'
    }
  ];

  testCases.forEach(({ description, url, expectedTemplate }) => {
    it(`should match for: ${description}`, () => {
      const serverResult = serverNormalizer(url);
      const clientResult = clientNormalizer(url);

      expect(clientResult.template).toBe(expectedTemplate);
      expect(serverResult.template).toBe(expectedTemplate);
      expect(clientResult.template).toBe(serverResult.template);
    });
  });

  it('should produce identical parameter lists', () => {
    const url = 'https://api.example.com/users/123/posts/550e8400-e29b-41d4-a716-446655440000/comments/my-comment';
    
    const serverResult = serverNormalizer(url);
    const clientResult = clientNormalizer(url);

    expect(clientResult.parameters).toEqual(serverResult.parameters);
  });

  it('should handle malformed URLs identically', () => {
    const invalidUrls = [
      'not-a-url',
      'http://',
      ''
    ];

    for (const url of invalidUrls) {
      const serverResult = serverNormalizer(url);
      const clientResult = clientNormalizer(url);
      
      // Both should return the original or a consistent fallback
      expect(clientResult.template).toBe(serverResult.template);
    }
  });

  it('should handle relative URLs identically', () => {
    const relativeUrls = [
      '/api/users/123',
      '/posts/my-slug',
      '/files/550e8400-e29b-41d4-a716-446655440000'
    ];

    for (const url of relativeUrls) {
      const serverResult = serverNormalizer(url);
      const clientResult = clientNormalizer(url);
      
      expect(clientResult.template).toBe(serverResult.template);
    }
  });

  describe('Pattern priority and ordering', () => {
    it('should apply UUID pattern before numeric ID', () => {
      // UUIDs contain numbers but should be recognized as UUIDs
      const url = 'https://api.example.com/items/550e8400-e29b-41d4-a716-446655440000';
      
      const serverResult = serverNormalizer(url);
      const clientResult = clientNormalizer(url);

      expect(serverResult.template).toBe('/items/{uuid}');
      expect(clientResult.template).toBe('/items/{uuid}');
    });

    it('should apply hash pattern to standalone hex strings', () => {
      // Long hex strings should be recognized as hashes
      const url = 'https://api.example.com/commits/9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
      
      const serverResult = serverNormalizer(url);
      const clientResult = clientNormalizer(url);

      expect(serverResult.template).toBe('/commits/{hash}');
      expect(clientResult.template).toBe('/commits/{hash}');
    });

    it('should apply slug pattern to hyphenated segments', () => {
      const url = 'https://api.example.com/repos/my-awesome-repo-123';
      
      const serverResult = serverNormalizer(url);
      const clientResult = clientNormalizer(url);

      expect(serverResult.template).toBe('/repos/{slug}');
      expect(clientResult.template).toBe('/repos/{slug}');
    });
  });

  describe('Template placeholder normalization', () => {
    it('should normalize Express-style :id syntax', () => {
      const url = 'https://api.example.com/users/:id';
      
      const serverResult = serverNormalizer(url);
      const clientResult = clientNormalizer(url);

      expect(serverResult.template).toBe('/users/{id}');
      expect(clientResult.template).toBe('/users/{id}');
      expect(clientResult.template).toBe(serverResult.template);
    });

    it('should normalize generic {param} to {id}', () => {
      const url = 'https://api.example.com/items/{param}';
      
      const serverResult = serverNormalizer(url);
      const clientResult = clientNormalizer(url);

      expect(serverResult.template).toBe('/items/{id}');
      expect(clientResult.template).toBe('/items/{id}');
      expect(clientResult.template).toBe(serverResult.template);
    });

    it('should normalize {userId} to {id}', () => {
      const url = 'https://api.example.com/profiles/{userId}';
      
      const serverResult = serverNormalizer(url);
      const clientResult = clientNormalizer(url);

      expect(serverResult.template).toBe('/profiles/{id}');
      expect(clientResult.template).toBe('/profiles/{id}');
      expect(clientResult.template).toBe(serverResult.template);
    });

    it('should preserve {uuid} and NOT convert to {id}', () => {
      const url = 'https://api.example.com/resources/{uuid}';
      
      const serverResult = serverNormalizer(url);
      const clientResult = clientNormalizer(url);

      // Critical: {uuid} must stay {uuid}, not become {id}
      expect(serverResult.template).toBe('/resources/{uuid}');
      expect(clientResult.template).toBe('/resources/{uuid}');
      expect(clientResult.template).toBe(serverResult.template);
    });

    it('should preserve {guid} as {uuid}', () => {
      const url = 'https://api.example.com/items/{guid}';
      
      const serverResult = serverNormalizer(url);
      const clientResult = clientNormalizer(url);

      expect(serverResult.template).toBe('/items/{uuid}');
      expect(clientResult.template).toBe('/items/{uuid}');
      expect(clientResult.template).toBe(serverResult.template);
    });

    it('should handle mixed {uuid} and {userId} correctly', () => {
      const url = 'https://api.example.com/users/{userId}/resources/{uuid}';
      
      const serverResult = serverNormalizer(url);
      const clientResult = clientNormalizer(url);

      expect(serverResult.template).toBe('/users/{id}/resources/{uuid}');
      expect(clientResult.template).toBe('/users/{id}/resources/{uuid}');
      expect(clientResult.template).toBe(serverResult.template);
    });

    it('should normalize {postId} to {id}', () => {
      const url = 'https://api.example.com/posts/{postId}';
      
      const serverResult = serverNormalizer(url);
      const clientResult = clientNormalizer(url);

      expect(serverResult.template).toBe('/posts/{id}');
      expect(clientResult.template).toBe('/posts/{id}');
      expect(clientResult.template).toBe(serverResult.template);
    });

    it('should handle :userId Express-style', () => {
      const url = 'https://api.example.com/profiles/:userId';
      
      const serverResult = serverNormalizer(url);
      const clientResult = clientNormalizer(url);

      expect(serverResult.template).toBe('/profiles/{id}');
      expect(clientResult.template).toBe('/profiles/{id}');
      expect(clientResult.template).toBe(serverResult.template);
    });
  });

  describe('Slug pattern scoping', () => {
    it('should NOT collapse static route when later segment has numbers', () => {
      const url = 'https://api.example.com/health-check/items/123';
      
      const serverResult = serverNormalizer(url);
      const clientResult = clientNormalizer(url);

      expect(serverResult.template).toBe('/health-check/items/{id}');
      expect(clientResult.template).toBe('/health-check/items/{id}');
      expect(clientResult.template).toBe(serverResult.template);
    });

    it('should handle multiple static kebab-case segments', () => {
      const url = 'https://api.example.com/api/health-check/status-info/current';
      
      const serverResult = serverNormalizer(url);
      const clientResult = clientNormalizer(url);

      expect(serverResult.template).toBe('/api/health-check/status-info/current');
      expect(clientResult.template).toBe('/api/health-check/status-info/current');
      expect(clientResult.template).toBe(serverResult.template);
    });

    it('should match actual slugs with mixed content', () => {
      const url = 'https://api.example.com/posts/my-post-123-abc';
      
      const serverResult = serverNormalizer(url);
      const clientResult = clientNormalizer(url);

      expect(serverResult.template).toBe('/posts/{slug}');
      expect(clientResult.template).toBe('/posts/{slug}');
      expect(clientResult.template).toBe(serverResult.template);
    });

    it('should distinguish adjacent segments correctly', () => {
      const url = 'https://api.example.com/user-profile/item-456';
      
      const serverResult = serverNormalizer(url);
      const clientResult = clientNormalizer(url);

      expect(serverResult.template).toBe('/user-profile/{slug}');
      expect(clientResult.template).toBe('/user-profile/{slug}');
      expect(clientResult.template).toBe(serverResult.template);
    });

    it('should handle static route followed by UUID', () => {
      const url = 'https://api.example.com/health-check/550e8400-e29b-41d4-a716-446655440000';
      
      const serverResult = serverNormalizer(url);
      const clientResult = clientNormalizer(url);

      expect(serverResult.template).toBe('/health-check/{uuid}');
      expect(clientResult.template).toBe('/health-check/{uuid}');
      expect(clientResult.template).toBe(serverResult.template);
    });
  });

  describe('Real-world examples', () => {
    it('should match GitHub-style repo URLs', () => {
      const url = 'https://api.github.com/repos/owner/repo-name/issues/123';
      
      const serverResult = serverNormalizer(url);
      const clientResult = clientNormalizer(url);

      expect(clientResult.template).toBe(serverResult.template);
    });

    it('should match UUID-based resource URLs', () => {
      const url = 'https://api.stripe.com/v1/charges/ch_1234567890abcdef1234567890abcdef';
      
      const serverResult = serverNormalizer(url);
      const clientResult = clientNormalizer(url);

      // Should normalize to hash pattern
      expect(clientResult.template).toBe(serverResult.template);
    });

    it('should match blog post URLs with slugs', () => {
      const url = 'https://blog.example.com/posts/how-to-build-a-great-api-v2';
      
      const serverResult = serverNormalizer(url);
      const clientResult = clientNormalizer(url);

      expect(clientResult.template).toBe('/posts/{slug}');
      expect(serverResult.template).toBe('/posts/{slug}');
    });
  });
});
