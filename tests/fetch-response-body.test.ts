import {
  bodyInitForFetchResponse,
  isFetchNullBodyStatus,
} from '../packages/mockifyer-fetch/src/utils/fetch-response-body';

describe('bodyInitForFetchResponse', () => {
  it('treats 101/103/204/205/304 as null-body statuses', () => {
    for (const status of [101, 103, 204, 205, 304]) {
      expect(isFetchNullBodyStatus(status)).toBe(true);
      expect(bodyInitForFetchResponse(status, '')).toBeNull();
      expect(bodyInitForFetchResponse(status, null)).toBeNull();
      expect(bodyInitForFetchResponse(status, { ok: true })).toBeNull();
    }
  });

  it('allows constructing undici Response for 204 with null body', () => {
    expect(() => new Response(bodyInitForFetchResponse(204, ''), { status: 204 })).not.toThrow();
    expect(() => new Response('', { status: 204 })).toThrow(/Invalid response status code 204|null body status/i);
  });

  it('serializes non-null-body responses as before', () => {
    expect(bodyInitForFetchResponse(200, { a: 1 })).toBe('{"a":1}');
    expect(bodyInitForFetchResponse(200, 'plain')).toBe('plain');
    expect(bodyInitForFetchResponse(404, null)).toBe('null');
  });
});
