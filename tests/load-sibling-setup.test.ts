import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  requireSiblingPackage,
  siblingPackageResolveDirectories,
  loadFetchSetupMockifyer,
} from '../packages/mockifyer-core/src/utils/load-sibling-setup';

const FAKE_PACKAGE = 'mockifyer-test-sibling-package-not-real';

function writeFakePackage(rootDir: string, packageName: string, source: string): void {
  const packageDir = path.join(rootDir, 'node_modules', packageName);
  fs.mkdirSync(packageDir, { recursive: true });
  fs.writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify({ name: packageName, main: 'index.js' }));
  fs.writeFileSync(path.join(packageDir, 'index.js'), source);
}

describe('sibling package resolution', () => {
  const originalCwd = process.cwd();
  let tempDir: string | undefined;

  afterEach(() => {
    process.chdir(originalCwd);
    for (const key of Object.keys(require.cache)) {
      if (key.includes(FAKE_PACKAGE)) {
        delete require.cache[key];
      }
    }
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('includes process.cwd in fallback directories', () => {
    const directories = siblingPackageResolveDirectories();
    expect(directories).toContain(process.cwd());
  });

  it('loads a package from process.cwd when it is not resolvable from core', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-sibling-'));
    writeFakePackage(
      tempDir,
      FAKE_PACKAGE,
      'module.exports = { setupMockifyer: function setup() { return "from-cwd"; } };'
    );

    expect(() => require(FAKE_PACKAGE)).toThrow(/Cannot find module/);

    process.chdir(tempDir);
    const mod = requireSiblingPackage(FAKE_PACKAGE) as { setupMockifyer: () => string };
    expect(mod.setupMockifyer()).toBe('from-cwd');
  });

  it('throws MODULE_NOT_FOUND when the package is not installed in cwd either', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-sibling-missing-'));
    process.chdir(tempDir);

    expect(() => requireSiblingPackage(FAKE_PACKAGE)).toThrow(/Cannot find module/);
  });

  it('does not swallow a missing nested dependency as "package not installed"', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-sibling-nested-'));
    writeFakePackage(
      tempDir,
      FAKE_PACKAGE,
      "require('definitely-missing-nested-dep-xyz');\nmodule.exports = {};"
    );
    process.chdir(tempDir);

    expect(() => requireSiblingPackage(FAKE_PACKAGE)).toThrow(/definitely-missing-nested-dep-xyz/);
  });

  it('loadFetchSetupMockifyer returns setupMockifyer when fetch is resolvable', () => {
    const setup = loadFetchSetupMockifyer();
    expect(typeof setup).toBe('function');
  });
});
