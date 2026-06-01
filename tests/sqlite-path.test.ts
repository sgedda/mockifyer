import path from 'path';
import {
  resolveDashboardDataRoot,
  resolveDashboardSqlitePath,
} from '../packages/mockifyer-dashboard/src/utils/sqlite-path';

describe('dashboard SQLite path helpers', () => {
  it('keeps an explicit SQLite file separate from the filesystem data root', () => {
    const dbPath = path.join('/tmp', 'mockifyer-test', 'mock-data.db');

    expect(resolveDashboardSqlitePath(dbPath, { provider: 'sqlite' })).toBe(dbPath);
    expect(resolveDashboardDataRoot(dbPath)).toBe(path.dirname(dbPath));
  });

  it('prefers the resolved sqlitePath stored in dashboard config', () => {
    const dataRoot = path.join('/tmp', 'mockifyer-test', 'mock-data');
    const dbPath = path.join('/tmp', 'mockifyer-test', 'custom.db');

    expect(
      resolveDashboardSqlitePath(dataRoot, {
        provider: 'sqlite',
        sqlitePath: dbPath,
      })
    ).toBe(dbPath);
  });
});
