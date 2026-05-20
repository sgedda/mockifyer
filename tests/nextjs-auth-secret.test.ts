import {
  LOCAL_DEMO_AUTH_SECRET,
  resolveAuthSecret,
} from '../example-projects/nextjs-clerk-example/lib/auth-secret';

describe('nextjs example auth secret resolution', () => {
  it('uses an explicit AUTH_SECRET when present', () => {
    expect(resolveAuthSecret({ NODE_ENV: 'production', AUTH_SECRET: '  real-secret  ' })).toBe('real-secret');
  });

  it('does not use the public fallback secret in production', () => {
    expect(resolveAuthSecret({ NODE_ENV: 'production', AUTH_SECRET: undefined })).toBeUndefined();
  });

  it('keeps the zero-config fallback for local development', () => {
    expect(resolveAuthSecret({ NODE_ENV: 'development', AUTH_SECRET: undefined })).toBe(LOCAL_DEMO_AUTH_SECRET);
  });
});
