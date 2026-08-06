import {
  DEFAULT_EXCLUDED_URLS,
  containsMockifyerSyncEndpointMarker,
  MOCKIFYER_SYNC_ENDPOINT_MARKERS,
  shouldBypassMockifyerForUrl,
  shouldExcludeUrl,
} from '@sgedda/mockifyer-core';

describe('containsMockifyerSyncEndpointMarker', () => {
  it('matches all Metro sync endpoint markers including domain-path-rules', () => {
    expect(containsMockifyerSyncEndpointMarker('http://localhost:8081/mockifyer-save')).toBe(true);
    expect(containsMockifyerSyncEndpointMarker('http://localhost:8081/mockifyer-clear')).toBe(true);
    expect(containsMockifyerSyncEndpointMarker('http://localhost:8081/mockifyer-sync')).toBe(true);
    expect(
      containsMockifyerSyncEndpointMarker('http://localhost:8081/mockifyer-domain-path-rules')
    ).toBe(true);
  });

  it('returns false for normal API traffic and empty input', () => {
    expect(containsMockifyerSyncEndpointMarker('https://api.example.com/users')).toBe(false);
    expect(containsMockifyerSyncEndpointMarker('')).toBe(false);
    expect(containsMockifyerSyncEndpointMarker(undefined)).toBe(false);
  });

  it('keeps sync markers included in DEFAULT_EXCLUDED_URLS', () => {
    for (const marker of MOCKIFYER_SYNC_ENDPOINT_MARKERS) {
      expect(DEFAULT_EXCLUDED_URLS).toContain(marker);
    }
  });
});

describe('shouldBypassMockifyerForUrl', () => {
  it('matches absolute URLs against excluded host patterns', () => {
    expect(
      shouldBypassMockifyerForUrl('https://login.microsoftonline.com/tenant/oauth2/token', [
        'login.microsoftonline.com',
      ])
    ).toBe(true);
  });

  it('resolves relative URLs with baseUrl', () => {
    expect(
      shouldBypassMockifyerForUrl('/oauth2/token', ['login.microsoftonline.com'], 'https://login.microsoftonline.com')
    ).toBe(true);
  });

  it('uses default exclusions when excludedUrls is omitted', () => {
    expect(shouldBypassMockifyerForUrl('https://api.resend.com/emails')).toBe(true);
    expect(shouldBypassMockifyerForUrl('https://api.example.com/users')).toBe(false);
  });

  it('custom excludedUrls replace defaults entirely', () => {
    expect(shouldBypassMockifyerForUrl('https://api.resend.com/emails', ['only.example.com'])).toBe(false);
    expect(
      shouldBypassMockifyerForUrl('https://api.resend.com/emails', [
        'api.resend.com',
        ...DEFAULT_EXCLUDED_URLS,
      ])
    ).toBe(true);
  });

  it('shouldExcludeUrl remains substring-based', () => {
    expect(shouldExcludeUrl('https://login.microsoftonline.com/oauth2/token', ['oauth2/token'])).toBe(true);
  });

  it('always bypasses dashboard /api/proxy even when custom excludedUrls replace defaults', () => {
    expect(
      shouldBypassMockifyerForUrl('https://host/mockifyer/api/proxy', ['only.example.com'])
    ).toBe(true);
    expect(
      shouldBypassMockifyerForUrl('https://node-capi-graphql-server-ats.azurewebsites.net//mockifyer/api/proxy')
    ).toBe(true);
    expect(shouldBypassMockifyerForUrl('https://api.example.com/users')).toBe(false);
  });
});
