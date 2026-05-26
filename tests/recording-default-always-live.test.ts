import { ENV_VARS, newRecordingUsesAlwaysUseRealApi } from '@sgedda/mockifyer-core';

describe('newRecordingUsesAlwaysUseRealApi', () => {
  it('defaults to true when env is missing or empty', () => {
    expect(newRecordingUsesAlwaysUseRealApi({})).toBe(true);
    expect(
      newRecordingUsesAlwaysUseRealApi({
        [ENV_VARS.MOCK_RECORD_DEFAULT_ALWAYS_USE_REAL_API]: '',
      })
    ).toBe(true);
  });

  it('returns false for explicit falsy tokens', () => {
    expect(
      newRecordingUsesAlwaysUseRealApi({
        [ENV_VARS.MOCK_RECORD_DEFAULT_ALWAYS_USE_REAL_API]: 'false',
      })
    ).toBe(false);
    expect(
      newRecordingUsesAlwaysUseRealApi({
        [ENV_VARS.MOCK_RECORD_DEFAULT_ALWAYS_USE_REAL_API]: '0',
      })
    ).toBe(false);
  });

  it('returns true when process is unavailable (e.g. some browser bundles)', () => {
    expect(newRecordingUsesAlwaysUseRealApi(undefined)).toBe(true);
  });
});
