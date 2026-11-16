import {
  detectAuthFromTraffic,
  detectAuthFromCode,
  redactAuthValue,
  generateHostAuthSummary,
  generateSecuritySchemes,
  type AuthScheme
} from '../packages/mockifyer-core/src/utils/atlas-auth-detection';
import type { NetworkEvent } from '../packages/mockifyer-core/src/utils/network-event-types';
import type { ScannedEndpoint } from '../packages/mockifyer-core/src/utils/atlas-code-scanner';

describe('atlas-auth-detection', () => {
  describe('redactAuthValue', () => {
    it('should redact Bearer tokens', () => {
      const result = redactAuthValue('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdef');
      expect(result).toBe('Bearer [redacted]');
      expect(result).not.toContain('eyJhbGciOi');
    });

    it('should redact Basic auth', () => {
      const result = redactAuthValue('Basic dXNlcm5hbWU6cGFzc3dvcmQ=');
      expect(result).toBe('Basic [redacted]');
      expect(result).not.toContain('dXNlcm5hbWU');
    });

    it('should redact OAuth tokens', () => {
      const result = redactAuthValue('OAuth abc123def456');
      expect(result).toBe('OAuth [redacted]');
    });

    it('should redact long API keys', () => {
      const result = redactAuthValue('sk_live_1234567890abcdefghijklmnop');
      expect(result).toBe('sk_l...[redacted]');
      expect(result).not.toContain('1234567890');
    });

    it('should never expose full values', () => {
      const secret = 'super-secret-api-key-123';
      const result = redactAuthValue(secret);
      expect(result).not.toContain('secret-api-key');
      expect(result).toContain('[redacted]');
    });

    it('should handle empty values', () => {
      expect(redactAuthValue('')).toBe('[empty]');
    });
  });

  describe('detectAuthFromTraffic', () => {
    it('should detect Bearer token from Authorization header', () => {
      const events: NetworkEvent[] = [{
        id: '1',
        timestamp: '2024-01-01T00:00:00Z',
        scenario: 'test',
        transport: 'axios' as const,
        method: 'GET',
        url: 'https://api.example.com/users',
        source: 'upstream' as const,
        requestHeaders: {
          'authorization': 'Bearer eyJhbGciOiJIUzI1NiJ9...'
        }
      }];

      const result = detectAuthFromTraffic(events);
      const auth = result.get('api.example.com::GET::/users');
      
      expect(auth).toBeDefined();
      expect(auth!.scheme).toBe('bearer');
      expect(auth!.observedInTraffic).toBe(true);
    });

    it('should detect API key from custom header', () => {
      const events: NetworkEvent[] = [{
        id: '1',
        timestamp: '2024-01-01T00:00:00Z',
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'GET',
        url: 'https://api.example.com/data',
        source: 'upstream' as const,
        requestHeaders: {
          'x-api-key': 'sk_test_123456'
        }
      }];

      const result = detectAuthFromTraffic(events);
      const auth = result.get('api.example.com::GET::/data');
      
      expect(auth!.scheme).toBe('api-key');
    });

    it('should detect Basic auth', () => {
      const events: NetworkEvent[] = [{
        id: '1',
        timestamp: '2024-01-01T00:00:00Z',
        scenario: 'test',
        transport: 'axios' as const,
        method: 'GET',
        url: 'https://api.example.com/auth',
        source: 'upstream' as const,
        requestHeaders: {
          'authorization': 'Basic dXNlcjpwYXNz'
        }
      }];

      const result = detectAuthFromTraffic(events);
      expect(result.get('api.example.com::GET::/auth')!.scheme).toBe('basic');
    });

    it('should detect cookie-based auth', () => {
      const events: NetworkEvent[] = [{
        id: '1',
        timestamp: '2024-01-01T00:00:00Z',
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'GET',
        url: 'https://app.example.com/dashboard',
        source: 'upstream' as const,
        requestHeaders: {
          'cookie': 'sessionid=abc123; path=/'
        }
      }];

      const result = detectAuthFromTraffic(events);
      expect(result.get('app.example.com::GET::/dashboard')!.scheme).toBe('cookie');
    });

    it('should track auth failures (401/403)', () => {
      const events: NetworkEvent[] = [
        {
          id: '1',
          timestamp: '2024-01-01T00:00:00Z',
          scenario: 'test',
          transport: 'axios' as const,
          method: 'GET',
          url: 'https://api.example.com/protected',
          source: 'upstream' as const,
          status: 401
        },
        {
          id: '2',
          timestamp: '2024-01-01T00:00:01Z',
          scenario: 'test',
          transport: 'axios' as const,
          method: 'GET',
          url: 'https://api.example.com/protected',
          source: 'upstream' as const,
          status: 403
        }
      ];

      const result = detectAuthFromTraffic(events);
      const auth = result.get('api.example.com::GET::/protected');
      
      expect(auth!.authFailures).toBe(2);
      expect(auth!.scheme).toBe('unknown'); // No auth sent but failures indicate auth needed
    });

    it('should parse WWW-Authenticate challenge header', () => {
      const events: NetworkEvent[] = [{
        id: '1',
        timestamp: '2024-01-01T00:00:00Z',
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'GET',
        url: 'https://api.example.com/secure',
        source: 'upstream' as const,
        status: 401,
        responseHeaders: {
          'www-authenticate': 'Bearer realm="api", charset="UTF-8"'
        }
      }];

      const result = detectAuthFromTraffic(events);
      const auth = result.get('api.example.com::GET::/secure');
      
      expect(auth!.challengeSchemes).toContain('bearer');
    });

    it('should detect auth flow (preceded by login)', () => {
      const events: NetworkEvent[] = [
        {
          id: '1',
          timestamp: '2024-01-01T00:00:00Z',
          scenario: 'test',
          transport: 'axios' as const,
          method: 'POST',
          url: 'https://api.example.com/auth/login',
          source: 'upstream' as const,
          requestId: 'req1',
          status: 200
        },
        {
          id: '2',
          timestamp: '2024-01-01T00:00:01Z',
          scenario: 'test',
          transport: 'axios' as const,
          method: 'GET',
          url: 'https://api.example.com/user/profile',
          source: 'upstream' as const,
          requestId: 'req2',
          parentRequestId: 'req1',
          status: 200
        }
      ];

      const result = detectAuthFromTraffic(events);
      const auth = result.get('api.example.com::GET::/user/profile');
      
      expect(auth!.precededByAuthFlow).toBe(true);
    });

    it('should mark endpoint as none when no auth detected', () => {
      const events: NetworkEvent[] = [{
        id: '1',
        timestamp: '2024-01-01T00:00:00Z',
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'GET',
        url: 'https://api.example.com/public',
        source: 'upstream' as const,
        status: 200
      }];

      const result = detectAuthFromTraffic(events);
      expect(result.get('api.example.com::GET::/public')!.scheme).toBe('none');
    });
  });

  describe('detectAuthFromCode', () => {
    const mockEndpoint: ScannedEndpoint = {
      method: 'GET',
      urlTemplate: '/users',
      filePath: '/src/api.ts',
      line: 10,
      column: 5,
      callType: 'axios',
      resolvedUrl: 'https://api.example.com/users'
    };

    it('should detect Bearer token from env var', () => {
      const code = `
        const token = process.env.API_TOKEN;
        
        axios.get('/users', {
          headers: {
            authorization: \`Bearer \${process.env.API_TOKEN}\`
          }
        });
      `;

      const sources = detectAuthFromCode(mockEndpoint, code);
      
      expect(sources.length).toBeGreaterThan(0);
      // Should detect Bearer pattern even if variable reference is complex
      const hasAuth = sources.some(s => s.sourceType === 'env' || s.identifier?.includes('Bearer'));
      expect(hasAuth).toBe(true);
    });

    it('should detect API key from env var', () => {
      const code = `
        axios.get('/data', {
          headers: {
            'x-api-key': process.env.WEATHER_API_KEY
          }
        });
      `;

      const sources = detectAuthFromCode(mockEndpoint, code);
      
      const envSource = sources.find(s => s.identifier === 'WEATHER_API_KEY');
      expect(envSource).toBeDefined();
      expect(envSource!.sourceType).toBe('env');
    });

    it('should detect credentials: include', () => {
      const code = `
        fetch('/api/data', {
          credentials: 'include'
        });
      `;

      const sources = detectAuthFromCode(mockEndpoint, code);
      
      const credSource = sources.find(s => s.identifier === 'credentials: include');
      expect(credSource).toBeDefined();
      expect(credSource!.sourceType).toBe('config');
    });

    it('should detect API key in query params', () => {
      const code = `
        const url = \`https://api.example.com/data?api_key=\${process.env.KEY}\`;
        fetch(url);
      `;

      const sources = detectAuthFromCode(mockEndpoint, code);
      
      const querySource = sources.find(s => s.identifier === 'API key query param');
      expect(querySource).toBeDefined();
    });

    it('should never expose secret values in sources', () => {
      const code = `
        const apiKey = 'sk_live_super_secret_key_12345';
        axios.get('/data', {
          headers: { 'x-api-key': apiKey }
        });
      `;

      const sources = detectAuthFromCode(mockEndpoint, code);
      
      // Should detect the pattern but never store the actual key
      for (const source of sources) {
        expect(source.identifier).not.toContain('super_secret_key');
        expect(source.identifier).not.toContain('sk_live');
      }
    });

    it('should handle multiple auth headers', () => {
      const code = `
        axios.get('/data', {
          headers: {
            'authorization': \`Bearer \${process.env.TOKEN}\`,
            'x-api-key': process.env.API_KEY
          }
        });
      `;

      const sources = detectAuthFromCode(mockEndpoint, code);
      
      expect(sources.length).toBeGreaterThanOrEqual(1);
      // Should detect at least one of the auth methods
      const hasAuth = sources.some(s => 
        s.identifier === 'TOKEN' || 
        s.identifier === 'API_KEY' ||
        s.identifier?.includes('Bearer') ||
        s.sourceType === 'env'
      );
      expect(hasAuth).toBe(true);
    });
  });

  describe('generateHostAuthSummary', () => {
    it('should determine primary scheme as bearer when present', () => {
      const endpoints = [
        { auth: { scheme: 'bearer' as AuthScheme, staticSources: [], observedInTraffic: true, authFailures: 0, challengeSchemes: [], precededByAuthFlow: false } },
        { auth: { scheme: 'api-key' as AuthScheme, staticSources: [], observedInTraffic: true, authFailures: 0, challengeSchemes: [], precededByAuthFlow: false } }
      ];

      const summary = generateHostAuthSummary('api.example.com', endpoints);
      
      expect(summary.primaryScheme).toBe('bearer');
      expect(summary.schemes).toContain('bearer');
      expect(summary.schemes).toContain('api-key');
      expect(summary.requiresAuth).toBe(true);
    });

    it('should prefer api-key when bearer not present', () => {
      const endpoints = [
        { auth: { scheme: 'api-key' as AuthScheme, staticSources: [], observedInTraffic: true, authFailures: 0, challengeSchemes: [], precededByAuthFlow: false } },
        { auth: { scheme: 'cookie' as AuthScheme, staticSources: [], observedInTraffic: true, authFailures: 0, challengeSchemes: [], precededByAuthFlow: false } }
      ];

      const summary = generateHostAuthSummary('api.example.com', endpoints);
      expect(summary.primaryScheme).toBe('api-key');
    });

    it('should mark as no auth when all endpoints are none', () => {
      const endpoints = [
        { auth: { scheme: 'none' as AuthScheme, staticSources: [], observedInTraffic: false, authFailures: 0, challengeSchemes: [], precededByAuthFlow: false } }
      ];

      const summary = generateHostAuthSummary('api.example.com', endpoints);
      expect(summary.requiresAuth).toBe(false);
      expect(summary.primaryScheme).toBe('none');
    });
  });

  describe('generateSecuritySchemes', () => {
    it('should generate OpenAPI securitySchemes', () => {
      const summaries = [
        {
          host: 'api.example.com',
          primaryScheme: 'bearer' as AuthScheme,
          schemes: ['bearer' as AuthScheme],
          authSources: [],
          requiresAuth: true
        },
        {
          host: 'v3.football.api-sports.io',
          primaryScheme: 'api-key' as AuthScheme,
          schemes: ['api-key' as AuthScheme],
          authSources: [{ sourceType: 'env' as const, identifier: 'X-API-KEY' }],
          requiresAuth: true
        }
      ];

      const schemes = generateSecuritySchemes(summaries);
      
      expect(schemes['api_example_com_bearer']).toBeDefined();
      expect(schemes['api_example_com_bearer']).toEqual({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      });
      
      expect(schemes['v3_football_api_sports_io_apiKey']).toBeDefined();
      expect(schemes['v3_football_api_sports_io_apiKey']).toMatchObject({
        type: 'apiKey',
        in: 'header'
      });
    });

    it('should skip hosts without auth', () => {
      const summaries = [{
        host: 'public-api.com',
        primaryScheme: 'none' as AuthScheme,
        schemes: [],
        authSources: [],
        requiresAuth: false
      }];

      const schemes = generateSecuritySchemes(summaries);
      expect(Object.keys(schemes).length).toBe(0);
    });

    it('should handle Basic auth', () => {
      const summaries = [{
        host: 'api.example.com',
        primaryScheme: 'basic' as AuthScheme,
        schemes: ['basic' as AuthScheme],
        authSources: [],
        requiresAuth: true
      }];

      const schemes = generateSecuritySchemes(summaries);
      expect(schemes['api_example_com_basic']).toEqual({
        type: 'http',
        scheme: 'basic'
      });
    });
  });
});
