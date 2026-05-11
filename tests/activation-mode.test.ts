import {
  getOutboundMockifyerClientIdHeader,
  resolveActivationMode,
  shouldApplyMockifyer,
  type MockifyerConfig,
} from '@sgedda/mockifyer-core';

describe('activation-mode', () => {
  const baseConfig: MockifyerConfig = {
    mockDataPath: './mock-data',
    recordMode: false,
  };

  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.MOCKIFYER_ACTIVATION_MODE;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('resolveActivationMode defaults to always', () => {
    expect(resolveActivationMode({})).toBe('always');
    expect(resolveActivationMode({ activationMode: undefined })).toBe('always');
  });

  it('resolveActivationMode uses config when env unset', () => {
    expect(resolveActivationMode({ ...baseConfig, activationMode: 'off' })).toBe('off');
    expect(resolveActivationMode({ ...baseConfig, activationMode: 'client_id_header' })).toBe(
      'client_id_header'
    );
  });

  it('resolveActivationMode env wins over config', () => {
    process.env.MOCKIFYER_ACTIVATION_MODE = 'off';
    expect(resolveActivationMode({ ...baseConfig, activationMode: 'always' })).toBe('off');
  });

  it('getOutboundMockifyerClientIdHeader is case-insensitive on plain object', () => {
    expect(getOutboundMockifyerClientIdHeader({ 'X-Mockifyer-Client-Id': ' lane-a ' })).toBe('lane-a');
    expect(getOutboundMockifyerClientIdHeader({ 'x-mockifyer-client-id': '' })).toBeUndefined();
  });

  it('shouldApplyMockifyer client_id_header requires header or proxy lane', () => {
    expect(shouldApplyMockifyer('client_id_header', {})).toBe(false);
    expect(shouldApplyMockifyer('client_id_header', { 'x-mockifyer-client-id': 'x' })).toBe(true);
    expect(
      shouldApplyMockifyer('client_id_header', {}, {
        useProxyLane: { proxyBaseUrl: 'http://localhost:3002', resolvedClientId: 'rn-lane' },
      })
    ).toBe(true);
    expect(
      shouldApplyMockifyer('client_id_header', {}, {
        useProxyLane: { proxyBaseUrl: 'http://localhost:3002', resolvedClientId: '   ' },
      })
    ).toBe(false);
  });

  it('shouldApplyMockifyer always and off', () => {
    expect(shouldApplyMockifyer('always', {})).toBe(true);
    expect(shouldApplyMockifyer('off', { 'x-mockifyer-client-id': 'x' })).toBe(false);
  });
});
