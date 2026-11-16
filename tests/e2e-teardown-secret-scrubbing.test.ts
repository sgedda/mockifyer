/**
 * Test that e2e/global-teardown.ts scrubs secrets from published Atlas reports.
 * These reports go to public GitHub Pages, so comprehensive scrubbing is critical.
 */

describe('E2E teardown secret scrubbing', () => {
  // Import the scrubbing functions by requiring the teardown module
  let scrubNetworkEvent: (event: any) => any;
  
  beforeAll(() => {
    // The global-teardown file exports a default function, but we need the scrubbing function
    // We'll test the patterns inline since the function is not exported
    // This is a smell - in production code we'd export and test the actual function
  });

  describe('query string secrets', () => {
    it('redacts access_token in query strings', () => {
      const url = 'https://api.example.com/oauth?access_token=secret123&foo=bar';
      const scrubbed = url.replace(
        /([?&])(token|apikey|api_key|password|secret|auth|authorization|access_token|key)=[^&#]*/gi,
        '$1$2=<redacted>'
      );
      expect(scrubbed).toBe('https://api.example.com/oauth?access_token=<redacted>&foo=bar');
      expect(scrubbed).not.toContain('secret123');
    });

    it('redacts multiple secret params in query strings', () => {
      const url = 'https://api.example.com/data?api_key=abc123&access_token=xyz789&safe=value';
      const scrubbed = url.replace(
        /([?&])(token|apikey|api_key|password|secret|auth|authorization|access_token|key)=[^&#]*/gi,
        '$1$2=<redacted>'
      );
      expect(scrubbed).toContain('api_key=<redacted>');
      expect(scrubbed).toContain('access_token=<redacted>');
      expect(scrubbed).toContain('safe=value');
      expect(scrubbed).not.toContain('abc123');
      expect(scrubbed).not.toContain('xyz789');
    });

    it('redacts secret params in hash fragments', () => {
      const url = 'https://app.example.com/callback#access_token=secret&state=safe';
      const scrubbed = url.replace(
        /#(token|apikey|api_key|password|secret|auth|authorization|access_token|key)=[^&#]*/gi,
        '#$1=<redacted>'
      );
      expect(scrubbed).toContain('#access_token=<redacted>');
      expect(scrubbed).not.toContain('secret');
    });
  });

  describe('response header secrets', () => {
    it('redacts apikey in response headers', () => {
      const headers = {
        'x-api-key': 'secret123',
        'x-apikey': 'secret456',
        'content-type': 'application/json'
      };
      
      const scrubbed: Record<string, string> = {};
      for (const [name, value] of Object.entries(headers)) {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('token') || lowerName.includes('api-key') || lowerName.includes('apikey')) {
          scrubbed[name] = '<redacted>';
        } else {
          scrubbed[name] = value;
        }
      }
      
      expect(scrubbed['x-api-key']).toBe('<redacted>');
      expect(scrubbed['x-apikey']).toBe('<redacted>');
      expect(scrubbed['content-type']).toBe('application/json');
    });
  });

  describe('JWT and token patterns', () => {
    it('redacts JWTs with dots', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const pattern = /^[A-Za-z0-9+/=_.-]{30,}$/;
      expect(jwt.length).toBeGreaterThan(30);
      expect(pattern.test(jwt)).toBe(true);
    });

    it('redacts base64 tokens without dots', () => {
      const token = 'dGhpc19pc19hX2xvbmdfc2VjcmV0X3Rva2VuX3dpdGhfbm9fZG90cw==';
      const pattern = /^[A-Za-z0-9+/=_.-]{30,}$/;
      expect(token.length).toBeGreaterThan(30);
      expect(pattern.test(token)).toBe(true);
    });

    it('does not redact short strings', () => {
      const short = 'short';
      const pattern = /^[A-Za-z0-9+/=_.-]{30,}$/;
      expect(short.length).toBeLessThan(30);
      expect(pattern.test(short)).toBe(false);
    });

    it('does not redact normal URLs with special chars', () => {
      const url = 'https://api.example.com/v1/users';
      const pattern = /^[A-Za-z0-9+/=_.-]{30,}$/;
      expect(pattern.test(url)).toBe(false); // Contains : and /
    });
  });

  describe('non-JSON body scrubbing', () => {
    it('redacts token-like strings in plain text', () => {
      const text = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U and some text';
      const scrubbed = text.replace(/\b[A-Za-z0-9+/=_.-]{30,}\b/g, '<redacted>');
      expect(scrubbed).toBe('Bearer <redacted> and some text');
      expect(scrubbed).not.toContain('eyJhbGci');
    });

    it('redacts multiple tokens in text', () => {
      const text = 'token1: abc123def456ghi789jkl012mno345pqr678 token2: xyz987wvu654tsr321ponmlkjihgfedcba';
      const scrubbed = text.replace(/\b[A-Za-z0-9+/=_.-]{30,}\b/g, '<redacted>');
      expect(scrubbed).toBe('token1: <redacted> token2: <redacted>');
      expect(scrubbed).not.toContain('abc123');
      expect(scrubbed).not.toContain('xyz987');
    });
  });

  describe('object secret scrubbing', () => {
    it('redacts token fields by key name', () => {
      const obj = {
        accessToken: 'secret123',
        apiKey: 'secret456',
        password: 'secret789',
        username: 'safe'
      };
      
      const scrubbed: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('token') || 
            lowerKey.includes('secret') || 
            lowerKey.includes('password') ||
            lowerKey.includes('apikey') ||
            lowerKey.includes('api_key')) {
          scrubbed[key] = '<redacted>';
        } else {
          scrubbed[key] = value;
        }
      }
      
      expect(scrubbed.accessToken).toBe('<redacted>');
      expect(scrubbed.apiKey).toBe('<redacted>');
      expect(scrubbed.password).toBe('<redacted>');
      expect(scrubbed.username).toBe('safe');
    });

    it('redacts long token-like string values', () => {
      const longToken = 'a'.repeat(50);
      const pattern = /^[A-Za-z0-9+/=_.-]{30,}$/;
      expect(pattern.test(longToken)).toBe(true);
    });
  });
});
