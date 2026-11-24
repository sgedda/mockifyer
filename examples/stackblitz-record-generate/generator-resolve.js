/**
 * Resolve `@sgedda/mockifyer-generator` without requiring it on npm yet.
 *
 * Priority:
 * 1. Installed package (node_modules) — works once published / optionalDep installs
 * 2. Monorepo build at ../../packages/mockifyer-generator/dist — local clone only
 * 3. null — caller prints the publish blocker
 */
import { createRequire } from 'module';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const MONOREPO_CLI = path.resolve(
  __dirname,
  '../../packages/mockifyer-generator/dist/cli/index.js'
);
const MONOREPO_MAIN = path.resolve(
  __dirname,
  '../../packages/mockifyer-generator/dist/index.js'
);

export const GENERATOR_PUBLISH_HINT = `@sgedda/mockifyer-generator is not published to npm yet.

  What works today without it:
    npm run record
    npm run replay

  After publish (tag generator-v0.1.0 — see packages/mockifyer-generator/README.md):
    npm install @sgedda/mockifyer-generator
    npm run generate
    npm run sample

  Local monorepo (this repo clone):
    npm --prefix ../../packages/mockifyer-generator run build
    # then re-run npm run generate — this script will use the dist/ CLI`;

/**
 * @returns {Promise<{ kind: 'package' | 'monorepo', cliPath: string | null, main: string | null } | null>}
 */
export async function resolveGenerator() {
  try {
    const pkgJson = require.resolve('@sgedda/mockifyer-generator/package.json');
    const pkgDir = path.dirname(pkgJson);
    const cliPath = path.join(pkgDir, 'dist', 'cli', 'index.js');
    const main = path.join(pkgDir, 'dist', 'index.js');
    if (existsSync(cliPath) || existsSync(main)) {
      return {
        kind: 'package',
        cliPath: existsSync(cliPath) ? cliPath : null,
        main: existsSync(main) ? main : null,
      };
    }
  } catch {
    // not installed
  }

  if (existsSync(MONOREPO_CLI) || existsSync(MONOREPO_MAIN)) {
    return {
      kind: 'monorepo',
      cliPath: existsSync(MONOREPO_CLI) ? MONOREPO_CLI : null,
      main: existsSync(MONOREPO_MAIN) ? MONOREPO_MAIN : null,
    };
  }

  return null;
}

/** @param {string} filePath */
export function toImportUrl(filePath) {
  return pathToFileURL(filePath).href;
}
