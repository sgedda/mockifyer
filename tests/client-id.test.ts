import { resolveClientId, type MockifyerConfig } from '@sgedda/mockifyer-core';

describe('client-id', () => {
  const baseConfig: MockifyerConfig = {
    mockDataPath: './mock-data',
    recordMode: false,
  };

  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.MOCKIFYER_CLIENT_ID;
    delete process.env.MOCKIFYER_CLIENT_LANE;
    delete process.env.MOCKIFYER_APPLICATION_ID;
    delete process.env.MOCKIFYER_MARKET;
    delete process.env.MOCKIFYER_VERSION_NAME;
    delete process.env.MOCKIFYER_VERSION_CODE;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses MOCKIFYER_CLIENT_ID when set', () => {
    process.env.MOCKIFYER_CLIENT_ID = 'lane-explicit';
    const id = resolveClientId(baseConfig);
    expect(id).toBe('lane-explicit');
  });

  it('falls back to config.clientId when env is not set', () => {
    const id = resolveClientId({ ...baseConfig, clientId: 'lane-config' });
    expect(id).toBe('lane-config');
  });

  it('uses MOCKIFYER_CLIENT_LANE when explicit values are missing', () => {
    process.env.MOCKIFYER_CLIENT_LANE = 'lane-precomputed';
    const id = resolveClientId(baseConfig);
    expect(id).toBe('lane-precomputed');
  });

  it('builds deterministic lane from build metadata env vars', () => {
    process.env.MOCKIFYER_APPLICATION_ID = 'Com.Example.App';
    process.env.MOCKIFYER_MARKET = 'EU';
    process.env.MOCKIFYER_VERSION_NAME = '1.4.2';
    process.env.MOCKIFYER_VERSION_CODE = '502';
    const id = resolveClientId(baseConfig);
    expect(id).toBe('com.example.app-eu-1.4.2-502');
  });
});

