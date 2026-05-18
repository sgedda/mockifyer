import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import { auth } from '@/auth';
import { SessionProviderShell } from '@/components/session-provider';
import { TopBar } from '@/components/top-bar';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mockifyer · Next.js + OAuth',
  description: 'Demo dashboard with Google/GitHub sign-in and server-side HTTP mocks',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): Promise<ReactElement> {
  const session = await auth();

  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <SessionProviderShell session={session}>
          <TopBar session={session} />
          <main className="main-shell">{children}</main>
        </SessionProviderShell>
      </body>
    </html>
  );
}
