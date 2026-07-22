import { ENV_VARS } from '@sgedda/mockifyer-core';
import {
  ENV_VARS as ENV_VARS_FROM_RN_ENTRY,
  setupMockifyer,
  setupMockifyerForReactNative,
} from '../packages/mockifyer-fetch/src/react-native';

describe('mockifyer-fetch React Native entry', () => {
  it('preserves package-root exports when the react-native condition is selected', () => {
    expect(typeof setupMockifyer).toBe('function');
    expect(typeof setupMockifyerForReactNative).toBe('function');
    expect(ENV_VARS_FROM_RN_ENTRY).toBe(ENV_VARS);
  });
});
