import {
  isJsonResponseContentType,
  readDriftResponseBody,
} from '@sgedda/mockifyer-core/utils/drift';

function responseWith(contentType: string | null, body: string) {
  return {
    headers: {
      get(name: string): string | null {
        return name.toLowerCase() === 'content-type' ? contentType : null;
      },
    },
    text: async () => body,
  };
}

describe('drift response body', () => {
  it('treats +json media types as JSON', () => {
    expect(isJsonResponseContentType('application/vnd.github+json')).toBe(true);
    expect(isJsonResponseContentType('application/vnd.api+json; charset=utf-8')).toBe(true);
    expect(isJsonResponseContentType('application/problem+json')).toBe(true);
    expect(isJsonResponseContentType('application/ld+json')).toBe(true);
    expect(isJsonResponseContentType('APPLICATION/JSON; charset=UTF-8')).toBe(true);
  });

  it('does not treat non-JSON media types as JSON', () => {
    expect(isJsonResponseContentType('text/plain')).toBe(false);
    expect(isJsonResponseContentType('application/json-seq')).toBe(false);
    expect(isJsonResponseContentType('text/html')).toBe(false);
    expect(isJsonResponseContentType(null)).toBe(false);
    expect(isJsonResponseContentType('')).toBe(false);
  });

  it('parses a +json body into an object', async () => {
    const body = await readDriftResponseBody(
      responseWith('application/vnd.github+json', '{"id":9,"name":"Vendor"}')
    );
    expect(body).toEqual({ id: 9, name: 'Vendor' });
  });

  it('strips a UTF-8 BOM before parsing JSON', async () => {
    const body = await readDriftResponseBody(
      responseWith('application/json', '\uFEFF{"ok":true}')
    );
    expect(body).toEqual({ ok: true });
  });

  it('returns text when the media type is not JSON', async () => {
    const raw = '{"id":1}';
    const body = await readDriftResponseBody(responseWith('text/plain', raw));
    expect(body).toBe(raw);
  });

  it('returns the raw text when a JSON media type is not valid JSON', async () => {
    const raw = 'not-json';
    const body = await readDriftResponseBody(responseWith('application/json', raw));
    expect(body).toBe(raw);
  });
});
