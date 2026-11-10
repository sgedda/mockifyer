/**
 * Minimal test to reproduce record/replay bug
 * 
 * Issue: Responses are not fully written to mock files during recording.
 * Symptom: Mock files have status: 0, data: null, responsePending: true
 * Expected: Mock files should have actual response status and data
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import express from 'express';
import type { Server } from 'http';
import { setupMockifyer } from '../../index';
import fs from 'fs';
import path from 'path';

const TEST_PORT = 3099;
const MOCK_DATA_PATH = path.join(__dirname, '__temp_mocks__');

describe('Record/Replay Bug Reproduction', () => {
  let server: Server;

  beforeAll((done) => {
    // Start a simple test server
    const app = express();
    app.get('/test', (req, res) => {
      res.json({ message: 'Hello from test server', city: req.query.city });
    });
    server = app.listen(TEST_PORT, () => {
      console.log(`Test server running on :${TEST_PORT}`);
      done();
    });
  });

  afterAll((done) => {
    server?.close(done);
    // Clean up mock files
    if (fs.existsSync(MOCK_DATA_PATH)) {
      fs.rmSync(MOCK_DATA_PATH, { recursive: true, force: true });
    }
  });

  it('should record response data completely', async () => {
    // Setup recording mode
    setupMockifyer({
      recordMode: true,
      mockDataPath: MOCK_DATA_PATH,
      defaultScenario: 'default',
      provider: 'filesystem',
      useGlobalFetch: true,
      domainPathRulesMode: 'record_all',
    });

    // Make a request
    const response = await fetch(`http://localhost:${TEST_PORT}/test?city=London`);
    const data = await response.json();

    console.log('Received data:', data);
    expect(response.status).toBe(200);
    expect(data.message).toBe('Hello from test server');

    // Wait for async file write
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Find the recorded mock file
    const mockDir = path.join(MOCK_DATA_PATH, 'default', 'localhost', 'test');
    expect(fs.existsSync(mockDir)).toBe(true);

    const files = fs.readdirSync(mockDir);
    expect(files.length).toBeGreaterThan(0);

    const mockFile = path.join(mockDir, files[0]);
    const mockContent = JSON.parse(fs.readFileSync(mockFile, 'utf-8'));

    console.log('Mock file content:', JSON.stringify(mockContent, null, 2));

    // THIS IS THE BUG: response.status is 0 and response.data is null
    expect(mockContent.response.status).toBe(200); // FAILS: actual is 0
    expect(mockContent.response.data).not.toBeNull(); // FAILS: actual is null
    expect(mockContent.response.data?.message).toBe('Hello from test server'); // FAILS
  });
});
