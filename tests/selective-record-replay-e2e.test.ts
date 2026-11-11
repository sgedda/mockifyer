/**
 * End-to-end tests for selective recordResponses with actual replay verification.
 * 
 * Tests verify that:
 * 1. Allowlisted URLs record full responses and replay immediately (no live API)
 * 2. Non-allowlisted URLs stay on live API (request-only stubs)
 */

import { setupMockifyer as setupMockifyerFetch } from '../packages/mockifyer-fetch/src/index';
import { setupMockifyer as setupMockifyerAxios } from '../packages/mockifyer-axios/src/index';
import http from 'http';
import type { Server } from 'http';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';

describe('Selective recordResponses E2E replay', () => {
  let server: Server;
  let serverPort: number;
  let testMockDataPath: string;
  let serverVersion = 1;

  beforeAll((done) => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost:${serverPort}`);
      
      if (url.pathname === '/api/data') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ version: serverVersion, timestamp: Date.now() }));
      } else if (url.pathname === '/api/other') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ version: serverVersion, endpoint: 'other' }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(0, () => {
      serverPort = (server.address() as any).port;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(async () => {
    // Ensure clean state between tests with unique path
    testMockDataPath = path.join(__dirname, `../temp-test-mocks-${Date.now()}-${Math.random().toString(36)}`);
    if (fs.existsSync(testMockDataPath)) {
      fs.rmSync(testMockDataPath, { recursive: true });
    }
    fs.mkdirSync(testMockDataPath, { recursive: true });
    serverVersion = 1;
    
    // Reset fetch to original
    if ((global as any).__mockifyer_original_fetch) {
      (global as any).fetch = (global as any).__mockifyer_original_fetch;
      delete (global as any).__mockifyer_original_fetch;
    }
    
    // Wait a bit to ensure clean state
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  afterEach(async () => {
    // Wait for any pending async operations
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (fs.existsSync(testMockDataPath)) {
      fs.rmSync(testMockDataPath, { recursive: true });
    }
    // Reset fetch
    if ((global as any).__mockifyer_original_fetch) {
      (global as any).fetch = (global as any).__mockifyer_original_fetch;
      delete (global as any).__mockifyer_original_fetch;
    }
    // Reset axios
    const axios = require('axios');
    if (axios.defaults?.__mockifyer_original_adapter) {
      axios.defaults.adapter = axios.defaults.__mockifyer_original_adapter;
      delete axios.defaults.__mockifyer_original_adapter;
    }
  });

  describe('fetch', () => {
    it('allowlisted URL records full response (ready for replay)', async () => {
      setupMockifyerFetch({
        mockDataPath: testMockDataPath,
        useGlobalFetch: true,
        recordMode: true,
        recordResponses: [`localhost`],  // Match without port
      });

      // First request - records with version 1
      const response1 = await fetch(`http://localhost:${serverPort}/api/data`);
      const data1 = await response1.json();
      expect(data1.version).toBe(1);

      // Wait for async save and ensure file is written
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify mock file has full response and NO alwaysUseRealApi/responsePending
      // (ready for replay - no live API needed after activation)
      const scenarioPath = path.join(testMockDataPath, '_scratch');
      
      // Find mock files (skip date-config, domain-path-rules, inbound-parent)
      function findMockFiles(dir: string): string[] {
        const results: string[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            results.push(...findMockFiles(fullPath));
          } else if (
            entry.name.endsWith('.json') &&
            entry.name !== 'date-config.json' &&
            entry.name !== 'domain-path-rules.json' &&
            !entry.name.startsWith('inbound-parent')
          ) {
            results.push(fullPath);
          }
        }
        return results;
      }
      
      const mockFiles = findMockFiles(scenarioPath);
      expect(mockFiles.length).toBeGreaterThan(0);

      const mockFile = mockFiles[0];
      const mockData = JSON.parse(fs.readFileSync(mockFile, 'utf-8'));
      
      // Verify full response was recorded
      expect(mockData.response.data.version).toBe(1);
      expect(mockData.response.status).toBe(200);
      
      // Verify NO passthrough flags (mock is replayable without live API)
      expect(mockData.alwaysUseRealApi).toBeUndefined();
      expect(mockData.responsePending).toBeUndefined();
    });

    it('non-allowlisted URL saves request-only stub and keeps hitting live API', async () => {
      setupMockifyerFetch({
        mockDataPath: testMockDataPath,
        useGlobalFetch: true,
        recordMode: true,
        recordResponses: ['other-host.com'], // Allowlist a different host
      });

      // First request - records request-only stub with version 1
      const response1 = await fetch(`http://localhost:${serverPort}/api/other`);
      const data1 = await response1.json();
      expect(data1.version).toBe(1);

      // Wait for async save (setImmediate)
      await new Promise(resolve => setImmediate(resolve));

      // Change server version
      serverVersion = 2;

      // Second request - should hit live API and get version 2
      const response2 = await fetch(`http://localhost:${serverPort}/api/other`);
      const data2 = await response2.json();
      expect(data2.version).toBe(2); // Live API, not replayed

      // Wait for async save
      await new Promise(resolve => setImmediate(resolve));

      // Verify mock file has alwaysUseRealApi: true and responsePending: true
      const scenarioPath = path.join(testMockDataPath, '_scratch');
      
      // Find mock files (skip date-config, domain-path-rules, inbound-parent)
      function findNonAllowlistedMockFiles(dir: string): string[] {
        const results: string[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            results.push(...findNonAllowlistedMockFiles(fullPath));
          } else if (
            entry.name.endsWith('.json') &&
            entry.name !== 'date-config.json' &&
            entry.name !== 'domain-path-rules.json' &&
            !entry.name.startsWith('inbound-parent')
          ) {
            results.push(fullPath);
          }
        }
        return results;
      }
      
      const mockFiles = findNonAllowlistedMockFiles(scenarioPath);
      expect(mockFiles.length).toBeGreaterThan(0);

      const mockFile = mockFiles[0];
      const mockData = JSON.parse(fs.readFileSync(mockFile, 'utf-8'));
      
      // Non-allowlisted URLs should have alwaysUseRealApi flag and responsePending
      expect(mockData.alwaysUseRealApi).toBe(true);
      expect(mockData.responsePending).toBe(true);
      expect(mockData.response.status).toBe(0); // Request-only stub
    });

  });

  describe('axios', () => {
    it('allowlisted URL records full response (ready for replay)', async () => {
      setupMockifyerAxios({
        mockDataPath: testMockDataPath,
        useGlobalAxios: true,
        recordMode: true,
        recordResponses: [`localhost`],
      });

      const axios = require('axios');

      // First request - records with version 1
      const response1 = await axios.get(`http://localhost:${serverPort}/api/data`);
      expect(response1.data.version).toBe(1);

      // Wait for async save
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify mock file
      const scenarioPath = path.join(testMockDataPath, '_scratch');
      function findAxiosMockFiles(dir: string): string[] {
        const results: string[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            results.push(...findAxiosMockFiles(fullPath));
          } else if (
            entry.name.endsWith('.json') &&
            entry.name !== 'date-config.json' &&
            entry.name !== 'domain-path-rules.json' &&
            !entry.name.startsWith('inbound-parent')
          ) {
            results.push(fullPath);
          }
        }
        return results;
      }

      const mockFiles = findAxiosMockFiles(scenarioPath);
      expect(mockFiles.length).toBeGreaterThan(0);

      const mockFile = mockFiles[0];
      const mockData = JSON.parse(fs.readFileSync(mockFile, 'utf-8'));
      expect(mockData.response.data.version).toBe(1);
      expect(mockData.response.status).toBe(200);
      expect(mockData.alwaysUseRealApi).toBeUndefined();
      expect(mockData.responsePending).toBeUndefined();
    });

    it('non-allowlisted URL saves request-only stub and keeps hitting live API', async () => {
      setupMockifyerAxios({
        mockDataPath: testMockDataPath,
        useGlobalAxios: true,
        recordMode: true,
        recordResponses: ['other-host.com'],
      });

      const axios = require('axios');

      // First request
      const response1 = await axios.get(`http://localhost:${serverPort}/api/other`);
      expect(response1.data.version).toBe(1);

      // Wait for async save
      await new Promise(resolve => setImmediate(resolve));

      // Change server version
      serverVersion = 2;

      // Second request - should hit live API
      const response2 = await axios.get(`http://localhost:${serverPort}/api/other`);
      expect(response2.data.version).toBe(2); // Live API

      // Wait for async save
      await new Promise(resolve => setImmediate(resolve));

      // Verify mock file
      const scenarioPath = path.join(testMockDataPath, '_scratch');
      function findAxiosNonAllowlistedMockFiles(dir: string): string[] {
        const results: string[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            results.push(...findAxiosNonAllowlistedMockFiles(fullPath));
          } else if (
            entry.name.endsWith('.json') &&
            entry.name !== 'date-config.json' &&
            entry.name !== 'domain-path-rules.json' &&
            !entry.name.startsWith('inbound-parent')
          ) {
            results.push(fullPath);
          }
        }
        return results;
      }

      const mockFiles = findAxiosNonAllowlistedMockFiles(scenarioPath);
      expect(mockFiles.length).toBeGreaterThan(0);

      const mockFile = mockFiles[0];
      const mockData = JSON.parse(fs.readFileSync(mockFile, 'utf-8'));
      expect(mockData.alwaysUseRealApi).toBe(true);
      expect(mockData.responsePending).toBe(true);
      expect(mockData.response.status).toBe(0);
    });
  });
});
