import {
  inferMountPrefixFromPathname,
  resolveApiBase,
  resolveRouterBasename,
  resolveScriptSrcToMountPrefix,
} from '../packages/mockifyer-dashboard/frontend/src/lib/dashboard-mount';

describe('dashboard mount inference (embedded /mockifyer)', () => {
  it('reads the prefix from /mockifyer/overrides', () => {
    expect(inferMountPrefixFromPathname('/mockifyer/overrides')).toBe('/mockifyer');
    expect(inferMountPrefixFromPathname('/mockifyer/overrides/')).toBe('/mockifyer');
  });

  it('treats the dashboard home as the Express mount', () => {
    expect(inferMountPrefixFromPathname('/mockifyer')).toBe('/mockifyer');
    expect(inferMountPrefixFromPathname('/mockifyer/')).toBe('/mockifyer');
  });

  it('has no prefix for standalone /overrides', () => {
    expect(inferMountPrefixFromPathname('/overrides')).toBe('');
    expect(inferMountPrefixFromPathname('/')).toBe('');
  });

  it('prefers the page mount for API and router even when Vite base is /', () => {
    expect(resolveApiBase('/', '/mockifyer')).toBe('/mockifyer/api');
    expect(resolveApiBase('./', '/mockifyer')).toBe('/mockifyer/api');
    expect(resolveRouterBasename('/', '/mockifyer')).toBe('/mockifyer');
    expect(resolveRouterBasename('./', '')).toBeUndefined();
    expect(resolveApiBase('/', '')).toBe('/api');
  });

  it('resolves relative ./assets against the page URL, not origin', () => {
    expect(
      resolveScriptSrcToMountPrefix(
        './assets/index-abc.js',
        'http://localhost:4000/mockifyer/overrides'
      )
    ).toBe('/mockifyer');
    expect(
      resolveScriptSrcToMountPrefix(
        './assets/index-abc.js',
        'http://localhost:4000/mockifyer/overrides/'
      )
    ).toBe('/mockifyer/overrides');
    expect(
      resolveScriptSrcToMountPrefix('./assets/index-abc.js', 'http://localhost:4000/overrides')
    ).toBe('');
    expect(
      resolveScriptSrcToMountPrefix(
        './assets/index-abc.js',
        'http://localhost:4000/'
      )
    ).toBe('');
  });
});
