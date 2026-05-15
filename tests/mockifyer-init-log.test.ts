import { logMockifyerInitSummary, logMockifyerNotActivated } from '@sgedda/mockifyer-core';

describe('mockifyer init log', () => {
  it('logMockifyerInitSummary does not throw for proxy + strict flags', () => {
    expect(() =>
      logMockifyerInitSummary({
        mockDataPath: 'mock-data',
        clientId: 'lane-a',
        strictScenarioResolution: true,
        proxy: { baseUrl: 'http://localhost:3002' },
        runtimeMode: 'on',
        initLog: { headline: 'Test headline' },
      })
    ).not.toThrow();
  });

  it('logMockifyerNotActivated does not throw', () => {
    expect(() => logMockifyerNotActivated('launch_client', { launchClientIdKey: 'mockifyerClientId' })).not.toThrow();
  });
});
