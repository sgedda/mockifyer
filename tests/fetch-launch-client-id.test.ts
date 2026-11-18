jest.mock(
  'react-native-launch-arguments',
  () => ({
    LaunchArguments: {
      value: jest.fn(() => ({})),
    },
  }),
  { virtual: true }
);

import { clearMockifyerClientIdRuntime, setupMockifyer } from '@sgedda/mockifyer-fetch';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { LaunchArguments } = require('react-native-launch-arguments');

describe('fetch setupMockifyer launch client id', () => {
  beforeEach(() => {
    clearMockifyerClientIdRuntime();
    (LaunchArguments.value as jest.Mock).mockReset();
    (LaunchArguments.value as jest.Mock).mockReturnValue({});
  });

  afterEach(() => {
    clearMockifyerClientIdRuntime();
  });

  it('pins the lane from launch arguments ahead of config.clientId', () => {
    LaunchArguments.value.mockReturnValue({ mockifyerClientId: '  lane-checkout  ' });

    const client = setupMockifyer({
      mockDataPath: './mock-data',
      databaseProvider: { type: 'memory', options: {} },
      recordMode: false,
      useGlobalFetch: false,
      useLaunchArgumentsClientId: true,
      clientId: 'from-config',
    });

    expect(client.getClientId()).toBe('lane-checkout');
  });

  it('keeps config.clientId when launch-argument lookup is off', () => {
    LaunchArguments.value.mockReturnValue({ mockifyerClientId: 'lane-checkout' });

    const client = setupMockifyer({
      mockDataPath: './mock-data',
      databaseProvider: { type: 'memory', options: {} },
      recordMode: false,
      useGlobalFetch: false,
      clientId: 'from-config',
    });

    expect(client.getClientId()).toBe('from-config');
    expect(LaunchArguments.value).not.toHaveBeenCalled();
  });
});
