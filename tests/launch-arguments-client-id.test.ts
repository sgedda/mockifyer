jest.mock(
  'react-native-launch-arguments',
  () => ({
    LaunchArguments: {
      value: jest.fn(() => ({})),
    },
  }),
  { virtual: true }
);

import { tryGetClientIdFromLaunchArguments } from '../packages/mockifyer-fetch/src/launch-arguments-client-id';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { LaunchArguments } = require('react-native-launch-arguments');

describe('tryGetClientIdFromLaunchArguments', () => {
  beforeEach(() => {
    (LaunchArguments.value as jest.Mock).mockReturnValue({});
  });

  it('returns undefined when key is missing or empty', () => {
    expect(tryGetClientIdFromLaunchArguments('')).toBeUndefined();
    expect(tryGetClientIdFromLaunchArguments('mockifyerClientId')).toBeUndefined();
  });

  it('returns trimmed string for default Maestro key', () => {
    LaunchArguments.value.mockReturnValue({ mockifyerClientId: '  e2e-login-lane  ' });
    expect(tryGetClientIdFromLaunchArguments()).toBe('e2e-login-lane');
  });

  it('supports custom key', () => {
    LaunchArguments.value.mockReturnValue({ myLane: 'lane-b' });
    expect(tryGetClientIdFromLaunchArguments('myLane')).toBe('lane-b');
  });

  it('returns undefined when LaunchArguments.value throws', () => {
    LaunchArguments.value.mockImplementation(() => {
      throw new Error('no RN');
    });
    expect(tryGetClientIdFromLaunchArguments()).toBeUndefined();
  });
});
