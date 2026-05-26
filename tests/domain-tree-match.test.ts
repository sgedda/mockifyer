import {
  aggregateLiveApiState,
  countLiveApiInMocks,
  endpointMatchesDomainPath,
} from '../packages/mockifyer-dashboard/src/utils/domain-tree-match';

describe('domain-tree-match', () => {
  it('matches host and path prefix', () => {
    expect(endpointMatchesDomainPath('https://api.example.com/v1/users/1', 'api.example.com')).toBe(true);
    expect(endpointMatchesDomainPath('https://api.example.com/v1/users/1', 'api.example.com/v1/users')).toBe(
      true
    );
    expect(endpointMatchesDomainPath('https://api.example.com/v1/posts', 'api.example.com/v1/users')).toBe(false);
  });

  it('aggregateLiveApiState reflects pending as live', () => {
    const mocks = [
      { endpoint: 'https://api.example.com/a', responsePending: true },
      { endpoint: 'https://api.example.com/b', alwaysUseRealApi: false },
    ];
    const counts = countLiveApiInMocks(mocks, 'api.example.com');
    expect(counts.total).toBe(2);
    expect(counts.pending).toBe(1);
    expect(counts.live).toBe(1);
    expect(aggregateLiveApiState(counts)).toBe('mixed');
  });

  it('aggregateLiveApiState reflects refresh replay modes as live', () => {
    const mocks = [
      { endpoint: 'https://api.example.com/a', alwaysRefreshFromLive: true },
      { endpoint: 'https://api.example.com/b', refreshOnNextRequest: true },
      { endpoint: 'https://api.example.com/c', replayMode: 'stored' },
    ];
    const counts = countLiveApiInMocks(mocks, 'api.example.com');
    expect(counts.total).toBe(3);
    expect(counts.live).toBe(2);
    expect(aggregateLiveApiState(counts)).toBe('mixed');
  });
});
