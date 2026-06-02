import fs from 'fs';
import os from 'os';
import path from 'path';
import { resolveDashboardSqlitePath } from '../packages/mockifyer-dashboard/src/utils/dashboard-sqlite';
import { createNetworkLogStore } from '../packages/mockifyer-dashboard/src/utils/network-log-store';

function hasBetterSqlite3(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require(require.resolve('better-sqlite3', {
      paths: [path.join(process.cwd(), 'packages/mockifyer-dashboard')],
    }));
    return true;
  } catch {
    return false;
  }
}

describe('dashboard sqlite utilities', () => {
  const previousDbPath = process.env.MOCKIFYER_DB_PATH;

  afterEach(() => {
    if (previousDbPath === undefined) {
      delete process.env.MOCKIFYER_DB_PATH;
    } else {
      process.env.MOCKIFYER_DB_PATH = previousDbPath;
    }
  });

  it('treats MOCKIFYER_DB_PATH as a directory when it points to an existing directory', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-sqlite-path-'));
    process.env.MOCKIFYER_DB_PATH = tempDir;

    expect(resolveDashboardSqlitePath('/unused/mock-data', { provider: 'sqlite' })).toBe(
      path.join(tempDir, 'mockifyer-dashboard.db')
    );

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates missing parent directories before opening the SQLite network log store', async () => {
    if (!hasBetterSqlite3()) return;

    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-sqlite-store-'));
    const mockDataPath = path.join(tempRoot, 'missing', 'mock-data');
    const store = createNetworkLogStore({ provider: 'sqlite', mockDataPath });

    await store.append('default', {
      transport: 'proxy',
      method: 'GET',
      url: 'https://api.example.com/ok',
      source: 'upstream',
    });
    const result = await store.list({ scenario: 'default' });

    expect(result.events).toHaveLength(1);
    expect(fs.existsSync(path.join(mockDataPath, 'mockifyer-dashboard.db'))).toBe(true);

    await store.close();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });
});
