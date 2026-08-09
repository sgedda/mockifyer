import {
  isMockifyerDashboardNetworkEventsApiUrl,
  isMockifyerDashboardPlumbingApiUrl,
  isMockifyerDashboardProxyApiUrl,
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
  });

  it('matches joinProxyDashboardApiUrl output', () => {
    const url = joinProxyDashboardApiUrl('https://host/apim/mockifyer/', 'api/proxy');
    expect(url).toBe('https://host/apim/mockifyer/api/proxy');
    expect(isMockifyerDashboardProxyApiUrl(url)).toBe(true);
  });
});

describe('isMockifyerDashboardNetworkEventsApiUrl', () => {
  it('detects network-events endpoints including subpaths', () => {
    expect(isMockifyerDashboardNetworkEventsApiUrl('http://localhost:3002/api/network-events')).toBe(
      true
    );
    expect(
      isMockifyerDashboardNetworkEventsApiUrl('https://host/mockifyer/api/network-events/trace?x=1')
    ).toBe(true);
    expect(isMockifyerDashboardPlumbingApiUrl('https://host/api/network-events')).toBe(true);
    expect(isMockifyerDashboardNetworkEventsApiUrl('https://host/api/proxy')).toBe(false);
  });
});
