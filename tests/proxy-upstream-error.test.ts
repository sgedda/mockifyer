import {
  formatProxyFailureDetails,
  wrapProxyUpstreamFetchError,
} from '../packages/mockifyer-dashboard/src/utils/proxy-upstream-error';

function fetchFailed(cause: Error & { code?: string; socket?: { bytesRead?: number; remoteAddress?: string; remotePort?: number } }): TypeError {
  const error = new TypeError('fetch failed');
  (error as Error & { cause: unknown }).cause = cause;
  return error;
}

describe('formatProxyFailureDetails', () => {
  it('flattens Undici fetch failed + socket cause so clients see more than "fetch failed"', () => {
    const cause = Object.assign(new Error('other side closed'), {
      code: 'UND_ERR_SOCKET',
      socket: { remoteAddress: '::1', remotePort: 3132, bytesRead: 0 },
    });

    expect(formatProxyFailureDetails(fetchFailed(cause))).toBe(
      'fetch failed: other side closed (UND_ERR_SOCKET): at ::1:3132'
    );
  });

  it('falls back to the error message when there is no cause', () => {
    expect(formatProxyFailureDetails(new Error('upstream blocked'))).toBe('upstream blocked');
  });

  it('walks a plain-object cause that is not instanceof Error', () => {
    const error = Object.assign(new TypeError('fetch failed'), {
      cause: { message: 'other side closed', code: 'UND_ERR_SOCKET' },
    });
    expect(formatProxyFailureDetails(error)).toBe('fetch failed: other side closed (UND_ERR_SOCKET)');
  });
});

describe('wrapProxyUpstreamFetchError', () => {
  it('puts method, url, and cause into Error.message', () => {
    const cause = Object.assign(new Error('other side closed'), { code: 'UND_ERR_SOCKET' });
    const wrapped = wrapProxyUpstreamFetchError(
      'post',
      'http://127.0.0.1:3132/v-2/authenticate',
      fetchFailed(cause)
    );
    expect(wrapped.message).toBe(
      'POST http://127.0.0.1:3132/v-2/authenticate: fetch failed: other side closed (UND_ERR_SOCKET)'
    );
  });

  it('does not wrap twice when the error is already prefixed', () => {
    const once = wrapProxyUpstreamFetchError(
      'POST',
      'http://127.0.0.1:3132/v-2/authenticate',
      new TypeError('fetch failed')
    );
    const twice = wrapProxyUpstreamFetchError(
      'POST',
      'http://127.0.0.1:3132/v-2/authenticate',
      once
    );
    expect(twice.message).toBe(once.message);
    expect(twice).toBe(once);
  });
});
