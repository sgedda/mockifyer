import { resolveReactNativeProxyRecordResponses } from '../packages/mockifyer-fetch/src/react-native';

describe('resolveReactNativeProxyRecordResponses', () => {
  const prev = process.env.MOCKIFYER_RECORD_RESPONSES;
  const prevFor = process.env.MOCKIFYER_RECORD_RESPONSES_FOR;

  afterEach(() => {
    if (prev === undefined) delete process.env.MOCKIFYER_RECORD_RESPONSES;
    else process.env.MOCKIFYER_RECORD_RESPONSES = prev;
    if (prevFor === undefined) delete process.env.MOCKIFYER_RECORD_RESPONSES_FOR;
    else process.env.MOCKIFYER_RECORD_RESPONSES_FOR = prevFor;
  });

  it('keeps an allowlist from config when the RN proxy option is unset', () => {
    delete process.env.MOCKIFYER_RECORD_RESPONSES;
    delete process.env.MOCKIFYER_RECORD_RESPONSES_FOR;
    expect(
      resolveReactNativeProxyRecordResponses(undefined, undefined, ['api.example.com', '*.staging.com'])
    ).toEqual(['api.example.com', '*.staging.com']);
    expect(
      resolveReactNativeProxyRecordResponses(undefined, ['api.example.com/v1/*'], true)
    ).toEqual(['api.example.com/v1/*']);
  });

  it('does not coerce a missing allowlist into a boolean false that shadows config', () => {
    delete process.env.MOCKIFYER_RECORD_RESPONSES;
    delete process.env.MOCKIFYER_RECORD_RESPONSES_FOR;
    const resolved = resolveReactNativeProxyRecordResponses(undefined, undefined, ['localhost']);
    expect(resolved).not.toBe(false);
  });
});
