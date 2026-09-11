import {
  inferMountPrefixFromPathname,
  resolveScriptSrcToMountPrefix,
} from '../packages/mockifyer-dashboard/frontend/src/lib/dashboard-mount';

describe('dashboard mount inference (embedded /mockifyer)', () => {
  it('reads the prefix from /mockifyer/overrides', () => {
    expect(inferMountPrefixFromPathname('/mockifyer/overrides')).toBe('/mockifyer');
    expect(inferMountPrefixFromPathname('/mockifyer/overrides/')).toBe('/mockifyer');
  });

  it('has no prefix for standalone /overrides', () => {
    expect(inferMountPrefixFromPathname('/overrides')).toBe('');
    expect(inferMountPrefixFromPathname('/')).toBe('');
  });

  it('resolves relative ./assets against the page URL, not origin', () => {
    expect(
      resolveScriptSrcToMountPrefix(
        './assets/index-abc.js',
        'http://localhost:4000/mockifyer/overrides'
      )
    ).toBe('/mockifyer');
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
