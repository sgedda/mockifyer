import {
  DEFAULT_EXCLUDED_URLS,
  shouldBypassMockifyerForUrl,
  shouldExcludeUrl,
} from '@sgedda/mockifyer-core';

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

  it('matches tenant-scoped OAuth token URLs with host or path patterns', () => {
    const tenantTokenUrl = 'https://login.microsoftonline.com/tenant-id/oauth2/token';
    expect(shouldBypassMockifyerForUrl(tenantTokenUrl, ['login.microsoftonline.com'])).toBe(true);
    expect(shouldBypassMockifyerForUrl(tenantTokenUrl, ['oauth2/token'])).toBe(true);
    expect(shouldBypassMockifyerForUrl(tenantTokenUrl, ['login.microsoftonline.com/oauth2/token'])).toBe(
      false
    );
  });
});
