import { resolveMockifyerRuntimeMode, ENV_VARS } from '@sgedda/mockifyer-core';

describe('resolveMockifyerRuntimeMode', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env[ENV_VARS.MOCK_RUNTIME_MODE];
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses configMode when provided', () => {
    process.env[ENV_VARS.MOCK_RUNTIME_MODE] = 'on';
    expect(resolveMockifyerRuntimeMode({ configMode: 'off' })).toBe('off');
  });

  it('uses MOCKIFYER_MODE env', () => {
    process.env[ENV_VARS.MOCK_RUNTIME_MODE] = 'launch_client';
    expect(resolveMockifyerRuntimeMode({})).toBe('launch_client');
  });

  it('defaults to launch_client when unset', () => {
    expect(resolveMockifyerRuntimeMode({})).toBe('launch_client');
  });

  it('accepts aliases', () => {
    expect(resolveMockifyerRuntimeMode({ configMode: 'maestro' })).toBe('launch_client');
    expect(resolveMockifyerRuntimeMode({ configMode: 'disabled' })).toBe('off');
    expect(resolveMockifyerRuntimeMode({ configMode: 'enabled' })).toBe('on');
  });
});
