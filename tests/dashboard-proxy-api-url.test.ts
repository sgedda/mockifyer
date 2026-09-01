import {
  isMockifyerDashboardPlumbingUrl,
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

  it('detects dashboard network-events plumbing including subpaths', () => {
    expect(isMockifyerDashboardProxyApiUrl('http://localhost:3002/api/network-events')).toBe(true);
    expect(isMockifyerDashboardProxyApiUrl('https://host/mockifyer/api/network-events')).toBe(true);
    expect(isMockifyerDashboardProxyApiUrl('https://host/mockifyer/api/network-events/trace')).toBe(
      true
    );
    expect(isMockifyerDashboardProxyApiUrl('https://host/mockifyer/api/network-events/explain')).toBe(
      true
    );
    expect(isMockifyerDashboardPlumbingUrl('http://localhost:3002/api/network-events?x=1')).toBe(
      true
    );
  });

  it('detects dashboard atlas plumbing including subpaths', () => {
    expect(isMockifyerDashboardProxyApiUrl('http://localhost:3002/api/atlas/events')).toBe(true);
    expect(isMockifyerDashboardProxyApiUrl('https://host/mockifyer/api/atlas/usage')).toBe(true);
    expect(isMockifyerDashboardPlumbingUrl('https://host/mockifyer/api/atlas')).toBe(true);
    expect(isMockifyerDashboardPlumbingUrl('http://localhost:3002/api/atlas/events?x=1')).toBe(true);
  });

  it('does not match unrelated urls', () => {
    expect(isMockifyerDashboardProxyApiUrl('https://booking.example/api/booking/1')).toBe(false);
    expect(isMockifyerDashboardProxyApiUrl('https://host/mockifyer/api/health')).toBe(false);
    expect(isMockifyerDashboardProxyApiUrl('https://host/api/proxy-config')).toBe(false);
    expect(isMockifyerDashboardProxyApiUrl('https://host/api/network-events-backup')).toBe(false);
    expect(isMockifyerDashboardProxyApiUrl('https://host/api/atlas-backup')).toBe(false);
  });

  it('matches joinProxyDashboardApiUrl output', () => {
    const url = joinProxyDashboardApiUrl('https://host/apim/mockifyer/', 'api/proxy');
    expect(url).toBe('https://host/apim/mockifyer/api/proxy');
    expect(isMockifyerDashboardProxyApiUrl(url)).toBe(true);

    const eventsUrl = joinProxyDashboardApiUrl('https://host/apim/mockifyer/', 'api/network-events');
    expect(isMockifyerDashboardPlumbingUrl(eventsUrl)).toBe(true);

    const atlasUrl = joinProxyDashboardApiUrl('https://host/apim/mockifyer/', 'api/atlas/events');
    expect(isMockifyerDashboardPlumbingUrl(atlasUrl)).toBe(true);
  });
});
