import type { SetupMockifyerFn } from './init-mockifyer-presets';

const AXIOS_PACKAGE = '@sgedda/mockifyer-axios';
const FETCH_PACKAGE = '@sgedda/mockifyer-fetch';

function parentDir(filePath: string): string | undefined {
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  if (idx <= 0) {
    return undefined;
  }
  return filePath.slice(0, idx);
}

/**
 * Directories to search after the current module's `require` paths.
 *
 * When `@sgedda/mockifyer-core` is linked with `file:` / `npm link`, Node resolves
 * `require('@sgedda/mockifyer-fetch')` from the core package folder — not from the
 * consuming app — so a perfectly valid app install is invisible. Search the app
 * cwd (and entry-point directory) as well.
 *
 * Avoid Node builtins (`path`, `module`) here: this file is reachable from the
 * React Native entry.
 */
export function siblingPackageResolveDirectories(): string[] {
  const directories: string[] = [];
  const add = (directory: string | undefined) => {
    if (!directory) {
      return;
    }
    if (!directories.includes(directory)) {
      directories.push(directory);
    }
  };

  add(typeof process.cwd === 'function' ? process.cwd() : undefined);
  add(typeof process.env?.INIT_CWD === 'string' ? process.env.INIT_CWD : undefined);
  if (typeof require.main?.filename === 'string') {
    add(parentDir(require.main.filename));
  }
  if (typeof process.argv?.[1] === 'string' && process.argv[1].length > 0) {
    add(parentDir(process.argv[1]));
  }
  return directories;
}

function isMissingRequestedPackage(error: unknown, packageName: string): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const err = error as NodeJS.ErrnoException;
  const message = typeof err.message === 'string' ? err.message : '';
  // Node: Cannot find module 'pkg'. Jest: Cannot resolve module 'pkg' from paths [...].
  return (
    message.includes(`Cannot find module '${packageName}'`) ||
    message.includes(`Cannot find module "${packageName}"`) ||
    message.includes(`Cannot resolve module '${packageName}'`) ||
    message.includes(`Cannot resolve module "${packageName}"`)
  );
}

/**
 * Require an optional sibling package from this module, then from the app.
 * Exported for unit tests (cwd fallback when core is `file:`-linked).
 */
export function requireSiblingPackage(packageName: string): unknown {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  try {
    return require(packageName);
  } catch (error) {
    if (!isMissingRequestedPackage(error, packageName)) {
      throw error;
    }
  }

  const triedResolved = new Set<string>();
  for (const directory of siblingPackageResolveDirectories()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const resolved = require.resolve(packageName, { paths: [directory] });
      if (triedResolved.has(resolved)) {
        continue;
      }
      triedResolved.add(resolved);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require(resolved);
    } catch (error) {
      if (!isMissingRequestedPackage(error, packageName)) {
        throw error;
      }
    }
  }

  const missing = new Error(`Cannot find module '${packageName}'`) as NodeJS.ErrnoException;
  missing.code = 'MODULE_NOT_FOUND';
  throw missing;
}

function loadSetupMockifyer(
  packageName: string,
  missingMessage: string
): SetupMockifyerFn<unknown> {
  let mod: { setupMockifyer?: SetupMockifyerFn<unknown> };
  try {
    mod = requireSiblingPackage(packageName) as { setupMockifyer?: SetupMockifyerFn<unknown> };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${missingMessage} (${detail})`);
  }
  if (typeof mod.setupMockifyer !== 'function') {
    throw new Error(`${missingMessage} (setupMockifyer export missing)`);
  }
  return mod.setupMockifyer;
}

/**
 * Lazily loads `setupMockifyer` from `@sgedda/mockifyer-axios` (optional install).
 */
export function loadAxiosSetupMockifyer(): SetupMockifyerFn<unknown> {
  return loadSetupMockifyer(
    AXIOS_PACKAGE,
    `useGlobalAxios requires ${AXIOS_PACKAGE} to be installed (and axios). ` +
      `Install with: npm install ${AXIOS_PACKAGE} axios.`
  );
}

/**
 * Lazily loads `setupMockifyer` from `@sgedda/mockifyer-fetch` (optional install).
 */
export function loadFetchSetupMockifyer(): SetupMockifyerFn<unknown> {
  return loadSetupMockifyer(
    FETCH_PACKAGE,
    `useGlobalFetch requires ${FETCH_PACKAGE} to be installed. ` +
      `Install with: npm install ${FETCH_PACKAGE}.`
  );
}
