import fs from 'fs';
import path from 'path';
import {
  DASHBOARD_PAGE_SUFFIXES,
  dashboardSpaPageAssetPrefix,
  inferMountPrefixFromPathname,
  replaceDashboardPageSuffixesLiteral,
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

  it('has no prefix for standalone /mock and /mocks (not an embed mount)', () => {
    expect(inferMountPrefixFromPathname('/mock')).toBe('');
    expect(inferMountPrefixFromPathname('/mock/')).toBe('');
    expect(inferMountPrefixFromPathname('/mocks')).toBe('');
    expect(inferMountPrefixFromPathname('/mocks/')).toBe('');
    expect(inferMountPrefixFromPathname('/hops')).toBe('');
    expect(inferMountPrefixFromPathname('/hops/')).toBe('');
  });

  it('reads the prefix from /mockifyer/mock and /mockifyer/mocks', () => {
    expect(inferMountPrefixFromPathname('/mockifyer/mock')).toBe('/mockifyer');
    expect(inferMountPrefixFromPathname('/mockifyer/mock/')).toBe('/mockifyer');
    expect(inferMountPrefixFromPathname('/mockifyer/mocks')).toBe('/mockifyer');
    expect(inferMountPrefixFromPathname('/mockifyer/hops')).toBe('/mockifyer');
    expect(inferMountPrefixFromPathname('/mockifyer/mocks/')).toBe('/mockifyer');
  });

  it('prefers the page mount for API and router even when Vite base is /', () => {
    expect(resolveApiBase('/', '/mockifyer')).toBe('/mockifyer/api');
    expect(resolveApiBase('./', '/mockifyer')).toBe('/mockifyer/api');
    expect(resolveRouterBasename('/', '/mockifyer')).toBe('/mockifyer');
    expect(resolveRouterBasename('./', '')).toBeUndefined();
    expect(resolveApiBase('/', '')).toBe('/api');
    expect(resolveRouterBasename('/', inferMountPrefixFromPathname('/mock'))).toBeUndefined();
    expect(resolveApiBase('/', inferMountPrefixFromPathname('/mock'))).toBe('/api');
    expect(resolveRouterBasename('/', inferMountPrefixFromPathname('/mockifyer/mock'))).toBe(
      '/mockifyer'
    );
    expect(resolveApiBase('/', inferMountPrefixFromPathname('/mockifyer/mock'))).toBe(
      '/mockifyer/api'
    );
  });

  it('keeps index.html mount suffixes in sync with DASHBOARD_PAGE_SUFFIXES', () => {
    const html = fs.readFileSync(
      path.join(
        __dirname,
        '../packages/mockifyer-dashboard/frontend/index.html'
      ),
      'utf8'
    );
    const match = html.match(/var suffixes = (\[[^\]]*\])/);
    expect(match).not.toBeNull();
    const fromHtml = JSON.parse((match?.[1] ?? '').replace(/'/g, '"')) as string[];
    expect(fromHtml).toEqual([...DASHBOARD_PAGE_SUFFIXES]);
    expect(fromHtml).toContain('/mock');
    expect(
      replaceDashboardPageSuffixesLiteral("var suffixes = ['/mocks'];")
    ).toContain('"/mock"');
  });

  it('rewrites /mock/assets as a page-relative Vite URL, not an embed mount', () => {
    const prefix = dashboardSpaPageAssetPrefix();
    expect(prefix.test('/mock/assets/main.js')).toBe(true);
    expect(prefix.test('/mocks/assets/main.js')).toBe(true);
    expect(prefix.test('/hops/assets/main.js')).toBe(true);
    expect(prefix.test('/overrides/assets/main.js')).toBe(true);
    expect(prefix.test('/assets/main.js')).toBe(false);
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
