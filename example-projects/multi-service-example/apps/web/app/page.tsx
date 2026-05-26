'use client';

import { useCallback, useState } from 'react';

export default function HomePage(): React.ReactElement {
  const [loading, setLoading] = useState(false);
  const [json, setJson] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runChain = useCallback(async () => {
    setLoading(true);
    setError(null);
    setJson(null);
    try {
      const res = await fetch('/api/demo/chain', { cache: 'no-store' });
      const data: unknown = await res.json();
      setJson(JSON.stringify(data, null, 2));
      if (!res.ok) {
        setError(`HTTP ${String(res.status)}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <main>
      <h1>Mockifyer multi-service example</h1>
      <p>
        Web (Next.js, <strong>3040</strong>) → <strong>gateway-api</strong> (<strong>4101</strong>,
        Mockifyer + <code>fetch</code>) → <strong>relay-axios-api</strong> (<strong>4103</strong>,
        Mockifyer + <code>axios</code>) → <strong>catalog-api</strong> (<strong>4102</strong>,
        Mockifyer + <code>fetch</code>) → JSONPlaceholder. Use one{' '}
        <code>MOCKIFYER_CLIENT_ID</code> and <code>MOCKIFYER_PATH</code> across all processes.
      </p>
      <p style={{ fontSize: '0.95rem', color: '#475569', marginTop: '1rem', maxWidth: '42rem' }}>
        <strong>Replay note:</strong> if logs show <code>Mock hit</code> for{' '}
        <code>GET …4101/aggregate</code>, Mockifyer never calls the gateway—the axios relay will not run.
        Remove matching files under your scenario folder (usually <code>mock-data/default/</code>), e.g.
        filenames containing <code>4101</code> and <code>aggregate</code>, to force a live hop through
        relay (4103).
      </p>
      <button type="button" onClick={runChain} disabled={loading}>
        {loading ? 'Running…' : 'Run chain'}
      </button>
      {error ? (
        <p style={{ color: 'crimson' }} role="alert">
          {error}
        </p>
      ) : null}
      {json ? (
        <pre
          style={{
            marginTop: '1.25rem',
            padding: '1rem',
            background: '#0f172a',
            color: '#e2e8f0',
            overflow: 'auto',
            borderRadius: '8px',
            fontSize: '13px',
          }}
        >
          {json}
        </pre>
      ) : null}
    </main>
  );
}
