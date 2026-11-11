/**
 * Test that recordResponses precedence works correctly:
 * 1. Env variable (MOCKIFYER_RECORD_RESPONSES) overrides everything
 * 2. Local config (config.recordResponses) overrides proxy config
 * 3. Proxy config (config.proxy.recordResponses) is fallback
 * 4. Default is false
 */
import { resolveLocalRecordResponses, envRecordResponsesOverride } from '@sgedda/mockifyer-core';

describe('recordResponses precedence', () => {
  const originalEnv = process.env.MOCKIFYER_RECORD_RESPONSES;

  afterEach(() => {
    // Restore original env
    if (originalEnv !== undefined) {
      process.env.MOCKIFYER_RECORD_RESPONSES = originalEnv;
    } else {
      delete process.env.MOCKIFYER_RECORD_RESPONSES;
    }
  });

  describe('envRecordResponsesOverride', () => {
    it('should return true when env is "true"', () => {
      process.env.MOCKIFYER_RECORD_RESPONSES = 'true';
      expect(envRecordResponsesOverride()).toBe(true);
    });

    it('should return true when env is "1"', () => {
      process.env.MOCKIFYER_RECORD_RESPONSES = '1';
      expect(envRecordResponsesOverride()).toBe(true);
    });

    it('should return false when env is "false"', () => {
      process.env.MOCKIFYER_RECORD_RESPONSES = 'false';
      expect(envRecordResponsesOverride()).toBe(false);
    });

    it('should return false when env is "0"', () => {
      process.env.MOCKIFYER_RECORD_RESPONSES = '0';
      expect(envRecordResponsesOverride()).toBe(false);
    });

    it('should return undefined when env is not set', () => {
      delete process.env.MOCKIFYER_RECORD_RESPONSES;
      expect(envRecordResponsesOverride()).toBeUndefined();
    });
  });

  describe('resolveLocalRecordResponses', () => {
    it('should return env value when set (overrides explicit config)', () => {
      process.env.MOCKIFYER_RECORD_RESPONSES = 'true';
      expect(resolveLocalRecordResponses(false)).toBe(true);
    });

    it('should return explicit config when env is not set', () => {
      delete process.env.MOCKIFYER_RECORD_RESPONSES;
      expect(resolveLocalRecordResponses(true)).toBe(true);
      expect(resolveLocalRecordResponses(false)).toBe(false);
    });

    it('should return false by default when neither env nor config is set', () => {
      delete process.env.MOCKIFYER_RECORD_RESPONSES;
      expect(resolveLocalRecordResponses(undefined)).toBe(false);
    });

    it('should prioritize env over explicit true config', () => {
      process.env.MOCKIFYER_RECORD_RESPONSES = 'false';
      expect(resolveLocalRecordResponses(true)).toBe(false);
    });
  });

  describe('precedence in setupMockifyer context', () => {
    beforeEach(() => {
      delete process.env.MOCKIFYER_RECORD_RESPONSES;
    });

    it('should resolve: local config > proxy config', () => {
      // Simulating the fix: config.recordResponses should take precedence over config.proxy.recordResponses
      const localConfig = true;
      const proxyConfig = false;
      
      const resolved = resolveLocalRecordResponses(localConfig ?? proxyConfig);
      expect(resolved).toBe(true); // local config wins
    });

    it('should resolve: proxy config is used when local is undefined', () => {
      const localConfig = undefined;
      const proxyConfig = true;
      
      const resolved = resolveLocalRecordResponses(localConfig ?? proxyConfig);
      expect(resolved).toBe(true); // proxy config used as fallback
    });

    it('should resolve: default false when neither is set', () => {
      const localConfig = undefined;
      const proxyConfig = undefined;
      
      const resolved = resolveLocalRecordResponses(localConfig ?? proxyConfig);
      expect(resolved).toBe(false); // default
    });

    it('should resolve: env overrides local which overrides proxy', () => {
      process.env.MOCKIFYER_RECORD_RESPONSES = 'true';
      const localConfig = false;
      const proxyConfig = false;
      
      const resolved = resolveLocalRecordResponses(localConfig ?? proxyConfig);
      expect(resolved).toBe(true); // env wins
    });
  });
});
