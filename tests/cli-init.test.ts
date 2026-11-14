/**
 * Tests for `npx mockifyer init` CLI
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe('mockifyer init CLI', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    testDir = path.join(__dirname, '../.test-cli-init-' + Date.now());
    fs.mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('detects axios from package.json', () => {
    const pkg = {
      name: 'test-app',
      version: '1.0.0',
      dependencies: {
        axios: '^1.0.0',
      },
    };
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));

    const cliPath = path.join(__dirname, '../packages/mockifyer-core/dist/cli/init.js');
    const output = execSync(`node "${cliPath}"`, { encoding: 'utf-8' });

    expect(output).toContain('Detected: axios');
    expect(output).toContain('mockifyer.config.json');
    expect(output).toContain('@sgedda/mockifyer-axios');

    const config = JSON.parse(fs.readFileSync('mockifyer.config.json', 'utf-8'));
    expect(config.mockDataPath).toBe('./mock-data');
    expect(config.recordMode).toBe(true);
    expect(config.recordNewMocksAsPassthrough).toBe(true);
    expect(config.recordResponses).toBe(false);
  });

  it('detects fetch when no axios or react-native', () => {
    const pkg = {
      name: 'test-app',
      version: '1.0.0',
      dependencies: {
        express: '^4.0.0',
      },
    };
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));

    const cliPath = path.join(__dirname, '../packages/mockifyer-core/dist/cli/init.js');
    const output = execSync(`node "${cliPath}"`, { encoding: 'utf-8' });

    expect(output).toContain('Detected: fetch');
    expect(output).toContain('@sgedda/mockifyer-fetch');
    expect(output).toContain('useGlobalFetch: true');
  });

  it('detects react-native from package.json', () => {
    const pkg = {
      name: 'test-app',
      version: '1.0.0',
      dependencies: {
        'react-native': '^0.70.0',
      },
    };
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));

    const cliPath = path.join(__dirname, '../packages/mockifyer-core/dist/cli/init.js');
    const output = execSync(`node "${cliPath}"`, { encoding: 'utf-8' });

    expect(output).toContain('Detected: react-native');
    expect(output).toContain('setupMockifyerForReactNative');
  });

  it('does not overwrite existing config without --force', () => {
    const pkg = { name: 'test-app', version: '1.0.0' };
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));

    const existingConfig = { mockDataPath: './custom-path', recordMode: false };
    fs.writeFileSync('mockifyer.config.json', JSON.stringify(existingConfig, null, 2));

    const cliPath = path.join(__dirname, '../packages/mockifyer-core/dist/cli/init.js');
    const output = execSync(`node "${cliPath}"`, { encoding: 'utf-8' });

    expect(output).toContain('already exists');
    expect(output).toContain('--force');

    const config = JSON.parse(fs.readFileSync('mockifyer.config.json', 'utf-8'));
    expect(config.mockDataPath).toBe('./custom-path');
  });

  it('overwrites config with --force', () => {
    const pkg = { name: 'test-app', version: '1.0.0', dependencies: { axios: '^1.0.0' } };
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));

    const existingConfig = { mockDataPath: './custom-path', recordMode: false };
    fs.writeFileSync('mockifyer.config.json', JSON.stringify(existingConfig, null, 2));

    const cliPath = path.join(__dirname, '../packages/mockifyer-core/dist/cli/init.js');
    const output = execSync(`node "${cliPath}" --force`, { encoding: 'utf-8' });

    expect(output).toContain('Created mockifyer.config.json');

    const config = JSON.parse(fs.readFileSync('mockifyer.config.json', 'utf-8'));
    expect(config.mockDataPath).toBe('./mock-data');
    expect(config.recordMode).toBe(true);
  });

  it('finds package.json in parent directory', () => {
    const pkg = { name: 'test-app', version: '1.0.0', dependencies: { axios: '^1.0.0' } };
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));

    const subdir = path.join(testDir, 'src');
    fs.mkdirSync(subdir);
    process.chdir(subdir);

    const cliPath = path.join(__dirname, '../packages/mockifyer-core/dist/cli/init.js');
    const output = execSync(`node "${cliPath}"`, { encoding: 'utf-8' });

    expect(output).toContain('Detected: axios');

    const configPath = path.join(testDir, 'mockifyer.config.json');
    expect(fs.existsSync(configPath)).toBe(true);
  });
});
