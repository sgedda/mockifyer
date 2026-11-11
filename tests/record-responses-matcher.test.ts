import {
  urlMatchesRecordResponsesPatterns,
  resolveRecordResponsesConfig,
  shouldRecordResponseForUrl,
  type RecordResponsesPattern,
} from '../packages/mockifyer-core/src/utils/record-responses-matcher';
import { ENV_VARS } from '../packages/mockifyer-core/src/types';

describe('record-responses-matcher', () => {
  describe('urlMatchesRecordResponsesPatterns', () => {
    it('matches exact host', () => {
      const patterns: RecordResponsesPattern[] = ['api.example.com'];
      expect(urlMatchesRecordResponsesPatterns('https://api.example.com/users', patterns)).toBe(
        true
      );
      expect(
        urlMatchesRecordResponsesPatterns('https://api.example.com/users?id=1', patterns)
      ).toBe(true);
      expect(urlMatchesRecordResponsesPatterns('https://other.com/users', patterns)).toBe(false);
    });

    it('matches wildcard subdomain', () => {
      const patterns: RecordResponsesPattern[] = ['*.example.com'];
      expect(urlMatchesRecordResponsesPatterns('https://api.example.com/users', patterns)).toBe(
        true
      );
      expect(
        urlMatchesRecordResponsesPatterns('https://staging.example.com/users', patterns)
      ).toBe(true);
      expect(urlMatchesRecordResponsesPatterns('https://example.com/users', patterns)).toBe(
        true
      ); // Base domain matches
      expect(urlMatchesRecordResponsesPatterns('https://notexample.com/users', patterns)).toBe(
        false
      );
    });

    it('matches host + path glob', () => {
      const patterns: RecordResponsesPattern[] = ['api.example.com/v1/*'];
      expect(urlMatchesRecordResponsesPatterns('https://api.example.com/v1/users', patterns)).toBe(
        true
      );
      expect(
        urlMatchesRecordResponsesPatterns('https://api.example.com/v1/posts/123', patterns)
      ).toBe(true);
      expect(urlMatchesRecordResponsesPatterns('https://api.example.com/v2/users', patterns)).toBe(
        false
      );
      expect(urlMatchesRecordResponsesPatterns('https://api.example.com/users', patterns)).toBe(
        false
      );
    });

    it('matches RegExp pattern', () => {
      const patterns: RecordResponsesPattern[] = [/\/v2\/users/];
      expect(urlMatchesRecordResponsesPatterns('https://api.example.com/v2/users', patterns)).toBe(
        true
      );
      expect(
        urlMatchesRecordResponsesPatterns('https://staging.example.com/v2/users/123', patterns)
      ).toBe(true);
      expect(urlMatchesRecordResponsesPatterns('https://api.example.com/v1/users', patterns)).toBe(
        false
      );
    });

    it('matches when any pattern matches', () => {
      const patterns: RecordResponsesPattern[] = ['api.example.com', /staging/];
      expect(urlMatchesRecordResponsesPatterns('https://api.example.com/users', patterns)).toBe(
        true
      );
      expect(
        urlMatchesRecordResponsesPatterns('https://staging.other.com/users', patterns)
      ).toBe(true);
      expect(urlMatchesRecordResponsesPatterns('https://other.com/users', patterns)).toBe(false);
    });

    it('returns false for empty patterns', () => {
      expect(urlMatchesRecordResponsesPatterns('https://api.example.com/users', [])).toBe(false);
    });

    it('handles malformed URLs gracefully', () => {
      const patterns: RecordResponsesPattern[] = ['api.example.com'];
      expect(urlMatchesRecordResponsesPatterns('not-a-url', patterns)).toBe(false);
    });
  });

  describe('resolveRecordResponsesConfig', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('returns false by default', () => {
      delete process.env[ENV_VARS.MOCK_RECORD_RESPONSES];
      delete process.env[ENV_VARS.MOCK_RECORD_RESPONSES_FOR];
      expect(resolveRecordResponsesConfig(undefined)).toBe(false);
    });

    it('returns config boolean when set', () => {
      delete process.env[ENV_VARS.MOCK_RECORD_RESPONSES];
      delete process.env[ENV_VARS.MOCK_RECORD_RESPONSES_FOR];
      expect(resolveRecordResponsesConfig(true)).toBe(true);
      expect(resolveRecordResponsesConfig(false)).toBe(false);
    });

    it('returns config array when set', () => {
      delete process.env[ENV_VARS.MOCK_RECORD_RESPONSES];
      delete process.env[ENV_VARS.MOCK_RECORD_RESPONSES_FOR];
      const patterns = ['api.example.com', '*.staging.com'];
      expect(resolveRecordResponsesConfig(patterns)).toEqual(patterns);
    });

    it('env boolean overrides config', () => {
      process.env[ENV_VARS.MOCK_RECORD_RESPONSES] = 'true';
      delete process.env[ENV_VARS.MOCK_RECORD_RESPONSES_FOR];
      expect(resolveRecordResponsesConfig(['api.example.com'])).toBe(true);
      expect(resolveRecordResponsesConfig(false)).toBe(true);
    });

    it('env boolean false overrides config', () => {
      process.env[ENV_VARS.MOCK_RECORD_RESPONSES] = 'false';
      delete process.env[ENV_VARS.MOCK_RECORD_RESPONSES_FOR];
      expect(resolveRecordResponsesConfig(true)).toBe(false);
      expect(resolveRecordResponsesConfig(['api.example.com'])).toBe(false);
    });

    it('parses env boolean variants', () => {
      delete process.env[ENV_VARS.MOCK_RECORD_RESPONSES_FOR];

      process.env[ENV_VARS.MOCK_RECORD_RESPONSES] = '1';
      expect(resolveRecordResponsesConfig(undefined)).toBe(true);

      process.env[ENV_VARS.MOCK_RECORD_RESPONSES] = 'yes';
      expect(resolveRecordResponsesConfig(undefined)).toBe(true);

      process.env[ENV_VARS.MOCK_RECORD_RESPONSES] = 'on';
      expect(resolveRecordResponsesConfig(undefined)).toBe(true);

      process.env[ENV_VARS.MOCK_RECORD_RESPONSES] = '0';
      expect(resolveRecordResponsesConfig(undefined)).toBe(false);

      process.env[ENV_VARS.MOCK_RECORD_RESPONSES] = 'no';
      expect(resolveRecordResponsesConfig(undefined)).toBe(false);

      process.env[ENV_VARS.MOCK_RECORD_RESPONSES] = 'off';
      expect(resolveRecordResponsesConfig(undefined)).toBe(false);
    });

    it('env list overrides config when boolean env is unset', () => {
      delete process.env[ENV_VARS.MOCK_RECORD_RESPONSES];
      process.env[ENV_VARS.MOCK_RECORD_RESPONSES_FOR] = 'api.example.com,*.staging.com';
      expect(resolveRecordResponsesConfig(true)).toEqual(['api.example.com', '*.staging.com']);
      expect(resolveRecordResponsesConfig(false)).toEqual(['api.example.com', '*.staging.com']);
    });

    it('env boolean takes precedence over env list', () => {
      process.env[ENV_VARS.MOCK_RECORD_RESPONSES] = 'true';
      process.env[ENV_VARS.MOCK_RECORD_RESPONSES_FOR] = 'api.example.com';
      expect(resolveRecordResponsesConfig(undefined)).toBe(true);
    });

    it('parses comma-separated env list', () => {
      delete process.env[ENV_VARS.MOCK_RECORD_RESPONSES];
      process.env[ENV_VARS.MOCK_RECORD_RESPONSES_FOR] = 'api.example.com, *.staging.com, other.com';
      expect(resolveRecordResponsesConfig(undefined)).toEqual([
        'api.example.com',
        '*.staging.com',
        'other.com',
      ]);
    });

    it('handles empty env list', () => {
      delete process.env[ENV_VARS.MOCK_RECORD_RESPONSES];
      process.env[ENV_VARS.MOCK_RECORD_RESPONSES_FOR] = '';
      expect(resolveRecordResponsesConfig(undefined)).toBe(false);

      process.env[ENV_VARS.MOCK_RECORD_RESPONSES_FOR] = '  ';
      expect(resolveRecordResponsesConfig(undefined)).toBe(false);
    });
  });

  describe('shouldRecordResponseForUrl', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
      delete process.env[ENV_VARS.MOCK_RECORD_RESPONSES];
      delete process.env[ENV_VARS.MOCK_RECORD_RESPONSES_FOR];
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('returns false by default', () => {
      expect(shouldRecordResponseForUrl('https://api.example.com/users', undefined)).toBe(false);
    });

    it('returns true for boolean true config', () => {
      expect(shouldRecordResponseForUrl('https://api.example.com/users', true)).toBe(true);
      expect(shouldRecordResponseForUrl('https://any-url.com/any-path', true)).toBe(true);
    });

    it('returns false for boolean false config', () => {
      expect(shouldRecordResponseForUrl('https://api.example.com/users', false)).toBe(false);
    });

    it('checks patterns for matching URL', () => {
      const patterns = ['api.example.com', '*.staging.com'];
      expect(shouldRecordResponseForUrl('https://api.example.com/users', patterns)).toBe(true);
      expect(shouldRecordResponseForUrl('https://api.staging.com/users', patterns)).toBe(true);
      expect(shouldRecordResponseForUrl('https://other.com/users', patterns)).toBe(false);
    });

    it('respects env overrides', () => {
      process.env[ENV_VARS.MOCK_RECORD_RESPONSES] = 'true';
      const patterns = ['api.example.com'];
      // Env override means all URLs match
      expect(shouldRecordResponseForUrl('https://other.com/users', patterns)).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
      delete process.env[ENV_VARS.MOCK_RECORD_RESPONSES];
      delete process.env[ENV_VARS.MOCK_RECORD_RESPONSES_FOR];
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('selective recording for multiple hosts', () => {
      const patterns = ['api.example.com', 'auth.example.com'];

      expect(shouldRecordResponseForUrl('https://api.example.com/users', patterns)).toBe(true);
      expect(shouldRecordResponseForUrl('https://auth.example.com/login', patterns)).toBe(true);
      expect(shouldRecordResponseForUrl('https://analytics.example.com/events', patterns)).toBe(
        false
      );
    });

    it('wildcard + specific host combination', () => {
      const patterns = ['*.staging.com', 'api.production.com'];

      expect(shouldRecordResponseForUrl('https://api.staging.com/users', patterns)).toBe(true);
      expect(shouldRecordResponseForUrl('https://web.staging.com/users', patterns)).toBe(true);
      expect(shouldRecordResponseForUrl('https://api.production.com/users', patterns)).toBe(true);
      expect(shouldRecordResponseForUrl('https://api.development.com/users', patterns)).toBe(
        false
      );
    });

    it('path-specific recording', () => {
      const patterns = ['api.example.com/v2/*'];

      expect(shouldRecordResponseForUrl('https://api.example.com/v2/users', patterns)).toBe(true);
      expect(shouldRecordResponseForUrl('https://api.example.com/v2/posts/123', patterns)).toBe(
        true
      );
      expect(shouldRecordResponseForUrl('https://api.example.com/v1/users', patterns)).toBe(false);
      expect(shouldRecordResponseForUrl('https://api.example.com/users', patterns)).toBe(false);
    });

    it('regex for complex patterns', () => {
      const patterns: RecordResponsesPattern[] = [/api\.example\.com\/(v[12])\/users/];

      expect(shouldRecordResponseForUrl('https://api.example.com/v1/users', patterns)).toBe(true);
      expect(shouldRecordResponseForUrl('https://api.example.com/v2/users', patterns)).toBe(true);
      expect(shouldRecordResponseForUrl('https://api.example.com/v3/users', patterns)).toBe(false);
      expect(shouldRecordResponseForUrl('https://api.example.com/v1/posts', patterns)).toBe(false);
    });
  });
});
