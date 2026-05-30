import fs from 'fs';
import os from 'os';
import path from 'path';
import { listScenarios } from '@sgedda/mockifyer-core';

describe('scenario utilities', () => {
  it('treats a mock data file path as an empty scenario root', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-scenarios-'));
    const dbPath = path.join(tmp, 'mock-data.db');
    fs.writeFileSync(dbPath, '');

    try {
      expect(listScenarios(dbPath)).toEqual(['default']);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
