'use client';

import { useCallback, useState } from 'react';

interface ApiSliceState {
  loading: boolean;
  payload: unknown;
  error: string | null;
}

const initial: ApiSliceState = { loading: false, payload: null, error: null };

export function HomeDemoApis() {
  const [post, setPost] = useState<ApiSliceState>(initial);
  const [github, setGithub] = useState<ApiSliceState>(initial);
  const [dog, setDog] = useState<ApiSliceState>(initial);

  const load = useCallback(async (path: string, setter: (s: ApiSliceState) => void) => {
    setter({ loading: true, payload: null, error: null });
    try {
      const res = await fetch(path, { cache: 'no-store' });
      const json: unknown = await res.json();
      if (!res.ok) {
        const errObj = json as { error?: string };
        throw new Error(errObj.error ?? `HTTP ${String(res.status)}`);
      }
      setter({ loading: false, payload: json, error: null });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setter({ loading: false, payload: null, error: message });
    }
  }, []);

  const loadAll = useCallback(() => {
    void load('/api/open/demo/post', setPost);
    void load('/api/open/demo/github', setGithub);
    void load('/api/open/demo/dog', setDog);
  }, [load]);

  const anyLoading = post.loading || github.loading || dog.loading;

  return (
    <section style={{ marginTop: '2.25rem' }}>
      <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem', color: 'var(--muted)' }}>
        Try the APIs here
      </h2>
      <p className="muted" style={{ margin: '0 0 1rem', maxWidth: '40rem', lineHeight: 1.55 }}>
        These calls hit open route handlers (<code>/api/open/demo/*</code>). Each handler uses
        server <code>fetch</code>, so with <code>dev:record</code> you should see mocks under{' '}
        <code>mock-data/default/</code> after loading (no sign-in required on this page).
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        <button type="button" className="btn btn-primary" disabled={anyLoading} onClick={loadAll}>
          {anyLoading ? 'Loading…' : 'Load all three'}
        </button>
      </div>

      <div className="card">
        <h2>JSONPlaceholder · GET /posts/1</h2>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ marginBottom: '0.75rem' }}
          disabled={post.loading}
          onClick={() => void load('/api/open/demo/post', setPost)}
        >
          {post.loading ? 'Loading…' : 'Load post'}
        </button>
        {post.error ? <p className="error">{post.error}</p> : null}
        {post.payload ? <pre className="data">{JSON.stringify(post.payload, null, 2)}</pre> : null}
      </div>

      <div className="card">
        <h2>GitHub · GET /users/octocat</h2>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ marginBottom: '0.75rem' }}
          disabled={github.loading}
          onClick={() => void load('/api/open/demo/github', setGithub)}
        >
          {github.loading ? 'Loading…' : 'Load profile'}
        </button>
        {github.error ? <p className="error">{github.error}</p> : null}
        {github.payload ? (
          <pre className="data">{JSON.stringify(github.payload, null, 2)}</pre>
        ) : null}
      </div>

      <div className="card">
        <h2>Dog API · random breed image</h2>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ marginBottom: '0.75rem' }}
          disabled={dog.loading}
          onClick={() => void load('/api/open/demo/dog', setDog)}
        >
          {dog.loading ? 'Loading…' : 'Load dog'}
        </button>
        {dog.error ? <p className="error">{dog.error}</p> : null}
        {dog.payload ? <pre className="data">{JSON.stringify(dog.payload, null, 2)}</pre> : null}
      </div>
    </section>
  );
}
