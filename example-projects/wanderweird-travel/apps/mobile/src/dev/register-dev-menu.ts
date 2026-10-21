import { DevSettings, Platform } from 'react-native';

interface DevMenuRouter {
  push: (href: '/dev-menu') => void;
}

/**
 * Shake-device Dev Menu entry → Mockifyer developer screen (native __DEV__ only).
 */
export function registerMockifyerDevMenuShortcut(router: DevMenuRouter): () => void {
  if (!__DEV__ || Platform.OS === 'web') {
    return () => undefined;
  }

  DevSettings.addMenuItem('Mockifyer Dev Menu', () => {
    router.push('/dev-menu');
  });

  // DevSettings has no remove API; noop disposer keeps call sites symmetric.
  return () => undefined;
}
