/**
 * Test that e2e/global-teardown.ts scrubs secrets from published Atlas reports.
 * These reports go to public GitHub Pages, so the real scrubber is what must pass.
 */

import { scrubNetworkEvent } from '../e2e/lib/scrub-public-atlas';

describe('E2E teardown secret scrubbing', () => {
  it('redacts access_token and api_key in query strings', () => {
    const scrubbed = scrubNetworkEvent({
      url: 'https://api.example.com/oauth?access_token=secret123&api_key=abc123&safe=value',
    });
    expect(scrubbed.url).toContain('access_token=<redacted>');
    expect(scrubbed.url).toContain('api_key=<redacted>');
    expect(scrubbed.url).toContain('safe=value');
    expect(scrubbed.url).not.toContain('secret123');
    expect(scrubbed.url).not.toContain('abc123');
  });

  it('redacts secret params in hash fragments', () => {
    const scrubbed = scrubNetworkEvent({
      url: 'https://app.example.com/callback#access_token=secret&state=safe',
    });
    expect(String(scrubbed.url)).toContain('#access_token=<redacted>');
    expect(String(scrubbed.url)).toContain('state=safe');
    expect(String(scrubbed.url)).not.toContain('=secret');
  });

  it('redacts apikey response headers and leaves content-type', () => {
    const scrubbed = scrubNetworkEvent({
      responseHeaders: {
        'x-api-key': 'secret123',
        'x-apikey': 'secret456',
        'content-type': 'application/json',
      },
    });
    const headers = scrubbed.responseHeaders as Record<string, string>;
    expect(headers['x-api-key']).toBe('<redacted>');
    expect(headers['x-apikey']).toBe('<redacted>');
    expect(headers['content-type']).toBe('application/json');
  });

  it('redacts JWTs in JSON string values and in plain text bodies', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const jsonScrubbed = scrubNetworkEvent({
      responseBodyPreview: JSON.stringify({ note: jwt, username: 'safe' }),
    });
    expect(String(jsonScrubbed.responseBodyPreview)).not.toContain(jwt);
    expect(String(jsonScrubbed.responseBodyPreview)).toContain('safe');

    const textScrubbed = scrubNetworkEvent({
      requestBodyPreview: `Bearer ${jwt} and some text`,
    });
    expect(String(textScrubbed.requestBodyPreview)).toBe('Bearer <redacted> and some text');
  });

  it('redacts token fields by key name and keeps username', () => {
    const scrubbed = scrubNetworkEvent({
      responseBodyPreview: JSON.stringify({
        accessToken: 'secret123',
        apiKey: 'secret456',
        password: 'secret789',
        username: 'safe',
      }),
    });
    const body = JSON.parse(String(scrubbed.responseBodyPreview));
    expect(body.accessToken).toBe('<redacted>');
    expect(body.apiKey).toBe('<redacted>');
    expect(body.password).toBe('<redacted>');
    expect(body.username).toBe('safe');
  });

  it('redacts a query string stored without a leading question mark', () => {
    const scrubbed = scrubNetworkEvent({
      query: 'apikey=secret123&limit=6',
    });
    expect(scrubbed.query).toBe('apikey=<redacted>&limit=6');
  });

  it('redacts stack traces that include a bearer token and a signed URL', () => {
    const scrubbed = scrubNetworkEvent({
      stackPreview:
        'Error: GET https://api.example.com/v1?access-token=supersecret\n    at call (Authorization: Bearer ww_u-wanderer_1)',
    });
    expect(String(scrubbed.stackPreview)).not.toContain('supersecret');
    expect(String(scrubbed.stackPreview)).not.toContain('ww_u-wanderer_1');
    expect(String(scrubbed.stackPreview)).toContain('access-token=<redacted>');
    expect(String(scrubbed.stackPreview)).toContain('Bearer <redacted>');
  });
});
