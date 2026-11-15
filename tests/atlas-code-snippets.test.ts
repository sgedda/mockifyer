import {
  generateCurlSnippet,
  generateFetchSnippet,
  generateAxiosSnippet,
  generateEndpointSnippets,
  snippetContainsSecrets,
  type SnippetOptions
} from '../packages/mockifyer-core/src/utils/atlas-code-snippets';
import type { NetworkEvent } from '../packages/mockifyer-core/src/utils/network-event-types';
import type { EndpointAuthInfo } from '../packages/mockifyer-core/src/utils/atlas-auth-detection';

describe('atlas-code-snippets', () => {
  const REAL_API_KEY = 'sk_live_a1b2c3d4e5f6g7h8i9j0';
  const REAL_BEARER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  
  describe('generateCurlSnippet', () => {
    it('should generate basic GET request', () => {
      const options: SnippetOptions = {
        method: 'GET',
        url: 'https://api.example.com/users'
      };
      
      const curl = generateCurlSnippet(options);
      
      expect(curl).toContain("curl -X GET");
      expect(curl).toContain('https://api.example.com/users');
    });

    it('should include headers', () => {
      const options: SnippetOptions = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: {
          'accept': 'application/json'
        }
      };
      
      const curl = generateCurlSnippet(options);
      
      expect(curl).toContain("-H 'accept: application/json'");
    });

    it('should redact Bearer token', () => {
      const options: SnippetOptions = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: {
          'authorization': `Bearer ${REAL_BEARER_TOKEN}`
        }
      };
      
      const curl = generateCurlSnippet(options);
      
      expect(curl).not.toContain(REAL_BEARER_TOKEN);
      expect(curl).toContain('Bearer <token>');
    });

    it('should use env var name when available', () => {
      const auth: EndpointAuthInfo = {
        scheme: 'bearer',
        staticSources: [{ sourceType: 'env', identifier: 'API_TOKEN' }],
        observedInTraffic: true,
        authFailures: 0,
        challengeSchemes: [],
        precededByAuthFlow: false
      };
      
      const options: SnippetOptions = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: {
          'authorization': `Bearer ${REAL_BEARER_TOKEN}`
        },
        auth
      };
      
      const curl = generateCurlSnippet(options);
      
      expect(curl).not.toContain(REAL_BEARER_TOKEN);
      expect(curl).toContain('Bearer $API_TOKEN');
    });

    it('should redact API keys', () => {
      const options: SnippetOptions = {
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: {
          'x-api-key': REAL_API_KEY
        }
      };
      
      const curl = generateCurlSnippet(options);
      
      expect(curl).not.toContain(REAL_API_KEY);
      expect(curl).toContain('<api-key>');
    });

    it('should use env var for API key when available', () => {
      const auth: EndpointAuthInfo = {
        scheme: 'api-key',
        staticSources: [{ sourceType: 'env', identifier: 'WEATHER_API_KEY' }],
        observedInTraffic: true,
        authFailures: 0,
        challengeSchemes: [],
        precededByAuthFlow: false
      };
      
      const options: SnippetOptions = {
        method: 'GET',
        url: 'https://api.example.com/weather',
        headers: {
          'x-api-key': REAL_API_KEY
        },
        auth
      };
      
      const curl = generateCurlSnippet(options);
      
      expect(curl).not.toContain(REAL_API_KEY);
      expect(curl).toContain('$WEATHER_API_KEY');
    });

    it('should include request body for POST', () => {
      const options: SnippetOptions = {
        method: 'POST',
        url: 'https://api.example.com/users',
        headers: {
          'content-type': 'application/json'
        },
        body: { name: 'John Doe', email: 'john@example.com' }
      };
      
      const curl = generateCurlSnippet(options);
      
      expect(curl).toContain('-d');
      expect(curl).toContain('John Doe');
      expect(curl).toContain('john@example.com');
    });

    it('should exclude internal headers', () => {
      const options: SnippetOptions = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: {
          'host': 'api.example.com',
          'content-length': '123',
          'user-agent': 'axios/1.0',
          'accept': 'application/json'
        }
      };
      
      const curl = generateCurlSnippet(options);
      
      expect(curl).not.toContain('host:');
      expect(curl).not.toContain('content-length:');
      expect(curl).not.toContain('user-agent:');
      expect(curl).toContain('accept: application/json');
    });
  });

  describe('generateFetchSnippet', () => {
    it('should generate basic fetch request', () => {
      const options: SnippetOptions = {
        method: 'GET',
        url: 'https://api.example.com/users'
      };
      
      const fetch = generateFetchSnippet(options);
      
      expect(fetch).toContain("await fetch('https://api.example.com/users'");
      expect(fetch).toContain('GET');
      expect(fetch).toContain('method');
      expect(fetch).toContain('await response.json()');
    });

    it('should redact auth headers', () => {
      const options: SnippetOptions = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: {
          'authorization': `Bearer ${REAL_BEARER_TOKEN}`
        }
      };
      
      const fetch = generateFetchSnippet(options);
      
      expect(fetch).not.toContain(REAL_BEARER_TOKEN);
      expect(fetch).toContain('Bearer <token>');
    });

    it('should include JSON body for POST', () => {
      const options: SnippetOptions = {
        method: 'POST',
        url: 'https://api.example.com/users',
        body: { name: 'Alice' }
      };
      
      const fetch = generateFetchSnippet(options);
      
      expect(fetch).toContain('JSON.stringify');
      expect(fetch).toContain('name');
      expect(fetch).toContain('Alice');
      // Content-type is added automatically for JSON bodies
      expect(fetch.toLowerCase()).toContain('application/json');
    });
  });

  describe('generateAxiosSnippet', () => {
    it('should generate basic axios request', () => {
      const options: SnippetOptions = {
        method: 'GET',
        url: 'https://api.example.com/users'
      };
      
      const axios = generateAxiosSnippet(options);
      
      expect(axios).toContain('await axios.get');
      expect(axios).toContain('https://api.example.com/users');
    });

    it('should redact Bearer token in headers', () => {
      const auth: EndpointAuthInfo = {
        scheme: 'bearer',
        staticSources: [{ sourceType: 'env', identifier: 'AUTH_TOKEN' }],
        observedInTraffic: true,
        authFailures: 0,
        challengeSchemes: [],
        precededByAuthFlow: false
      };
      
      const options: SnippetOptions = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: {
          'authorization': `Bearer ${REAL_BEARER_TOKEN}`
        },
        auth
      };
      
      const axios = generateAxiosSnippet(options);
      
      expect(axios).not.toContain(REAL_BEARER_TOKEN);
      expect(axios).toContain('Bearer $AUTH_TOKEN');
    });

    it('should include body for POST with headers', () => {
      const options: SnippetOptions = {
        method: 'POST',
        url: 'https://api.example.com/users',
        headers: {
          'content-type': 'application/json'
        },
        body: { name: 'Bob' }
      };
      
      const axios = generateAxiosSnippet(options);
      
      expect(axios).toContain('await axios.post');
      expect(axios).toContain('name');
      expect(axios).toContain('Bob');
      expect(axios).toContain('headers');
    });
  });

  describe('generateEndpointSnippets', () => {
    it('should generate all snippet types', () => {
      const snippets = generateEndpointSnippets(
        'GET',
        'https://api.example.com/users'
      );
      
      expect(snippets.curl).toBeDefined();
      expect(snippets.fetch).toBeDefined();
      expect(snippets.axios).toBeDefined();
      
      expect(snippets.curl).toContain('curl');
      expect(snippets.fetch).toContain('fetch');
      expect(snippets.axios).toContain('axios');
    });

    it('should use real traffic example when available', () => {
      const events: NetworkEvent[] = [{
        id: '1',
        timestamp: '2024-01-01T00:00:00Z',
        scenario: 'test',
        transport: 'axios' as const,
        method: 'GET',
        url: 'https://api.example.com/users',
        source: 'upstream' as const,
        requestHeaders: {
          'accept': 'application/json',
          'x-custom-header': 'test-value'
        }
      }];
      
      const snippets = generateEndpointSnippets('GET', 'https://api.example.com/users', events);
      
      expect(snippets.curl).toContain('x-custom-header: test-value');
      expect(snippets.fetch).toContain('x-custom-header');
      expect(snippets.axios).toContain('x-custom-header');
    });

    it('should redact secrets from request bodies', () => {
      const events: NetworkEvent[] = [{
        id: '1',
        timestamp: '2024-01-01T00:00:00Z',
        scenario: 'test',
        transport: 'axios' as const,
        method: 'POST',
        url: 'https://api.example.com/auth',
        source: 'upstream' as const,
        requestBodyPreview: JSON.stringify({
          username: 'user@example.com',
          password: 'super-secret-password-123'
        })
      }];
      
      const snippets = generateEndpointSnippets('POST', 'https://api.example.com/auth', events);
      
      expect(snippets.curl).not.toContain('super-secret-password-123');
      expect(snippets.curl).toContain('<redacted>');
      expect(snippets.fetch).not.toContain('super-secret-password-123');
      expect(snippets.axios).not.toContain('super-secret-password-123');
    });

    it('should redact long token-like strings', () => {
      const events: NetworkEvent[] = [{
        id: '1',
        timestamp: '2024-01-01T00:00:00Z',
        scenario: 'test',
        transport: 'axios' as const,
        method: 'POST',
        url: 'https://api.example.com/webhook',
        source: 'upstream' as const,
        requestBodyPreview: JSON.stringify({
          webhookUrl: 'https://example.com/hook',
          secret: 'abcdefghijklmnopqrstuvwxyz1234567890'
        })
      }];
      
      const snippets = generateEndpointSnippets('POST', 'https://api.example.com/webhook', events);
      
      expect(snippets.curl).not.toContain('abcdefghijklmnopqrstuvwxyz1234567890');
      expect(snippets.fetch).not.toContain('abcdefghijklmnopqrstuvwxyz1234567890');
      expect(snippets.axios).not.toContain('abcdefghijklmnopqrstuvwxyz1234567890');
    });

    it('should use placeholder URL params for code-only endpoints', () => {
      const snippets = generateEndpointSnippets(
        'GET',
        'https://api.example.com/users/{id}'
      );
      
      expect(snippets.curl).toContain('{id}');
      expect(snippets.fetch).toContain('{id}');
      expect(snippets.axios).toContain('{id}');
    });
  });

  describe('snippetContainsSecrets', () => {
    it('should detect real API keys in snippets', () => {
      const snippet = `curl -X GET 'https://api.example.com/data' -H 'x-api-key: ${REAL_API_KEY}'`;
      
      const hasSecrets = snippetContainsSecrets(snippet, [REAL_API_KEY]);
      
      expect(hasSecrets).toBe(true);
    });

    it('should detect real Bearer tokens', () => {
      const snippet = `curl -X GET 'https://api.example.com/data' -H 'authorization: Bearer ${REAL_BEARER_TOKEN}'`;
      
      const hasSecrets = snippetContainsSecrets(snippet, [REAL_BEARER_TOKEN]);
      
      expect(hasSecrets).toBe(true);
    });

    it('should return false for properly redacted snippets', () => {
      const snippet = `curl -X GET 'https://api.example.com/data' -H 'x-api-key: $WEATHER_API_KEY'`;
      
      const hasSecrets = snippetContainsSecrets(snippet, [REAL_API_KEY, REAL_BEARER_TOKEN]);
      
      expect(hasSecrets).toBe(false);
    });

    it('should skip very short secrets', () => {
      const snippet = 'curl -X GET https://api.example.com -H "x-key: abc"';
      
      const hasSecrets = snippetContainsSecrets(snippet, ['abc']);
      
      expect(hasSecrets).toBe(false); // Too short to be considered a real secret
    });

    it('should detect secrets in JSON bodies', () => {
      const secret = 'my-webhook-secret-key-12345';
      const snippet = `curl -X POST 'https://api.example.com/hooks' -d '{"secret":"${secret}"}'`;
      
      const hasSecrets = snippetContainsSecrets(snippet, [secret]);
      
      expect(hasSecrets).toBe(true);
    });
  });

  describe('comprehensive redaction test', () => {
    it('should never leak real credentials in any snippet type', () => {
      const SECRETS = [
        REAL_API_KEY,
        REAL_BEARER_TOKEN,
        'password123',
        'super-secret-webhook-key',
        'sk_test_1234567890abcdef'
      ];
      
      const auth: EndpointAuthInfo = {
        scheme: 'bearer',
        staticSources: [{ sourceType: 'env', identifier: 'API_TOKEN' }],
        observedInTraffic: true,
        authFailures: 0,
        challengeSchemes: [],
        precededByAuthFlow: false
      };
      
      const events: NetworkEvent[] = [{
        id: '1',
        timestamp: '2024-01-01T00:00:00Z',
        scenario: 'test',
        transport: 'axios' as const,
        method: 'POST',
        url: 'https://api.example.com/users',
        source: 'upstream' as const,
        requestHeaders: {
          'authorization': `Bearer ${REAL_BEARER_TOKEN}`,
          'x-api-key': REAL_API_KEY
        },
        requestBodyPreview: JSON.stringify({
          name: 'Test User',
          apiKey: 'sk_test_1234567890abcdef',
          password: 'password123'
        })
      }];
      
      const snippets = generateEndpointSnippets('POST', 'https://api.example.com/users', events, auth);
      
      // Check all snippet types
      for (const [type, snippet] of Object.entries(snippets)) {
        for (const secret of SECRETS) {
          const leaked = snippetContainsSecrets(snippet, [secret]);
          expect(leaked).toBe(false);
          // Additional check: secret should not appear in snippet
          expect(snippet).not.toContain(secret);
        }
      }
      
      // Verify placeholders are present
      expect(snippets.curl).toMatch(/Bearer \$API_TOKEN|Bearer <token>/);
      expect(snippets.curl).toMatch(/<api-key>|\$[A-Z_]+/);
      expect(snippets.curl).toContain('<redacted>');
    });
  });
});
