/**
 * Tests for `npx mockifyer init` CLI
 */

import fs from 'fs';
import path from 'path';
import { main } from '../packages/mockifyer-core/src/cli/init';

describe('mockifyer init CLI', () => {
  let testDir: string;
  let originalCwd: string;
  let originalArgv: string[];
  let consoleOutput: string[];
  let consoleLogSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    originalCwd = process.cwd();
    originalArgv = process.argv;
    testDir = path.join(__dirname, '../.test-cli-init-' + Date.now());
    fs.mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);

    // Disable colors: set NO_COLOR env var and mock isTTY
    process.env.NO_COLOR = '1';
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
    delete process.env.NO_COLOR;
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

  const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, '');
  const getOutput = () => stripAnsi(consoleOutput.join('\n'));

  it('detects axios from package.json', async () => {
    const pkg = {
      name: 'test-app',
      version: '1.0.0',
      dependencies: {
        axios: '^1.0.0',
      },
    };
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));

    process.argv = ['node', 'init'];
    await main();

    const output = getOutput();
    expect(output).toContain('Detected: axios');
    expect(output).toContain('mockifyer.config.json');
    expect(output).toContain('@sgedda/mockifyer-axios');
    expect(output).toContain('useGlobalAxios: true');

    const config = JSON.parse(fs.readFileSync('mockifyer.config.json', 'utf-8'));
    expect(config.mockDataPath).toBe('./mock-data');
    expect(config.recordMode).toBe(true);
    expect(config.recordNewMocksAsPassthrough).toBe(true);
    expect(config.recordResponses).toBe(false);
  });

  it('detects fetch when no axios or react-native', async () => {
    const pkg = {
      name: 'test-app',
      version: '1.0.0',
      dependencies: {
        express: '^4.0.0',
      },
    };
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));

    process.argv = ['node', 'init'];
    await main();

    const output = getOutput();
    expect(output).toContain('Detected: fetch');
    expect(output).toContain('@sgedda/mockifyer-fetch');
    expect(output).toContain('useGlobalFetch: true');
  });

  it('detects react-native from package.json', async () => {
    const pkg = {
      name: 'test-app',
      version: '1.0.0',
      dependencies: {
        'react-native': '^0.70.0',
      },
    };
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));

    process.argv = ['node', 'init'];
    await main();

    const output = getOutput();
    expect(output).toContain('Detected: react-native');
    expect(output).toContain(
      "import { setupMockifyerForReactNative } from '@sgedda/mockifyer-fetch/react-native';"
    );
    expect(output).toContain('await setupMockifyerForReactNative({');
    expect(output).toContain('isDev: __DEV__,');
    expect(output).toContain('recordMode: true,');
    expect(output).toContain('recordNewMocksAsPassthrough: true');
    expect(output).toContain('recordResponses: false');
    expect(output).not.toContain("from '@sgedda/mockifyer-fetch';");
  });

  it('does not overwrite existing config without --force', async () => {
    const pkg = { name: 'test-app', version: '1.0.0' };
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));

    const existingConfig = { mockDataPath: './custom-path', recordMode: false };
    fs.writeFileSync('mockifyer.config.json', JSON.stringify(existingConfig, null, 2));

    process.argv = ['node', 'init'];
    try {
      await main();
    } catch (error: any) {
      if (!error.message.includes('process.exit(0)')) {
        throw error;
      }
    }

    const output = getOutput();
    expect(output).toContain('already exists');
    expect(output).toContain('--force');

    const config = JSON.parse(fs.readFileSync('mockifyer.config.json', 'utf-8'));
    expect(config.mockDataPath).toBe('./custom-path');
  });

  it('overwrites config with --force', async () => {
    const pkg = { name: 'test-app', version: '1.0.0', dependencies: { axios: '^1.0.0' } };
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));

    const existingConfig = { mockDataPath: './custom-path', recordMode: false };
    fs.writeFileSync('mockifyer.config.json', JSON.stringify(existingConfig, null, 2));

    process.argv = ['node', 'init', '--force'];
    await main();

    const output = getOutput();
    expect(output).toContain('Created mockifyer.config.json');

    const config = JSON.parse(fs.readFileSync('mockifyer.config.json', 'utf-8'));
    expect(config.mockDataPath).toBe('./mock-data');
    expect(config.recordMode).toBe(true);
  });

  it('finds package.json in parent directory', async () => {
    const pkg = { name: 'test-app', version: '1.0.0', dependencies: { axios: '^1.0.0' } };
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));

    const subdir = path.join(testDir, 'src');
    fs.mkdirSync(subdir);
    process.chdir(subdir);

    process.argv = ['node', 'init'];
    await main();

    const output = getOutput();
    expect(output).toContain('Detected: axios');

    const configPath = path.join(testDir, 'mockifyer.config.json');
    expect(fs.existsSync(configPath)).toBe(true);
  });
});
