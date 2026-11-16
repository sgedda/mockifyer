/**
 * Verify that all CLI bins run from compiled dist files without ts-node.
 * 
 * This test packs the @sgedda/mockifyer-core tarball, installs it in a temp
 * directory (without ts-node), and verifies each bin executes successfully.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('CLI bins without ts-node', () => {
  const corePackageRoot = path.join(__dirname, '..', 'packages', 'mockifyer-core');
  let tempDir: string;
  let tarballPath: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-cli-test-'));
    
    // Pack the tarball
    const packOutput = execSync('npm pack', {
      cwd: corePackageRoot,
      encoding: 'utf8'
    }).trim();
    
    // Get the tarball filename from pack output (last line)
    const tarballName = packOutput.split('\n').pop()?.trim() || 'sgedda-mockifyer-core-1.10.196.tgz';
    tarballPath = path.join(corePackageRoot, tarballName);
    
    // Install the tarball in temp directory without ts-node
    const packageJson = {
      name: 'test-cli-bins',
      version: '1.0.0',
      private: true
    };
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    execSync(`npm install "${tarballPath}"`, {
      cwd: tempDir,
      stdio: 'inherit'
    });
  }, 60000);

  afterAll(() => {
    // Clean up
    if (tarballPath && fs.existsSync(tarballPath)) {
      fs.unlinkSync(tarballPath);
    }
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('mockifyer-atlas runs with --help', () => {
    const binPath = path.join(tempDir, 'node_modules', '.bin', 'mockifyer-atlas');
    expect(fs.existsSync(binPath)).toBe(true);
    
    const output = execSync(`"${binPath}" --help`, {
      cwd: tempDir,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' }
    });
    
    expect(output).toContain('Mockifyer Atlas');
    expect(output).toContain('Usage:');
  });

  it('mockifyer-atlas-har runs with --help', () => {
    const binPath = path.join(tempDir, 'node_modules', '.bin', 'mockifyer-atlas-har');
    expect(fs.existsSync(binPath)).toBe(true);
    
    const output = execSync(`"${binPath}" --help`, {
      cwd: tempDir,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' }
    });
    
    expect(output).toContain('HAR');
    expect(output).toContain('Usage:');
  });

  it('mockifyer-sync-to-device runs with --help', () => {
    const binPath = path.join(tempDir, 'node_modules', '.bin', 'mockifyer-sync-to-device');
    expect(fs.existsSync(binPath)).toBe(true);
    
    const output = execSync(`"${binPath}" --help`, {
      cwd: tempDir,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' }
    });
    
    expect(output).toContain('Mockifyer Sync to Device');
    expect(output).toContain('Usage:');
  });

  it('mockifyer-sync-from-device runs with --help', () => {
    const binPath = path.join(tempDir, 'node_modules', '.bin', 'mockifyer-sync-from-device');
    expect(fs.existsSync(binPath)).toBe(true);
    
    const output = execSync(`"${binPath}" --help`, {
      cwd: tempDir,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' }
    });
    
    expect(output).toContain('Mockifyer Sync from Device');
    expect(output).toContain('Usage:');
  });

  it('all bins point to dist files with node shebang', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(corePackageRoot, 'package.json'), 'utf8')
    ) as { bin?: Record<string, string> };

    const binsToCheck = [
      'mockifyer-atlas',
      'mockifyer-atlas-har',
      'mockifyer-sync-to-device',
      'mockifyer-sync-from-device'
    ];

    for (const binName of binsToCheck) {
      const binPath = packageJson.bin?.[binName];
      expect(binPath).toBeDefined();
      expect(binPath).toMatch(/^\.\/dist\/cli\/.+\.js$/);

      const fullBinPath = path.join(corePackageRoot, binPath!);
      const binContent = fs.readFileSync(fullBinPath, 'utf8');
      
      expect(binContent).toMatch(/^#!\/usr\/bin\/env node/);
      expect(binContent).not.toContain('ts-node');
    }
  });
});
