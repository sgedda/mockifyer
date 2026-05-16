import {
  parseRecordingExclusionsEnv,
  resolveOutboundUrl,
  resolveRecordingExclusions,
  shouldExcludeRecording,
  type RecordingExclusion,
} from '@sgedda/mockifyer-core';

describe('recording-exclusion', () => {
  const envKeys = ['MOCKIFYER_RECORDING_EXCLUSIONS', 'MOCKIFYER_RECORDING_EXCLUSION_HOSTS'] as const;

  afterEach(() => {
    for (const key of envKeys) {
      delete process.env[key];
    }
  });

  it('apex host excludes that host and all subdomains', () => {
    const rules: RecordingExclusion[] = [{ host: 'example.com' }];
    expect(shouldExcludeRecording('https://example.com/foo', rules)).toBe(true);
    expect(shouldExcludeRecording('https://api.example.com/v1/x', rules)).toBe(true);
    expect(shouldExcludeRecording('https://evil.com', rules)).toBe(false);
    expect(shouldExcludeRecording('https://notexample.com', rules)).toBe(false);
  });

  it('nested host excludes only that subdomain tree', () => {
    const rules: RecordingExclusion[] = [{ host: 'cdn.example.com' }];
    expect(shouldExcludeRecording('https://cdn.example.com/a', rules)).toBe(true);
    expect(shouldExcludeRecording('https://x.cdn.example.com/a', rules)).toBe(true);
    expect(shouldExcludeRecording('https://api.example.com/a', rules)).toBe(false);
  });

  it('pathPrefix narrows exclusion', () => {
    const rules: RecordingExclusion[] = [{ host: 'example.com', pathPrefix: '/api' }];
    expect(shouldExcludeRecording('https://example.com/api', rules)).toBe(true);
    expect(shouldExcludeRecording('https://example.com/api/v2/x', rules)).toBe(true);
    expect(shouldExcludeRecording('https://example.com/apidoc', rules)).toBe(false);
    expect(shouldExcludeRecording('https://example.com/other', rules)).toBe(false);
  });

  it('resolveOutboundUrl merges relative URL with base', () => {
    expect(resolveOutboundUrl('/posts/1', 'https://api.example.com/v1')).toBe(
      'https://api.example.com/posts/1'
    );
    expect(resolveOutboundUrl('https://full.test/x', undefined)).toBe('https://full.test/x');
  });

  it('parseRecordingExclusionsEnv reads JSON hosts and comma list', () => {
    process.env.MOCKIFYER_RECORDING_EXCLUSIONS = JSON.stringify([
      { host: 'example.com', pathPrefix: '/private' },
    ]);
    process.env.MOCKIFYER_RECORDING_EXCLUSION_HOSTS = 'analytics.io';
    const list = parseRecordingExclusionsEnv();
    expect(list.some((r) => r.host === 'analytics.io')).toBe(true);
    expect(list.some((r) => r.host === 'example.com')).toBe(true);
    expect(shouldExcludeRecording('https://stats.analytics.io/hit', list)).toBe(true);
    expect(shouldExcludeRecording('https://example.com/private/ping', list)).toBe(true);
    expect(shouldExcludeRecording('https://example.com/public/ping', list)).toBe(false);
  });

  it('resolveRecordingExclusions merges config + env', () => {
    process.env.MOCKIFYER_RECORDING_EXCLUSION_HOSTS = 'env-only.test';
    const merged = resolveRecordingExclusions({
      recordingExclusions: [{ host: 'cfg.test' }],
    });
    expect(shouldExcludeRecording('https://a.cfg.test/', merged)).toBe(true);
    expect(shouldExcludeRecording('https://env-only.test/', merged)).toBe(true);
  });
});
