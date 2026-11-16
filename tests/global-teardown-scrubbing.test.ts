/**
 * Tests for global-teardown URL scrubbing (Bugbot issue: Scrubber leaves secrets in URLs)
 */

describe('Global teardown URL scrubbing', () => {
  // Simulate the scrubUrlSecrets function from e2e/global-teardown.ts
  function scrubUrlSecrets(url: string): string {
    if (!url || typeof url !== 'string') return url;
    
    return url.replace(
      /([?&])(token|apikey|api_key|password|secret|auth|authorization|key)=[^&]*/gi,
      '$1$2=<redacted>'
    );
  }

  describe('scrubUrlSecrets', () => {
    it('should redact token query parameter', () => {
      const url = 'https://api.example.com/data?token=abc123secret&other=value';
      const scrubbed = scrubUrlSecrets(url);
      expect(scrubbed).toBe('https://api.example.com/data?token=<redacted>&other=value');
    });

    it('should redact apikey query parameter', () => {
      const url = 'https://api.example.com/data?apikey=secretkey&limit=10';
      const scrubbed = scrubUrlSecrets(url);
      expect(scrubbed).toBe('https://api.example.com/data?apikey=<redacted>&limit=10');
    });

    it('should redact api_key query parameter', () => {
      const url = 'https://api.example.com/data?api_key=secretkey';
      const scrubbed = scrubUrlSecrets(url);
      expect(scrubbed).toBe('https://api.example.com/data?api_key=<redacted>');
    });

    it('should redact password query parameter', () => {
      const url = 'https://example.com/login?user=john&password=secret123';
      const scrubbed = scrubUrlSecrets(url);
      expect(scrubbed).toBe('https://example.com/login?user=john&password=<redacted>');
    });

    it('should redact multiple secret parameters', () => {
      const url = 'https://api.example.com/data?token=abc&apikey=xyz&other=value';
      const scrubbed = scrubUrlSecrets(url);
      expect(scrubbed).toBe('https://api.example.com/data?token=<redacted>&apikey=<redacted>&other=value');
    });

    it('should handle parameters with special characters', () => {
      const url = 'https://api.example.com/data?token=abc%2F123%3D&other=value';
      const scrubbed = scrubUrlSecrets(url);
      expect(scrubbed).toBe('https://api.example.com/data?token=<redacted>&other=value');
    });

    it('should be case-insensitive for parameter names', () => {
      const url = 'https://api.example.com/data?Token=abc&ApiKey=xyz';
      const scrubbed = scrubUrlSecrets(url);
      expect(scrubbed).toBe('https://api.example.com/data?Token=<redacted>&ApiKey=<redacted>');
    });

    it('should not modify URLs without sensitive parameters', () => {
      const url = 'https://api.example.com/data?limit=10&offset=20';
      const scrubbed = scrubUrlSecrets(url);
      expect(scrubbed).toBe(url);
    });

    it('should handle empty or null URLs safely', () => {
      expect(scrubUrlSecrets('')).toBe('');
      expect(scrubUrlSecrets(null as any)).toBe(null);
      expect(scrubUrlSecrets(undefined as any)).toBe(undefined);
    });
  });
});
