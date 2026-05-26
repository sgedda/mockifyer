'use client';

import type { ReactElement, ReactNode } from 'react';
import type { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';

interface SessionProviderShellProps {
  children: ReactNode;
  session: Session | null;
}

/** Bridges server session snapshot into React for `signIn` / `signOut` on the client */
export function SessionProviderShell(props: SessionProviderShellProps): ReactElement {
  const { children, session } = props;
  return <SessionProvider session={session ?? undefined}>{children}</SessionProvider>;
}
