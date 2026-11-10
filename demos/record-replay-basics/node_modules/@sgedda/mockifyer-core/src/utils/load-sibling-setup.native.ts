import type { SetupMockifyerFn } from './init-mockifyer-presets';

/**
 * Metro entry for sibling setup loaders.
 *
 * The Node file resolves optional sibling packages at runtime. Metro follows
 * every string-literal require, including ones marked webpackIgnore, and fails
 * the bundle when the app does not depend on that package. This file is what
 * Metro loads instead. It references neither sibling. Dual-client setup is a Node preset.
 */
function siblingSetupUnavailable(packageLabel: string): SetupMockifyerFn<unknown> {
  return () => {
    throw new Error(
      `${packageLabel} sibling setup is not available in the React Native bundle. ` +
        'Use setupMockifyerForReactNative from the fetch package.'
    );
  };
}

/** Node-only. Present so the Metro graph can load this module without axios. */
export function loadAxiosSetupMockifyer(): SetupMockifyerFn<unknown> {
  return siblingSetupUnavailable('Axios');
}

/** Node-only. Present so the Metro graph can load this module without the fetch package. */
export function loadFetchSetupMockifyer(): SetupMockifyerFn<unknown> {
  return siblingSetupUnavailable('Fetch');
}
