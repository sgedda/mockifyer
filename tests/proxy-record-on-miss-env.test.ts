import { ENV_VARS, parseProxyRecordOnMissEnv } from '@sgedda/mockifyer-core';

describe('parseProxyRecordOnMissEnv', () => {
  it('returns undefined for missing or unknown values', () => {
    expect(parseProxyRecordOnMissEnv({})).toBeUndefined();
    expect(parseProxyRecordOnMissEnv({ [ENV_VARS.MOCK_PROXY_RECORD_ON_MISS]: '' })).toBeUndefined();
    expect(parseProxyRecordOnMissEnv({ [ENV_VARS.MOCK_PROXY_RECORD_ON_MISS]: '  ' })).toBeUndefined();
    expect(parseProxyRecordOnMissEnv({ [ENV_VARS.MOCK_PROXY_RECORD_ON_MISS]: 'maybe' })).toBeUndefined();
  });

  it('parses truthy and falsy tokens (case-insensitive)', () => {
    expect(parseProxyRecordOnMissEnv({ [ENV_VARS.MOCK_PROXY_RECORD_ON_MISS]: 'true' })).toBe(true);
    expect(parseProxyRecordOnMissEnv({ [ENV_VARS.MOCK_PROXY_RECORD_ON_MISS]: 'ON' })).toBe(true);
    expect(parseProxyRecordOnMissEnv({ [ENV_VARS.MOCK_PROXY_RECORD_ON_MISS]: '1' })).toBe(true);
    expect(parseProxyRecordOnMissEnv({ [ENV_VARS.MOCK_PROXY_RECORD_ON_MISS]: 'false' })).toBe(false);
    expect(parseProxyRecordOnMissEnv({ [ENV_VARS.MOCK_PROXY_RECORD_ON_MISS]: '0' })).toBe(false);
    expect(parseProxyRecordOnMissEnv({ [ENV_VARS.MOCK_PROXY_RECORD_ON_MISS]: 'OFF' })).toBe(false);
  });
});
