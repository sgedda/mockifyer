/**
 * Public Atlas scrubber (e2e/lib/scrub-public-atlas.ts).
 * GitHub Pages publishes the teardown output, so these hit the real functions.
 */

import {
  scrubNetworkEvent,
  scrubObjectSecrets,
  scrubUrlSecrets,
} from '../e2e/lib/scrub-public-atlas';

describe('Global teardown URL scrubbing', () => {
  describe('scrubUrlSecrets', () => {
    it('should redact token query parameter', () => {
      const url = 'https://api.example.com/data?token=abc123secret&other=value';
      expect(scrubUrlSecrets(url)).toBe(
        'https://api.example.com/data?token=<redacted>&other=value'
      );
    });

    it('should redact apikey query parameter', () => {
      const url = 'https://api.example.com/data?apikey=secretkey&limit=10';
      expect(scrubUrlSecrets(url)).toBe(
        'https://api.example.com/data?apikey=<redacted>&limit=10'
      );
    });

    it('should redact api_key and hyphenated api-key', () => {
      expect(scrubUrlSecrets('https://api.example.com/data?api_key=secretkey')).toBe(
        'https://api.example.com/data?api_key=<redacted>'
      );
      expect(scrubUrlSecrets('https://api.example.com/data?api-key=secretkey&safe=1')).toBe(
        'https://api.example.com/data?api-key=<redacted>&safe=1'
      );
    });

    it('should redact password query parameter', () => {
      const url = 'https://example.com/login?user=john&password=secret123';
      expect(scrubUrlSecrets(url)).toBe(
        'https://example.com/login?user=john&password=<redacted>'
      );
    });

    it('should redact multiple secret parameters', () => {
      const url = 'https://api.example.com/data?token=abc&apikey=xyz&other=value';
      expect(scrubUrlSecrets(url)).toBe(
        'https://api.example.com/data?token=<redacted>&apikey=<redacted>&other=value'
      );
    });

    it('should handle parameters with special characters', () => {
      const url = 'https://api.example.com/data?token=abc%2F123%3D&other=value';
      expect(scrubUrlSecrets(url)).toBe(
        'https://api.example.com/data?token=<redacted>&other=value'
      );
    });

    it('should be case-insensitive for parameter names', () => {
      const url = 'https://api.example.com/data?Token=abc&ApiKey=xyz';
      expect(scrubUrlSecrets(url)).toBe(
        'https://api.example.com/data?Token=<redacted>&ApiKey=<redacted>'
      );
    });

    it('should redact compound oauth query params and the exact key param', () => {
      const url =
        'https://api.example.com/oauth?refresh_token=rt-secret&client_secret=cs-secret&key=maps-key&author=ada';
      const scrubbed = scrubUrlSecrets(url);
      expect(scrubbed).toContain('refresh_token=<redacted>');
      expect(scrubbed).toContain('client_secret=<redacted>');
      expect(scrubbed).toContain('key=<redacted>');
      expect(scrubbed).toContain('author=ada');
      expect(scrubbed).not.toContain('rt-secret');
      expect(scrubbed).not.toContain('cs-secret');
      expect(scrubbed).not.toContain('maps-key');
    });

    it('should redact secret params in hash fragments', () => {
      const url = 'https://app.example.com/callback#access_token=secret&state=safe';
      const scrubbed = scrubUrlSecrets(url);
      expect(scrubbed).toContain('#access_token=<redacted>');
      expect(scrubbed).toContain('state=safe');
      expect(scrubbed).not.toContain('=secret');
    });

    it('should redact URL userinfo', () => {
      expect(scrubUrlSecrets('https://user:s3cret@api.example.com/v1')).toBe(
        'https://<redacted>@api.example.com/v1'
      );
    });

    it('should not modify URLs without sensitive parameters', () => {
      const url = 'https://api.example.com/data?limit=10&offset=20';
      expect(scrubUrlSecrets(url)).toBe(url);
    });

    it('should handle empty or null URLs safely', () => {
      expect(scrubUrlSecrets('')).toBe('');
      expect(scrubUrlSecrets(null as unknown as string)).toBe(null);
      expect(scrubUrlSecrets(undefined as unknown as string)).toBe(undefined);
    });
  });

  describe('scrubNetworkEvent publish boundary', () => {
    it('redacts the upstream URL copied into a proxy failure errorMessage', () => {
      const secret = 'opentripmap-live-key';
      const url =
        `https://api.opentripmap.com/0.1/en/places/radius?radius=3000&apikey=${secret}`;
      const scrubbed = scrubNetworkEvent({
        url: url.replace(secret, '[REDACTED]'),
        errorMessage: `GET ${url}: fetch failed (ENOTFOUND)`,
        requestHeaders: {
          Authorization: 'Bearer session-token',
          'x-api_key': secret,
          'content-type': 'application/json',
        },
      });

      expect(scrubbed.errorMessage).not.toContain(secret);
      expect(String(scrubbed.errorMessage)).toContain('apikey=<redacted>');
      expect(scrubbed.requestHeaders).toEqual({
        Authorization: 'Bearer <redacted>',
        'x-api_key': '<redacted>',
        'content-type': 'application/json',
      });
    });

    it('redacts a URL embedded in a JSON body field that is not itself named like a secret', () => {
      const scrubbed = scrubNetworkEvent({
        requestBodyPreview: JSON.stringify({
          url: 'https://maps.example.com/json?key=AIzaSecret&q=paris',
          author: 'ada',
          password: 'hunter2',
        }),
      });
      const body = String(scrubbed.requestBodyPreview);
      expect(body).not.toContain('AIzaSecret');
      expect(body).not.toContain('hunter2');
      expect(body).toContain('author');
      expect(body).toContain('ada');
      expect(body).toContain('key=<redacted>');
    });

    it('does not redact an author field', () => {
      expect(scrubObjectSecrets({ author: 'ada', title: 'notes' })).toEqual({
        author: 'ada',
        title: 'notes',
      });
    });
  });
});
