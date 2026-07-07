import {
  ENV_VARS,
  resolveProxyUpstreamTlsInsecure,
  resolveProxyUpstreamTlsInsecureForRequest,
} from '@sgedda/mockifyer-core';

describe('resolveProxyUpstreamTlsInsecure', () => {
  const envKey = ENV_VARS.MOCK_UPSTREAM_TLS_INSECURE;

  afterEach(() => {
    delete process.env[envKey];
  });

  it('defaults to false', () => {
    expect(resolveProxyUpstreamTlsInsecure({})).toBe(false);
    expect(resolveProxyUpstreamTlsInsecure({ proxy: { baseUrl: 'http://localhost:3002' } })).toBe(false);
  });

  it('respects proxy.upstreamTlsInsecure: true', () => {
    expect(
      resolveProxyUpstreamTlsInsecure({
        proxy: { baseUrl: 'http://localhost:3002', upstreamTlsInsecure: true },
      })
    ).toBe(true);
  });

  it('env wins over config', () => {
    process.env[envKey] = 'false';
    expect(
      resolveProxyUpstreamTlsInsecure({
        proxy: { baseUrl: 'http://localhost:3002', upstreamTlsInsecure: true },
      })
    ).toBe(false);

    process.env[envKey] = 'true';
    expect(
      resolveProxyUpstreamTlsInsecure({
        proxy: { baseUrl: 'http://localhost:3002', upstreamTlsInsecure: false },
      })
    ).toBe(true);
  });
});

describe('resolveProxyUpstreamTlsInsecureForRequest', () => {
  const envKey = ENV_VARS.MOCK_UPSTREAM_TLS_INSECURE;

  afterEach(() => {
    delete process.env[envKey];
  });

  it('ignores body booleans so proxy callers cannot downgrade TLS verification', () => {
    expect(resolveProxyUpstreamTlsInsecureForRequest(true)).toBe(false);
    expect(resolveProxyUpstreamTlsInsecureForRequest(false)).toBe(false);
  });

  it('falls back to dashboard env when body omitted', () => {
    process.env[envKey] = 'true';
    expect(resolveProxyUpstreamTlsInsecureForRequest(undefined)).toBe(true);
  });
});
