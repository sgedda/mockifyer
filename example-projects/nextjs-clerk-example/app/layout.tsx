import type { Metadata } from 'next';
import { ClerkProvider, SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mockifyer · Next.js + Clerk',
  description: 'Demo dashboard with server-side HTTP mocks',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link
            href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&display=swap"
            rel="stylesheet"
          />
        </head>
        <body>
          <header className="top-bar">
            <Link href="/" className="brand">
              Mockifyer demo
            </Link>
            <nav className="nav-actions">
              <SignedIn>
                <Link href="/dashboard">Dashboard</Link>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  <button type="button" className="btn-secondary">
                    Sign in
                  </button>
                </SignInButton>
              </SignedOut>
            </nav>
          </header>
          <main className="main-shell">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
