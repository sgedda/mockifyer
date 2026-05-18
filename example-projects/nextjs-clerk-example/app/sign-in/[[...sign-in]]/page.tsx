'use client';

import { Suspense, useCallback, useEffect, useState, type ReactElement } from 'react';
import { useSearchParams } from 'next/navigation';
import { getProviders, signIn } from 'next-auth/react';
import { DEMO_PROVIDER_ID } from '@/lib/auth-constants';

interface ProviderState {
  google: boolean;
  github: boolean;
  demo: boolean;
}

function safeCallback(raw: string | null): string {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) {
    return '/dashboard';
  }
  return raw;
}

function SignInButtons(): ReactElement {
  const searchParams = useSearchParams();
  const callbackUrl = safeCallback(searchParams.get('callbackUrl'));
  const [enabled, setEnabled] = useState<ProviderState | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh(): Promise<void> {
      const map = await getProviders();
      if (cancelled) {
        return;
      }
      setEnabled({
        google: !!(map?.google ?? false),
        github: !!(map?.github ?? false),
        demo: Boolean(map?.[DEMO_PROVIDER_ID]),
      });
    }

    void refresh();
    return (): void => {
      cancelled = true;
    };
  }, []);

  const start = useCallback(
    async (id: string) => {
      await signIn(id, { callbackUrl });
    },
    [callbackUrl]
  );

  const oauthHint = enabled && (enabled.google || enabled.github);

  return (
    <div style={{ maxWidth: '22rem', margin: '0 auto', paddingTop: '1rem' }} className="card">
      <h1 style={{ fontSize: '1.35rem', marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>Sign in</h1>
      <p className="muted" style={{ lineHeight: 1.55, marginBottom: '1.25rem' }}>
        {enabled?.demo ? (
          <>
            Use the built-in <strong>demo account</strong> (no Google/GitHub apps or <code>.env</code> needed for local
            dev), or OAuth when configured. You return to{' '}
            <code style={{ color: 'var(--accent)' }}>{callbackUrl}</code>.
          </>
        ) : (
          <>
            Continue with Google or GitHub OAuth. After sign-in you are returned to{' '}
            <code style={{ color: 'var(--accent)' }}>{callbackUrl}</code>.
          </>
        )}
      </p>
      {enabled === null ? (
        <p className="muted">Loading providers…</p>
      ) : !enabled.google && !enabled.github && !enabled.demo ? (
        <p className="error">
          No sign-in methods are available (production build without OAuth). Configure Google/GitHub in{' '}
          <code>.env.local</code>, or set <code>AUTH_ALLOW_DEMO=true</code> to enable the demo account — see README.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {enabled.demo ? (
            <button type="button" className="btn btn-primary" onClick={() => void start(DEMO_PROVIDER_ID)}>
              Continue as demo user
            </button>
          ) : null}
          {enabled.google ? (
            <button type="button" className="btn btn-secondary" onClick={() => void start('google')}>
              Continue with Google
            </button>
          ) : null}
          {enabled.github ? (
            <button type="button" className="btn btn-secondary" onClick={() => void start('github')}>
              Continue with GitHub
            </button>
          ) : null}
          {enabled.demo ? (
            <span className="muted" style={{ fontSize: '0.82rem', marginTop: '0.25rem', lineHeight: 1.45 }}>
              Demo login is for local examples only; shared or production hosts should set a real <code>AUTH_SECRET</code>{' '}
              and OAuth (or leave demo off unless you knowingly set <code>AUTH_ALLOW_DEMO=true</code>).
            </span>
          ) : null}
          {oauthHint ? (
            <span className="muted" style={{ fontSize: '0.82rem', marginTop: '0.5rem', lineHeight: 1.45 }}>
              In each OAuth provider, set authorized redirect URIs including{' '}
              <code style={{ wordBreak: 'break-all' }}>http://localhost:3000/api/auth/callback/google</code>
              {' and '}
              <code style={{ wordBreak: 'break-all' }}>http://localhost:3000/api/auth/callback/github</code>
              (replace host for production deployments).
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function SignInPage(): ReactElement {
  return (
    <Suspense fallback={<p className="muted" style={{ textAlign: 'center', paddingTop: '2rem' }}>Loading…</p>}>
      <SignInButtons />
    </Suspense>
  );
}
