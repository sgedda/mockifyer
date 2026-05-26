export interface DemoUpstreamOk {
  source: string;
  status: number;
  data: unknown;
}

/**
 * Next.js/Turbopack may bind `fetch` at bundle time. Mockifyer patches `globalThis.fetch` in
 * `instrumentation.ts`, so we must read it from `globalThis` when the module runs.
 */
function serverFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return globalThis.fetch(input, init);
}

const JSON_HEADERS = { Accept: 'application/json' } as const;

export async function fetchDemoPost(): Promise<DemoUpstreamOk> {
  const res = await serverFetch('https://jsonplaceholder.typicode.com/posts/1', {
    headers: JSON_HEADERS,
    cache: 'no-store',
  });
  const data: unknown = await parseJsonResponse(res);
  return { source: 'jsonplaceholder', status: res.status, data };
}

export async function fetchDemoGithubUser(): Promise<DemoUpstreamOk> {
  const res = await serverFetch('https://api.github.com/users/octocat', {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'mockifyer-nextjs-example',
    },
    cache: 'no-store',
  });
  const data: unknown = await parseJsonResponse(res);
  return { source: 'github', status: res.status, data };
}

export async function fetchDemoDogImage(): Promise<DemoUpstreamOk> {
  const res = await serverFetch('https://dog.ceo/api/breeds/image/random', {
    headers: JSON_HEADERS,
    cache: 'no-store',
  });
  const data: unknown = await parseJsonResponse(res);
  return { source: 'dog.ceo', status: res.status, data };
}

async function parseJsonResponse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text.trim()) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(
      `Expected JSON from upstream (HTTP ${String(res.status)}): ${text.slice(0, 160)}${text.length > 160 ? '…' : ''}`
    );
  }
}
