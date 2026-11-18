/**
 * Tests for `npx mockifyer try` CLI
 */

import fs from 'fs';
import path from 'path';
import { main } from '../packages/mockifyer-core/src/cli/try';

describe('mockifyer try CLI', () => {
  let testDir: string;
  let originalCwd: string;
  let originalArgv: string[];
  let originalScenario: string | undefined;
  let consoleOutput: string[];
  let consoleLogSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    originalCwd = process.cwd();
    originalArgv = process.argv;
    originalScenario = process.env.MOCKIFYER_SCENARIO;
    testDir = path.join(__dirname, '../.test-cli-try-' + Date.now() + '-' + Math.random().toString(16).slice(2));
    fs.mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);

    originalIsTTY = process.stdout.isTTY;
    Object.defineProperty(process.stdout, 'isTTY', {
      value: false,
      configurable: true,
    });

    consoleOutput = [];
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args) => {
      consoleOutput.push(args.join(' '));
    });
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.argv = originalArgv;
    if (originalScenario === undefined) {
      delete process.env.MOCKIFYER_SCENARIO;
    } else {
      process.env.MOCKIFYER_SCENARIO = originalScenario;
    }
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      configurable: true,
    });
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  const getOutput = () => consoleOutput.join('\n');

  it('replays from _scratch when MOCKIFYER_SCENARIO points elsewhere', async () => {
    process.env.MOCKIFYER_SCENARIO = 'production';
    process.argv = ['node', 'try', '--keep'];

    await main();

    const output = getOutput();
    expect(output).toContain('Replayed from mock');
    expect(output).toContain('SUCCESS');
    expect(processExitSpy).not.toHaveBeenCalled();
    expect(process.env.MOCKIFYER_SCENARIO).toBe('production');

    const mockRoot = path.join(testDir, '.mockifyer-try-demo', 'mock-data');
    expect(fs.existsSync(path.join(mockRoot, '_scratch'))).toBe(true);
    expect(fs.existsSync(path.join(mockRoot, 'production'))).toBe(false);
  });
});
