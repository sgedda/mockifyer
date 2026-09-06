import {
  isMockifyerDashboardProxyApiUrl,
  isMockifyerDashboardPlumbingApiUrl,
  joinProxyDashboardApiUrl,
} from '@sgedda/mockifyer-core';

describe('isMockifyerDashboardProxyApiUrl', () => {
  it('detects dashboard proxy endpoints including path prefixes and double slashes', () => {
    expect(isMockifyerDashboardProxyApiUrl('http://localhost:3002/api/proxy')).toBe(true);
    expect(isMockifyerDashboardProxyApiUrl('https://host/mockifyer/api/proxy')).toBe(true);
    expect(
      isMockifyerDashboardProxyApiUrl(
        'https://node-capi-graphql-server-ats.azurewebsites.net//mockifyer/api/proxy'
      )
    ).toBe(true);
    expect(isMockifyerDashboardProxyApiUrl('https://host/mockifyer/api/proxy?x=1')).toBe(true);
  });

  it('does not match unrelated urls', () => {
    expect(isMockifyerDashboardProxyApiUrl('https://booking.example/api/booking/1')).toBe(false);
    expect(isMockifyerDashboardProxyApiUrl('https://host/mockifyer/api/health')).toBe(false);
    expect(isMockifyerDashboardProxyApiUrl('https://host/api/proxy-config')).toBe(false);
    expect(isMockifyerDashboardProxyApiUrl('https://host/api/network-events')).toBe(false);
  });

  it('matches joinProxyDashboardApiUrl output', () => {
    const url = joinProxyDashboardApiUrl('https://host/apim/mockifyer/', 'api/proxy');
    expect(url).toBe('https://host/apim/mockifyer/api/proxy');
    expect(isMockifyerDashboardProxyApiUrl(url)).toBe(true);
  });
});

describe('isMockifyerDashboardPlumbingApiUrl', () => {
  it('includes proxy, network-events, and atlas (with subpaths)', () => {
    expect(isMockifyerDashboardPlumbingApiUrl('http://localhost:3002/api/proxy')).toBe(true);
    expect(isMockifyerDashboardPlumbingApiUrl('http://localhost:3002/api/network-events')).toBe(true);
    expect(isMockifyerDashboardPlumbingApiUrl('https://host/mockifyer/api/network-events/trace')).toBe(
      true
    );
    expect(isMockifyerDashboardPlumbingApiUrl('https://host/mockifyer/api/network-events?x=1')).toBe(
      true
    );
    expect(isMockifyerDashboardPlumbingApiUrl('http://localhost:3002/api/atlas/events')).toBe(true);
    expect(isMockifyerDashboardPlumbingApiUrl('https://host/mockifyer/api/atlas/usage')).toBe(true);
  });

  it('does not match unrelated dashboard or app urls', () => {
    expect(isMockifyerDashboardPlumbingApiUrl('https://host/mockifyer/api/health')).toBe(false);
    expect(isMockifyerDashboardPlumbingApiUrl('https://host/api/proxy-config')).toBe(false);
    expect(isMockifyerDashboardPlumbingApiUrl('https://booking.example/api/booking/1')).toBe(false);
  });
});
