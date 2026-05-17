import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mockifyer multi-service demo',
  description: 'Next.js + two internal APIs, shared MOCKIFYER_CLIENT_ID',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui', margin: '2rem', maxWidth: '52rem' }}>
        {children}
      </body>
    </html>
  );
}
