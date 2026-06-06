import fs from 'fs';
import os from 'os';
import path from 'path';
import { SqliteMockKvBackend } from '@sgedda/mockifyer-dashboard/utils/sqlite-mock-kv-backend';

const mockDb = {
  pragma: jest.fn(),
  exec: jest.fn(),
  prepare: jest.fn(() => ({
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
  })),
  transaction: jest.fn((fn: () => void) => () => fn()),
};

const mockBetterSqlite3 = jest.fn(() => mockDb);

jest.mock('better-sqlite3', () => mockBetterSqlite3, { virtual: true });

describe('SqliteMockKvBackend path initialization', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-sqlite-parent-'));
    mockBetterSqlite3.mockClear();
    mockDb.pragma.mockClear();
    mockDb.exec.mockClear();
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('creates the parent directory before opening the SQLite database', () => {
    const dbPath = path.join(tempRoot, 'mock-data', 'mockifyer-dashboard.db');

    expect(fs.existsSync(path.dirname(dbPath))).toBe(false);

    new SqliteMockKvBackend(dbPath);

    expect(fs.existsSync(path.dirname(dbPath))).toBe(true);
    expect(mockBetterSqlite3).toHaveBeenCalledWith(dbPath);
    expect(mockDb.exec).toHaveBeenCalled();
  });
});
