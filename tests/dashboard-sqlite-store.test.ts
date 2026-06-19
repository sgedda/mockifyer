import fs from 'fs';
import os from 'os';
import path from 'path';
import { createDashboardMockStore } from '../packages/mockifyer-dashboard/src/utils/create-dashboard-mock-store';

const mockCreatedDatabasePaths: string[] = [];

jest.mock(
  'better-sqlite3',
  () =>
    jest.fn().mockImplementation((dbPath: string) => {
      mockCreatedDatabasePaths.push(dbPath);
      return {
        pragma: jest.fn(),
        exec: jest.fn(),
        close: jest.fn(),
      };
    }),
  { virtual: true }
);

describe('createDashboardMockStore (sqlite)', () => {
  beforeEach(() => {
    mockCreatedDatabasePaths.length = 0;
  });

  it('creates the default SQLite parent directory before opening the database', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-sqlite-'));
    const mockDataPath = path.join(root, 'mock-data');

    try {
      expect(fs.existsSync(mockDataPath)).toBe(false);

      const store = createDashboardMockStore({ provider: 'sqlite' }, mockDataPath);

      expect(fs.existsSync(mockDataPath)).toBe(true);
      expect(mockCreatedDatabasePaths).toEqual([
        path.join(mockDataPath, 'mockifyer-dashboard.db'),
      ]);

      await store.close();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
