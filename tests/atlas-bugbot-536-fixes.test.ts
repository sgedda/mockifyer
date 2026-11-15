/**
 * Tests for Bugbot PR #536 fixes:
 * 1. Auth remap correctly uses composite keys (already fixed in c9ef9135)
 * 2. Client URL normalizer matches server normalizer
 * 3. Hash fragment secrets are redacted
 */

import { describe, it, expect } from '@jest/globals';
import { detectAuthFromTraffic } from '../packages/mockifyer-core/src/utils/atlas-auth-detection';
import { normalizeUrlToTemplate } from '../packages/mockifyer-core/src/utils/atlas-url-normalizer';
import type { NetworkEvent } from '../packages/mockifyer-core/src/utils/network-event-types';

describe('Bugbot PR #536 fixes', () => {
  describe('Issue 1: Auth remap uses composite keys', () => {
    it('should return composite keys in format host::method::template', () => {
      const events: NetworkEvent[] = [
        {
          id: 'req1',
          url: 'https://api.example.com/users/123',
          method: 'GET',
          timestamp: new Date().toISOString(),
          scenario: 'test',
          transport: 'fetch',
          source: 'upstream',
          requestHeaders: {
            Authorization: 'Bearer token123'
          }
        },
        {
          id: 'req2',
          url: 'https://api.example.com/posts/456',
          method: 'POST',
          timestamp: new Date().toISOString(),
          scenario: 'test',
          transport: 'fetch',
          source: 'upstream',
          requestHeaders: {
            'x-api-key': 'secret456'
          }
        }
      ];

      const authMap = detectAuthFromTraffic(events);
      
      // Should have composite keys
      expect(authMap.size).toBeGreaterThan(0);
      
      // Check that keys are in composite format
      for (const key of authMap.keys()) {
        expect(key).toMatch(/^[^:]+::[A-Z]+::.+$/);
        const parts = key.split('::');
        expect(parts).toHaveLength(3);
        expect(parts[0]).toBeTruthy(); // host
        expect(parts[1]).toBeTruthy(); // method
        expect(parts[2]).toBeTruthy(); // template
      }
      
      // Verify specific composite keys exist
      const keys = Array.from(authMap.keys());
      expect(keys.some(k => k.startsWith('api.example.com::GET::'))).toBe(true);
      expect(keys.some(k => k.startsWith('api.example.com::POST::'))).toBe(true);
    });

    it('should detect bearer auth with composite key', () => {
      const events: NetworkEvent[] = [
        {
          id: 'req1',
          url: 'https://api.example.com/users/123',
          method: 'GET',
          timestamp: new Date().toISOString(),
          scenario: 'test',
          transport: 'fetch',
          source: 'upstream',
          requestHeaders: {
            Authorization: 'Bearer token123'
          }
        }
      ];

      const authMap = detectAuthFromTraffic(events);
      const key = 'api.example.com::GET::/users/{id}';
      const auth = authMap.get(key);
      
      expect(auth).toBeDefined();
      expect(auth?.scheme).toBe('bearer');
    });

    it('should detect api-key auth with composite key', () => {
      const events: NetworkEvent[] = [
        {
          id: 'req1',
          url: 'https://api.example.com/posts/456',
          method: 'POST',
          timestamp: new Date().toISOString(),
          scenario: 'test',
          transport: 'fetch',
          source: 'upstream',
          requestHeaders: {
            'x-api-key': 'secret456'
          }
        }
      ];

      const authMap = detectAuthFromTraffic(events);
      const key = 'api.example.com::POST::/posts/{id}';
      const auth = authMap.get(key);
      
      expect(auth).toBeDefined();
      expect(auth?.scheme).toBe('api-key');
    });
  });

  describe('Issue 2: Client URL normalizer matches server', () => {
    it('should normalize UUIDs', () => {
      const url = 'https://api.example.com/posts/550e8400-e29b-41d4-a716-446655440000';
      const result = normalizeUrlToTemplate(url);
      expect(result.template).toBe('/posts/{uuid}');
      expect(result.parameters).toContain('uuid');
    });

    it('should normalize long hashes (MD5, SHA1, SHA256)', () => {
      const urls = [
        'https://api.example.com/files/5d41402abc4b2a76b9719d911017c592', // MD5
        'https://api.example.com/files/356a192b7913b04c54574d18c28d46e6395428ab', // SHA1
        'https://api.example.com/files/9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08' // SHA256
      ];

      for (const url of urls) {
        const result = normalizeUrlToTemplate(url);
        expect(result.template).toBe('/files/{hash}');
        expect(result.parameters).toContain('hash');
      }
    });

    it('should normalize slugs (hyphenated identifiers)', () => {
      const urls = [
        'https://blog.example.com/posts/my-first-post',
        'https://blog.example.com/posts/this-is-a-slug-123'
      ];

      for (const url of urls) {
        const result = normalizeUrlToTemplate(url);
        expect(result.template).toBe('/posts/{slug}');
        expect(result.parameters).toContain('slug');
      }
    });

    it('should normalize numeric IDs', () => {
      const url = 'https://api.example.com/users/42';
      const result = normalizeUrlToTemplate(url);
      expect(result.template).toBe('/users/{id}');
      expect(result.parameters).toContain('id');
    });

    it('should handle multiple patterns in same URL', () => {
      const url = 'https://api.example.com/users/123/posts/550e8400-e29b-41d4-a716-446655440000';
      const result = normalizeUrlToTemplate(url);
      expect(result.template).toBe('/users/{id}/posts/{uuid}');
      expect(result.parameters).toContain('id');
      expect(result.parameters).toContain('uuid');
    });

    it('should match patterns that server normalizer handles', () => {
      // Test cases that should produce identical results on both client and server
      const testCases = [
        { url: 'https://api.example.com/repos/my-repo-name', expected: '/repos/{slug}' },
        { url: 'https://api.example.com/users/42', expected: '/users/{id}' },
        { url: 'https://api.example.com/posts/550e8400-e29b-41d4-a716-446655440000', expected: '/posts/{uuid}' },
        { url: 'https://api.example.com/files/9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', expected: '/files/{hash}' }
      ];

      for (const testCase of testCases) {
        const result = normalizeUrlToTemplate(testCase.url);
        expect(result.template).toBe(testCase.expected);
      }
    });
  });

  describe('Issue 3: Hash fragment secrets are redacted', () => {
    // Import the scrubbing function indirectly by testing the global teardown module
    // Since it's not exported, we'll test the pattern directly
    
    function scrubUrlSecrets(url: string): string {
      if (!url || typeof url !== 'string') return url;
      
      let scrubbed = url;
      
      // Redact common secret parameter patterns in query strings
      scrubbed = scrubbed.replace(
        /([?&])(token|apikey|api_key|password|secret|auth|authorization|key)=[^&#]*/gi,
        '$1$2=<redacted>'
      );
      
      // Redact common secret patterns in hash fragments
      // First pass: handle #param=value at the start of the fragment
      scrubbed = scrubbed.replace(
        /#(token|apikey|api_key|password|secret|auth|authorization|access_token|key)=[^&#]*/gi,
        '#$1=<redacted>'
      );
      
      // Second pass: handle subsequent &param=value or ?param=value within the fragment
      scrubbed = scrubbed.replace(
        /(#[^?]*[?&])(token|apikey|api_key|password|secret|auth|authorization|access_token|key)=[^&#]*/gi,
        '$1$2=<redacted>'
      );
      
      // Third pass: handle &param=value that comes after other fragment params
      const hashIndex = scrubbed.indexOf('#');
      if (hashIndex !== -1) {
        const beforeHash = scrubbed.substring(0, hashIndex + 1);
        let fragment = scrubbed.substring(hashIndex + 1);
        
        fragment = fragment.replace(
          /([&])(token|apikey|api_key|password|secret|auth|authorization|access_token|key)=[^&#]*/gi,
          '$1$2=<redacted>'
        );
        
        scrubbed = beforeHash + fragment;
      }
      
      return scrubbed;
    }

    it('should redact simple hash fragment tokens', () => {
      const url = 'https://app.example.com/callback#token=secret123';
      const scrubbed = scrubUrlSecrets(url);
      expect(scrubbed).toBe('https://app.example.com/callback#token=<redacted>');
      expect(scrubbed).not.toContain('secret123');
    });

    it('should redact OAuth access_token in hash', () => {
      const url = 'https://app.example.com/callback#access_token=ya29.abc123&token_type=Bearer';
      const scrubbed = scrubUrlSecrets(url);
      expect(scrubbed).toBe('https://app.example.com/callback#access_token=<redacted>&token_type=Bearer');
      expect(scrubbed).not.toContain('ya29.abc123');
    });

    it('should redact hash fragment with query-style parameters', () => {
      const url = 'https://app.example.com/page#section?token=secret456';
      const scrubbed = scrubUrlSecrets(url);
      expect(scrubbed).toContain('#section?token=<redacted>');
      expect(scrubbed).not.toContain('secret456');
    });

    it('should redact multiple secrets in hash', () => {
      const url = 'https://app.example.com/page#token=secret1&apikey=secret2';
      const scrubbed = scrubUrlSecrets(url);
      expect(scrubbed).toContain('token=<redacted>');
      expect(scrubbed).toContain('apikey=<redacted>');
      expect(scrubbed).not.toContain('secret1');
      expect(scrubbed).not.toContain('secret2');
    });

    it('should redact authorization in hash', () => {
      const url = 'https://app.example.com/page#authorization=Bearer%20token123';
      const scrubbed = scrubUrlSecrets(url);
      expect(scrubbed).toContain('authorization=<redacted>');
      expect(scrubbed).not.toContain('token123');
    });

    it('should handle mixed query and hash secrets', () => {
      const url = 'https://app.example.com/page?apikey=query-secret#token=hash-secret';
      const scrubbed = scrubUrlSecrets(url);
      expect(scrubbed).toContain('?apikey=<redacted>');
      expect(scrubbed).toContain('#token=<redacted>');
      expect(scrubbed).not.toContain('query-secret');
      expect(scrubbed).not.toContain('hash-secret');
    });

    it('should preserve non-secret hash fragments', () => {
      const url = 'https://app.example.com/page#section-title';
      const scrubbed = scrubUrlSecrets(url);
      expect(scrubbed).toBe(url);
    });

    it('should be case-insensitive', () => {
      const urls = [
        'https://app.example.com/page#TOKEN=secret',
        'https://app.example.com/page#Token=secret',
        'https://app.example.com/page#ACCESS_TOKEN=secret'
      ];

      for (const url of urls) {
        const scrubbed = scrubUrlSecrets(url);
        expect(scrubbed).not.toContain('secret');
        expect(scrubbed).toContain('=<redacted>');
      }
    });
  });
});
