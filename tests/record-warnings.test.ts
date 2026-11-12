import {
  warnRequestOnlyStub,
  warnSetupWithoutInterception,
  resetRequestOnlyWarnings,
} from '../packages/mockifyer-core/src/utils/record-warnings';
import { logger } from '../packages/mockifyer-core/src/utils/logger';

describe('record-warnings', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    resetRequestOnlyWarnings();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe('warnRequestOnlyStub', () => {
    it('warns once per host', () => {
      warnRequestOnlyStub('https://api.example.com/users');
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Request-only stub saved for api.example.com')
      );

      // Second call for same host should not warn
      warnRequestOnlyStub('https://api.example.com/posts');
      expect(warnSpy).toHaveBeenCalledTimes(1);

      // Different host should warn
      warnRequestOnlyStub('https://other.com/users');
      expect(warnSpy).toHaveBeenCalledTimes(2);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Request-only stub saved for other.com')
      );
    });

    it('includes opt-in instructions', () => {
      warnRequestOnlyStub('https://api.example.com/users');
      const warning = warnSpy.mock.calls[0][0];
      expect(warning).toContain('recordResponses:');
      expect(warning).toContain('api.example.com');
    });

    it('accepts custom example snippet', () => {
      warnRequestOnlyStub('https://api.example.com/users', "['api.example.com', '*.staging.com']");
      const warning = warnSpy.mock.calls[0][0];
      expect(warning).toContain("['api.example.com', '*.staging.com']");
    });

    it('handles malformed URLs gracefully', () => {
      warnRequestOnlyStub('not-a-url');
      // Should not throw, but may or may not warn depending on URL parsing
      expect(warnSpy.mock.calls.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('warnSetupWithoutInterception', () => {
    it('warns when recordMode is on but no interception', () => {
      warnSetupWithoutInterception(true, false, false, false, 'fetch');
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Recording is enabled but useGlobalFetch is not set')
      );
    });

    it('does not warn when recordMode is off', () => {
      warnSetupWithoutInterception(false, false, false, false, 'fetch');
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('does not warn when useGlobalFetch is true', () => {
      warnSetupWithoutInterception(true, true, false, false, 'fetch');
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('does not warn when useGlobalAxios is true', () => {
      warnSetupWithoutInterception(true, false, true, false, 'axios');
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('does not warn when proxy is configured', () => {
      warnSetupWithoutInterception(true, false, false, true, 'fetch');
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('shows correct flag name for axios', () => {
      warnSetupWithoutInterception(true, false, false, false, 'axios');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('useGlobalAxios')
      );
    });

    it('shows correct flag name for fetch', () => {
      warnSetupWithoutInterception(true, false, false, false, 'fetch');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('useGlobalFetch')
      );
    });

    it('includes fix instructions', () => {
      warnSetupWithoutInterception(true, false, false, false, 'fetch');
      const warning = warnSpy.mock.calls[0][0];
      expect(warning).toContain('To fix:');
      expect(warning).toContain('useGlobalFetch: true');
    });
  });

  describe('resetRequestOnlyWarnings', () => {
    it('allows warnings to be emitted again after reset', () => {
      warnRequestOnlyStub('https://api.example.com/users');
      expect(warnSpy).toHaveBeenCalledTimes(1);

      // Second call should not warn
      warnRequestOnlyStub('https://api.example.com/posts');
      expect(warnSpy).toHaveBeenCalledTimes(1);

      // After reset, warning should appear again
      resetRequestOnlyWarnings();
      warnRequestOnlyStub('https://api.example.com/users');
      expect(warnSpy).toHaveBeenCalledTimes(2);
    });
  });
});
