import fs from 'fs';
import path from 'path';

describe('mockifyer-init-ai package bin', () => {
  const corePackageRoot = path.join(__dirname, '..', 'packages', 'mockifyer-core');

  it('uses a plain Node shim instead of a TypeScript source entrypoint', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(corePackageRoot, 'package.json'), 'utf8')
    ) as { bin?: Record<string, string> };

    expect(packageJson.bin?.['mockifyer-init-ai']).toBe('./bin/mockifyer-init-ai');

    const binPath = path.join(corePackageRoot, 'bin', 'mockifyer-init-ai');
    const binScript = fs.readFileSync(binPath, 'utf8');

    expect(binScript).toMatch(/^#!\/usr\/bin\/env node/);
    expect(binScript).toContain("require('../dist/cli/init-ai-docs.js')");
    expect(binScript).not.toContain('ts-node');
  });
});
