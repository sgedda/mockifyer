/**
 * Test Atlas network event scrubbing for public Pages publishing.
 * Ensures sensitive data (auth headers, cookies, tokens) is redacted.
 */

describe('Atlas network event scrubbing', () => {
  // Inline the scrubbing functions from global-teardown
  function scrubObjectSecrets(obj: unknown): unknown {
    if (obj === null || obj === undefined) return obj;
    
    if (typeof obj === 'string') {
      if (obj.length > 30 && /^[A-Za-z0-9+/=_-]{30,}$/.test(obj)) {
        return '<redacted>';
      }
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => scrubObjectSecrets(item));
    }
    
    if (typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('token') || 
            lowerKey.includes('secret') || 
            lowerKey.includes('password') ||
            lowerKey.includes('apikey') ||
            lowerKey.includes('api_key')) {
          result[key] = '<redacted>';
        } else {
          result[key] = scrubObjectSecrets(value);
        }
      }
      return result;
    }
    
    return obj;
  }

  function scrubNetworkEvent(event: any): any {
    const scrubbed = { ...event };
    
    if (scrubbed.requestHeaders) {
      const headers: Record<string, string> = {};
      for (const [name, value] of Object.entries(scrubbed.requestHeaders as Record<string, string>)) {
        const lowerName = name.toLowerCase();
        if (lowerName === 'authorization') {
          headers[name] = value.toLowerCase().startsWith('bearer ') ? 'Bearer <redacted>' : '<redacted>';
        } else if (lowerName === 'cookie' || lowerName === 'set-cookie') {
          headers[name] = '<redacted>';
        } else if (lowerName.includes('token') || lowerName.includes('api-key') || lowerName.includes('apikey')) {
          headers[name] = '<redacted>';
        } else {
          headers[name] = value;
        }
      }
      scrubbed.requestHeaders = headers;
    }
    
    if (scrubbed.responseHeaders) {
      const headers: Record<string, string> = {};
      for (const [name, value] of Object.entries(scrubbed.responseHeaders as Record<string, string>)) {
        const lowerName = name.toLowerCase();
        if (lowerName === 'set-cookie' || lowerName === 'cookie') {
          headers[name] = '<redacted>';
        } else if (lowerName.includes('token') || lowerName.includes('api-key')) {
          headers[name] = '<redacted>';
        } else {
          headers[name] = value;
        }
      }
      scrubbed.responseHeaders = headers;
    }
    
    if (scrubbed.requestBodyPreview) {
      try {
        const body = typeof scrubbed.requestBodyPreview === 'string' 
          ? JSON.parse(scrubbed.requestBodyPreview) 
          : scrubbed.requestBodyPreview;
        scrubbed.requestBodyPreview = JSON.stringify(scrubObjectSecrets(body));
      } catch {
        // Not JSON, leave as-is
      }
    }
    
    if (scrubbed.responseBodyPreview) {
      try {
        const body = typeof scrubbed.responseBodyPreview === 'string'
          ? JSON.parse(scrubbed.responseBodyPreview)
          : scrubbed.responseBodyPreview;
        scrubbed.responseBodyPreview = JSON.stringify(scrubObjectSecrets(body));
      } catch {
        // Not JSON, leave as-is
      }
    }
    
    return scrubbed;
  }

  test('redacts Authorization header', () => {
    const event = {
      requestHeaders: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc',
        'Content-Type': 'application/json'
      }
    };
    const scrubbed = scrubNetworkEvent(event);
    expect(scrubbed.requestHeaders['Authorization']).toBe('Bearer <redacted>');
    expect(scrubbed.requestHeaders['Content-Type']).toBe('application/json');
  });

  test('redacts Cookie header', () => {
    const event = {
      requestHeaders: {
        'Cookie': 'session=abc123; userId=456'
      }
    };
    const scrubbed = scrubNetworkEvent(event);
    expect(scrubbed.requestHeaders['Cookie']).toBe('<redacted>');
  });

  test('redacts Set-Cookie response header', () => {
    const event = {
      responseHeaders: {
        'Set-Cookie': 'session=xyz789; HttpOnly; Secure'
      }
    };
    const scrubbed = scrubNetworkEvent(event);
    expect(scrubbed.responseHeaders['Set-Cookie']).toBe('<redacted>');
  });

  test('redacts X-API-Key header', () => {
    const event = {
      requestHeaders: {
        'X-API-Key': 'sk_live_abc123def456'
      }
    };
    const scrubbed = scrubNetworkEvent(event);
    expect(scrubbed.requestHeaders['X-API-Key']).toBe('<redacted>');
  });

  test('redacts token fields in request body', () => {
    const event = {
      requestBodyPreview: JSON.stringify({
        username: 'alice',
        apiKey: 'sk_live_123456',
        password: 'secret123'
      })
    };
    const scrubbed = scrubNetworkEvent(event);
    const body = JSON.parse(scrubbed.requestBodyPreview);
    expect(body.username).toBe('alice');
    expect(body.apiKey).toBe('<redacted>');
    expect(body.password).toBe('<redacted>');
  });

  test('redacts token fields in response body', () => {
    const event = {
      responseBodyPreview: JSON.stringify({
        user: { id: 1, name: 'Alice' },
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def',
        refreshToken: 'xyz789'
      })
    };
    const scrubbed = scrubNetworkEvent(event);
    const body = JSON.parse(scrubbed.responseBodyPreview);
    expect(body.user.name).toBe('Alice');
    expect(body.accessToken).toBe('<redacted>');
    expect(body.refreshToken).toBe('<redacted>');
  });

  test('redacts long token-like strings', () => {
    const event = {
      responseBodyPreview: JSON.stringify({
        data: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
      })
    };
    const scrubbed = scrubNetworkEvent(event);
    const body = JSON.parse(scrubbed.responseBodyPreview);
    expect(body.data).toBe('<redacted>');
  });

  test('preserves non-sensitive headers', () => {
    const event = {
      requestHeaders: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      }
    };
    const scrubbed = scrubNetworkEvent(event);
    expect(scrubbed.requestHeaders).toEqual(event.requestHeaders);
  });

  test('handles nested objects in body', () => {
    const event = {
      requestBodyPreview: JSON.stringify({
        user: {
          profile: {
            name: 'Bob',
            secret: 'should-be-redacted'
          },
          auth: {
            token: 'abc123'
          }
        }
      })
    };
    const scrubbed = scrubNetworkEvent(event);
    const body = JSON.parse(scrubbed.requestBodyPreview);
    expect(body.user.profile.name).toBe('Bob');
    expect(body.user.profile.secret).toBe('<redacted>');
    expect(body.user.auth.token).toBe('<redacted>');
  });
});
