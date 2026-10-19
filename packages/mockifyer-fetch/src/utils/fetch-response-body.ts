/**
 * Fetch "null body status" codes — Response body must be null.
 * Passing '' / JSON (including JSON.stringify(null) → "null") throws in undici:
 * `TypeError: Response constructor: Invalid response status code 204`
 *
 * @see https://fetch.spec.whatwg.org/#null-body-status
 */
const FETCH_NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304]);

/**
 * Whether `status` forbids a Response body under the Fetch spec.
 */
export function isFetchNullBodyStatus(status: number): boolean {
  return FETCH_NULL_BODY_STATUSES.has(status);
}

/**
 * Body argument for `new Response(body, { status })`.
 * Returns `null` for null-body statuses so Node/undici does not throw.
 */
export function bodyInitForFetchResponse(status: number, data: unknown): BodyInit | null {
  if (isFetchNullBodyStatus(status)) {
    return null;
  }
  if (typeof data === 'string') {
    return data;
  }
  // JSON.stringify(undefined) is undefined — Response treats nullish as empty body
  if (data === undefined) {
    return null;
  }
  return JSON.stringify(data);
}
