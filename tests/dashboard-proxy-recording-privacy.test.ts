import { toPersistedRequestHeaders } from '../packages/mockifyer-dashboard/src/utils/proxy-recording-privacy';

describe('dashboard proxy recording privacy', () => {
  it('redacts sensitive request headers before storing proxy-recorded mocks', () => {
    const headers = toPersistedRequestHeaders({
      Authorization: 'Bearer live-token',
      'x-api-key': 'api-key-secret',
      Cookie: 'session=secret',
      'Content-Type': 'application/json',
      Accept: undefined,
    });

    expect(headers.Authorization).toBe('[REDACTED]');
    expect(headers['x-api-key']).toBe('[REDACTED]');
    expect(headers.Cookie).toBe('[REDACTED]');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers).not.toHaveProperty('Accept');
  });
});
