import fs from 'fs';
import os from 'os';
import path from 'path';
import { detectMockDataPath, detectProvider } from '../packages/mockifyer-dashboard/src/utils/path-detector';
import { resolveDashboardSqlitePath } from '../packages/mockifyer-dashboard/src/utils/create-dashboard-mock-store';
import { ensureDashboardSqliteParentDir } from '../packages/mockifyer-dashboard/src/utils/sqlite-database';

describe('dashboard SQLite paths', () => {
  const originalCwd = process.cwd();
  const originalMockifyerPath = process.env.MOCKIFYER_PATH;
  const originalProvider = process.env.MOCKIFYER_DB_PROVIDER;

  afterEach(() => {
    process.chdir(originalCwd);
    if (originalMockifyerPath === undefined) {
      delete process.env.MOCKIFYER_PATH;
    } else {
      process.env.MOCKIFYER_PATH = originalMockifyerPath;
    }
    if (originalProvider === undefined) {
      delete process.env.MOCKIFYER_DB_PROVIDER;
    } else {
      process.env.MOCKIFYER_DB_PROVIDER = originalProvider;
    }
  });

  it('auto-detects a mock-data.db file as a SQLite provider path', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-dashboard-sqlite-'));
    const dbPath = path.join(tmp, 'mock-data.db');
    fs.writeFileSync(dbPath, '');
    delete process.env.MOCKIFYER_PATH;
    delete process.env.MOCKIFYER_DB_PROVIDER;

    try {
      process.chdir(tmp);
      const detected = detectMockDataPath();
      expect(detected).toBe(dbPath);
      expect(detectProvider(detected)).toBe('sqlite');
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('creates the parent directory for a derived SQLite database path', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-dashboard-sqlite-'));
    const mockDataPath = path.join(tmp, 'mock-data');
    const dbPath = resolveDashboardSqlitePath(mockDataPath, { provider: 'sqlite' });

    try {
      ensureDashboardSqliteParentDir(dbPath);
      expect(fs.existsSync(path.dirname(dbPath))).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
