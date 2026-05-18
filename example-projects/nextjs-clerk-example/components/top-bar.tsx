import Link from 'next/link';
import type { ReactElement } from 'react';
import type { Session } from 'next-auth';
import { signOutAction } from '@/actions/sign-out-action';

interface TopBarProps {
  session: Session | null;
}

export function TopBar(props: TopBarProps): ReactElement {
  const { session } = props;
  const user = session?.user;

  return (
    <header className="top-bar">
      <Link href="/" className="brand">
        Mockifyer demo
      </Link>
      <nav className="nav-actions">
        {user ? (
          <>
            <Link href="/dashboard">Dashboard</Link>
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- dynamic OAuth CDN URLs avoid next/image hostname allowlisting
              <img
                src={user.image}
                alt={user.name ? `Signed in as ${user.name}` : 'Profile'}
                width={28}
                height={28}
                style={{ borderRadius: '999px' }}
              />
            ) : null}
            <span className="muted" style={{ fontSize: '0.9rem', maxWidth: '12rem' }} title={user.email ?? ''}>
              {user.name ?? user.email ?? 'Signed in'}
            </span>
            <form action={signOutAction}>
              <button type="submit" className="btn-secondary">
                Sign out
              </button>
            </form>
          </>
        ) : (
          <Link href="/sign-in" className="btn-secondary" style={{ textDecoration: 'none', display: 'inline-block' }}>
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
