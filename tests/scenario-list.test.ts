import fs from 'fs';
import os from 'os';
import path from 'path';
import { listScenarios } from '@sgedda/mockifyer-core';

describe('listScenarios', () => {
  it('falls back to default when the mock data path is a file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-scenarios-'));
    const dbPath = path.join(dir, 'mock-data.db');
    fs.writeFileSync(dbPath, '');

    try {
      expect(listScenarios(dbPath)).toEqual(['default']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
