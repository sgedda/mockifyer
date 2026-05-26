import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { DEMO_PROVIDER_ID } from '@/lib/auth-constants';

const PROVIDER_ENV_HINTS =
  'AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET and/or AUTH_GITHUB_ID + AUTH_GITHUB_SECRET';

/** In-repo example only — set `AUTH_SECRET` for any deployed or shared environment. */
const FALLBACK_SECRET_FOR_ZERO_CONFIG_LOCAL =
  'mockifyer-next-example-insecure-fallback-change-auth-secret-if-shared';

function readPair(clientIdEnv: string, secretEnv: string): { clientId: string; clientSecret: string } | undefined {
  const clientId = process.env[clientIdEnv]?.trim();
  const clientSecret = process.env[secretEnv]?.trim();
  if (!clientId || !clientSecret) {
    return undefined;
  }
  return { clientId, clientSecret };
}

function allowDemoCredentialLogin(oAuthProviderCount: number): boolean {
  if (oAuthProviderCount > 0) {
    return false;
  }
  const allowExplicit = ['1', 'true', 'yes'].includes(process.env.AUTH_ALLOW_DEMO?.trim().toLowerCase() ?? '');
  if (process.env.NODE_ENV === 'production' && !allowExplicit) {
    return false;
  }
  /** Enabled in `next dev` (non-production) without OAuth, or in production when `AUTH_ALLOW_DEMO=true`. */
  return true;
}

const google = readPair('AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET');
const github = readPair('AUTH_GITHUB_ID', 'AUTH_GITHUB_SECRET');

/** Skip registering OAuth when env is missing — avoids crashing with empty OAuth credentials. */
const providers = [];
if (google) {
  providers.push(Google({ clientId: google.clientId, clientSecret: google.clientSecret }));
}
if (github) {
  providers.push(GitHub({ clientId: github.clientId, clientSecret: github.clientSecret }));
}

if (allowDemoCredentialLogin(providers.length)) {
  providers.push(
    Credentials({
      id: DEMO_PROVIDER_ID,
      name: 'Local demo account',
      credentials: {},
      async authorize() {
        /**
         * Intentionally no password — this provider is identical for every clone of the repo.
         * Disabled in production unless `AUTH_ALLOW_DEMO=true`; never use for sensitive data.
         */
        return {
          id: 'demo-user-local',
          name: 'Demo user',
          email: 'demo@example.local',
        };
      },
    })
  );
  console.warn(`[auth] OAuth not configured — "${DEMO_PROVIDER_ID}" sign-in is enabled (examples only). ${PROVIDER_ENV_HINTS}`);
} else if (providers.length === 0) {
  console.warn(`[auth] No auth providers configured. Set ${PROVIDER_ENV_HINTS} or production demo via AUTH_ALLOW_DEMO=true (+ AUTH_SECRET). See README.`);
}

const resolvedSecret =
  process.env.AUTH_SECRET?.trim() || FALLBACK_SECRET_FOR_ZERO_CONFIG_LOCAL;

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: resolvedSecret,
  providers,
  callbacks: {
    async jwt(params) {
      const { token, user } = params;
      if (user) {
        token.sub = user.id;
        token.name = user.name ?? undefined;
        token.email = user.email ?? undefined;
        token.picture = user.image ?? undefined;
      }
      return token;
    },
    async session(params) {
      const { session, token } = params;
      if (session.user) {
        session.user.name = (typeof token.name === 'string' ? token.name : undefined) ?? session.user.name;
        session.user.email = (typeof token.email === 'string' ? token.email : undefined) ?? session.user.email;
        session.user.image = (typeof token.picture === 'string' ? token.picture : undefined) ?? session.user.image;
      }
      return session;
    },
  },
});
