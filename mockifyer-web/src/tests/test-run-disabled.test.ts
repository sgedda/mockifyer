import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import app from '../index';

describe('POST /api/test/run', () => {
  it('refuses to execute submitted test code', async () => {
    const marker = path.join(os.tmpdir(), `mockifyer-test-run-disabled-${process.pid}.txt`);
    fs.rmSync(marker, { force: true });

    const testCode = `
      const fs = require('fs');
      test('remote execution', () => {
        fs.writeFileSync(${JSON.stringify(marker)}, 'executed');
      });
    `;

    const response = await request(app)
      .post('/api/test/run')
      .send({ testCode, mockData: { request: { method: 'GET', url: 'https://example.test' } } });

    expect(response.status).toBe(410);
    expect(response.body).toEqual({
      success: false,
      error: 'Remote test execution is disabled',
    });
    expect(fs.existsSync(marker)).toBe(false);

    const scratchDir = path.join(os.tmpdir(), 'mockifyer-tests');
    if (fs.existsSync(scratchDir)) {
      const leaked = fs.readdirSync(scratchDir).some((name) => {
        const contents = fs.readFileSync(path.join(scratchDir, name), 'utf-8');
        return contents.includes('remote execution');
      });
      expect(leaked).toBe(false);
    }
  });
});
