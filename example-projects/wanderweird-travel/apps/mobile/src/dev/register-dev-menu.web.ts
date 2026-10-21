/** Web: no native DevSettings menu. */
export function registerMockifyerDevMenuShortcut(_router: {
  push: (href: '/dev-menu') => void;
}): () => void {
  return () => undefined;
}
