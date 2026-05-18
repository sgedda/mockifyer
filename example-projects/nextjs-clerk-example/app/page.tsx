import Link from 'next/link';
import { HomeDemoApis } from './home-demo-apis';

export default function HomePage() {
  return (
    <div>
      <h1 style={{ fontSize: '2rem', letterSpacing: '-0.03em', marginBottom: '0.5rem' }}>
        Next.js + Clerk + Mockifyer
      </h1>
      <p className="muted" style={{ maxWidth: '34rem', lineHeight: 1.6 }}>
        The samples below call the same upstream services as the signed-in dashboard, via public
        API routes. Mockifyer patches server{' '}
        <code style={{ color: 'var(--accent)' }}>fetch</code> from{' '}
        <code style={{ color: 'var(--accent)' }}>instrumentation.ts</code>. Open the dashboard for
        the auth-protected copy of these endpoints.
      </p>
      <div style={{ marginTop: '1.5rem' }}>
        <Link href="/dashboard" className="btn btn-primary">
          Go to dashboard
        </Link>
      </div>
      <HomeDemoApis />
    </div>
  );
}
