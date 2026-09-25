import type { SetupMockifyerFn } from './init-mockifyer-presets';

const AXIOS_PACKAGE = '@sgedda/mockifyer-axios';
const FETCH_PACKAGE = '@sgedda/mockifyer-fetch';

/**
 * Metro entry for sibling setup loaders.
 *
 * The Node file resolves optional siblings with a non-literal require so a
 * `file:`-linked core install can see the app cwd. Expo's transform rejects
 * that call. Metro prefers this `.native` file and only sees string-literal requires.
 */
function requireKnownSibling(packageName: string): unknown {
  try {
    if (packageName === AXIOS_PACKAGE) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require(/* webpackIgnore: true */ '@sgedda/mockifyer-axios');
    }
    if (packageName === FETCH_PACKAGE) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require(/* webpackIgnore: true */ '@sgedda/mockifyer-fetch');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const missingPackage =
      message.includes(`Cannot find module '${packageName}'`) ||
      message.includes(`Cannot find module "${packageName}"`) ||
      message.includes(`Cannot resolve module '${packageName}'`) ||
      message.includes(`Cannot resolve module "${packageName}"`);
    if (!missingPackage) {
      throw error;
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
    mod = requireKnownSibling(packageName) as { setupMockifyer?: SetupMockifyerFn<unknown> };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${missingMessage} (${detail})`);
  }
  if (typeof mod.setupMockifyer !== 'function') {
    throw new Error(`${missingMessage} (setupMockifyer export missing)`);
  }
  return mod.setupMockifyer;
}

/** Lazily loads `setupMockifyer` from `@sgedda/mockifyer-axios` (optional install). */
export function loadAxiosSetupMockifyer(): SetupMockifyerFn<unknown> {
  return loadSetupMockifyer(
    AXIOS_PACKAGE,
    `useGlobalAxios requires ${AXIOS_PACKAGE} to be installed (and axios). ` +
      `Install with: npm install ${AXIOS_PACKAGE} axios.`
  );
}

/** Lazily loads `setupMockifyer` from `@sgedda/mockifyer-fetch` (optional install). */
export function loadFetchSetupMockifyer(): SetupMockifyerFn<unknown> {
  return loadSetupMockifyer(
    FETCH_PACKAGE,
    `useGlobalFetch requires ${FETCH_PACKAGE} to be installed. ` +
      `Install with: npm install ${FETCH_PACKAGE}.`
  );
}
