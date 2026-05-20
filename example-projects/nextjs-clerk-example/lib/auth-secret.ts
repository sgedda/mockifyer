/** In-repo example only. This value is public and must never sign deployed sessions. */
export const LOCAL_DEMO_AUTH_SECRET =
  'mockifyer-next-example-insecure-fallback-change-auth-secret-if-shared';

export function resolveAuthSecret(env: Record<string, string | undefined> = process.env): string | undefined {
  const explicitSecret = env.AUTH_SECRET?.trim();
  if (explicitSecret) {
    return explicitSecret;
  }

  if (env.NODE_ENV === 'production') {
    return undefined;
  }

  return LOCAL_DEMO_AUTH_SECRET;
}
