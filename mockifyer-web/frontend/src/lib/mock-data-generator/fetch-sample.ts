/**
 * Browser-side GET of a JSON sample URL (playground only).
 * No Mockifyer proxy — the request goes from the user's browser to the URL.
 */

export type FetchSampleResult =
  | { ok: true; text: string; json: unknown; url: string }
  | { ok: false; kind: 'cors' | 'network' | 'http' | 'invalid_json' | 'invalid_url'; message: string }

const CORS_HINT =
  'This URL blocked the browser (CORS) or could not be reached. Paste the JSON response instead, or record it with Mockifyer.'

/**
 * GET `url` and parse JSON. Caller must only invoke on an explicit user click.
 */
export async function fetchSampleFromUrl(rawUrl: string): Promise<FetchSampleResult> {
  const trimmed = rawUrl.trim()
  if (!trimmed) {
    return { ok: false, kind: 'invalid_url', message: 'Enter a URL to fetch.' }
  }

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return {
      ok: false,
      kind: 'invalid_url',
      message: 'That does not look like a valid URL (include https://…).',
    }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return {
      ok: false,
      kind: 'invalid_url',
      message: 'Only http(s) URLs are supported.',
    }
  }

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      headers: { Accept: 'application/json, text/plain, */*' },
    })

    if (!response.ok) {
      return {
        ok: false,
        kind: 'http',
        message: `The server responded with ${response.status} ${response.statusText || ''}. Try another URL or paste the JSON.`.trim(),
      }
    }

    const text = await response.text()
    try {
      const json = JSON.parse(text) as unknown
      const pretty = `${JSON.stringify(json, null, 2)}\n`
      return { ok: true, text: pretty, json, url: url.toString() }
    } catch {
      return {
        ok: false,
        kind: 'invalid_json',
        message: 'The response was not valid JSON. Paste a JSON body instead.',
      }
    }
  } catch {
    return { ok: false, kind: 'cors', message: CORS_HINT }
  }
}
