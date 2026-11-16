/**
 * Tests for drift CLI flag combinations.
 * Verifies Bugbot finding fix: --json and --html should work together.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';

describe('Drift CLI Flags', () => {
  const testDir = path.join(__dirname, '../.tmp-drift-cli-test');
  const mockDataDir = path.join(testDir, 'mock-data');
  const htmlOutputDir = path.join(testDir, 'html-output');
  let server: http.Server;
  let serverPort: number;
  let originalArgv: string[];
  let originalCwd: string;
  let consoleOutput: string[];
  let consoleLogSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeAll((done) => {
    originalArgv = process.argv;
    originalCwd = process.cwd();

    // Start a test HTTP server
    server = http.createServer((req, res) => {
      const url = req.url || '';

      if (url === '/test') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ test: true }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(0, () => {
      const addr = server.address();
      serverPort = typeof addr === 'object' && addr ? addr.port : 0;

      // Create test mock data
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true });
      }

      const scenarioDir = path.join(mockDataDir, 'test-scenario');
      fs.mkdirSync(scenarioDir, { recursive: true });

      // Create directory structure first
      fs.mkdirSync(path.join(scenarioDir, 'localhost', 'test'), { recursive: true });

      // Create a simple mock
      const mockFile = {
        request: {
          method: 'GET',
          url: `http://localhost:${serverPort}/test`,
          headers: {},
        },
        response: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          data: { test: true },
        },
        metadata: {
          recordedAt: '2026-11-16T00:00:00.000Z',
          scenario: 'test-scenario',
        },
      };

      fs.writeFileSync(
        path.join(scenarioDir, 'localhost', 'test', 'GET.json'),
        JSON.stringify(mockFile, null, 2)
      );

      // Create domain-path-rules.json
      fs.writeFileSync(
        path.join(scenarioDir, 'domain-path-rules.json'),
        JSON.stringify({
          version: 1,
          rules: [
            {
              domain: 'localhost',
              pathPattern: '/test',
              pathTemplate: '/test',
            },
          ],
        })
      );

      done();
    });
  });

  afterAll((done) => {
    process.argv = originalArgv;
    process.chdir(originalCwd);
    server.close(() => {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true });
      }
      done();
    });
  });

  beforeEach(() => {
    consoleOutput = [];
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args) => {
      consoleOutput.push(args.join(' '));
    });
    // Silence console.error to avoid capturing error logs
    jest.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, '');
  const getOutput = () => stripAnsi(consoleOutput.join('\n'));

  it('should output JSON when --json flag is provided', async () => {
    process.argv = [
      'node',
      'drift-check',
      '--mock-data-path',
      mockDataDir,
      '--scenario',
      'test-scenario',
      '--json',
      '--no-history',
    ];

    const { main } = await import('../packages/mockifyer-core/src/cli/drift-check');
    try {
      await main();
    } catch (error: any) {
      if (!error.message.includes('process.exit')) {
        throw error;
      }
    }

    const output = getOutput();
    expect(output).toContain('"totalMocks"');
    expect(output).toContain('"driftedMocks"');

    const report = JSON.parse(output);
    expect(report).toHaveProperty('totalMocks');
    expect(report).toHaveProperty('driftedMocks');
  });

  it('should generate HTML when --html flag is provided', async () => {
    process.argv = [
      'node',
      'drift-check',
      '--mock-data-path',
      mockDataDir,
      '--scenario',
      'test-scenario',
      '--html',
      htmlOutputDir,
      '--no-history',
    ];

    const { main } = await import('../packages/mockifyer-core/src/cli/drift-check');
    try {
      await main();
    } catch (error: any) {
      if (!error.message.includes('process.exit')) {
        throw error;
      }
    }

    const htmlPath = path.join(htmlOutputDir, 'index.html');
    expect(fs.existsSync(htmlPath)).toBe(true);

    const html = fs.readFileSync(htmlPath, 'utf8');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Drift Check:');
  });

  it('should support both --json and --html flags together (Bugbot fix)', async () => {
    const htmlOutputDir2 = path.join(testDir, 'html-output-combined');

    // Run with both flags
    process.argv = [
      'node',
      'drift-check',
      '--mock-data-path',
      mockDataDir,
      '--scenario',
      'test-scenario',
      '--json',
      '--html',
      htmlOutputDir2,
      '--no-history',
    ];

    const { main } = await import('../packages/mockifyer-core/src/cli/drift-check');
    try {
      await main();
    } catch (error: any) {
      if (!error.message.includes('process.exit')) {
        throw error;
      }
    }

    // Verify JSON was output (pure JSON, no contamination)
    const output = getOutput();
    let report: any;
    expect(() => {
      report = JSON.parse(output);
    }).not.toThrow();
    expect(report).toHaveProperty('totalMocks');

    // Verify JSON does not contain human-friendly console messages
    expect(output).not.toContain('HTML report generated');
    expect(output).not.toContain('Drift Check Report');
    expect(output).not.toContain('BREAKING DRIFT');

    // Verify HTML was created
    const htmlPath = path.join(htmlOutputDir2, 'index.html');
    expect(fs.existsSync(htmlPath)).toBe(true);
    const html = fs.readFileSync(htmlPath, 'utf8');
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('should output human-friendly report when no flags are provided', async () => {
    process.argv = [
      'node',
      'drift-check',
      '--mock-data-path',
      mockDataDir,
      '--scenario',
      'test-scenario',
      '--no-history',
    ];

    const { main } = await import('../packages/mockifyer-core/src/cli/drift-check');
    try {
      await main();
    } catch (error: any) {
      if (!error.message.includes('process.exit')) {
        throw error;
      }
    }

    const output = getOutput();
    // Human-friendly output contains emoji and formatted text
    expect(output).toMatch(/✓|✗/);
    expect(output).toContain('mock');
  });
});
