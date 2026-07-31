import type { SetupMockifyerFn } from './init-mockifyer-presets';

const AXIOS_PACKAGE = '@sgedda/mockifyer-axios';
const FETCH_PACKAGE = '@sgedda/mockifyer-fetch';

/**
 * Lazily loads `setupMockifyer` from `@sgedda/mockifyer-axios` (optional install).
 */
export function loadAxiosSetupMockifyer(): SetupMockifyerFn<unknown> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(AXIOS_PACKAGE) as { setupMockifyer?: SetupMockifyerFn<unknown> };
    if (typeof mod.setupMockifyer !== 'function') {
      throw new Error('setupMockifyer export missing');
    }
    return mod.setupMockifyer;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `useGlobalAxios requires ${AXIOS_PACKAGE} to be installed (and axios). ` +
        `Install with: npm install ${AXIOS_PACKAGE} axios. (${detail})`
    );
  }
}

/**
 * Lazily loads `setupMockifyer` from `@sgedda/mockifyer-fetch` (optional install).
 */
export function loadFetchSetupMockifyer(): SetupMockifyerFn<unknown> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(FETCH_PACKAGE) as { setupMockifyer?: SetupMockifyerFn<unknown> };
    if (typeof mod.setupMockifyer !== 'function') {
      throw new Error('setupMockifyer export missing');
    }
    return mod.setupMockifyer;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `useGlobalFetch requires ${FETCH_PACKAGE} to be installed. ` +
        `Install with: npm install ${FETCH_PACKAGE}. (${detail})`
    );
  }
}
