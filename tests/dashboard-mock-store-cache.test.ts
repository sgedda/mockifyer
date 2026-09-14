import { dashboardMockStoreCacheKey } from '../packages/mockifyer-dashboard/src/utils/create-dashboard-mock-store';

describe('dashboardMockStoreCacheKey', () => {
  it('is stable for the same redis config so handlers can reuse one client', () => {
    const config = {
      provider: 'redis' as const,
      redisUrl: 'redis://localhost:6379',
      keyPrefix: 'mockifyer:v1',
      redisCluster: true as const,
    };
    const a = dashboardMockStoreCacheKey(config, '/tmp/mock-data');
    const b = dashboardMockStoreCacheKey(config, '/tmp/mock-data');
    expect(a).toBe(b);
    expect(a).toContain('redis://localhost:6379');
  });

  it('differs when redis URL or cluster mode changes', () => {
    const base = {
      provider: 'redis' as const,
      redisUrl: 'redis://localhost:6379',
      keyPrefix: 'mockifyer:v1',
    };
    const standalone = dashboardMockStoreCacheKey({ ...base, redisCluster: false }, '/tmp/mock-data');
    const cluster = dashboardMockStoreCacheKey({ ...base, redisCluster: true }, '/tmp/mock-data');
    expect(standalone).not.toBe(cluster);
  });
});
