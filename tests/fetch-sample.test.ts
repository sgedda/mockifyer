/**
 * Unit tests for playground fetch-sample helper (URL validation paths).
 * Network/CORS paths are covered in Playwright with route interception.
 */
import { fetchSampleFromUrl } from '../mockifyer-web/frontend/src/lib/mock-data-generator/fetch-sample';

describe('fetchSampleFromUrl', () => {
  it('rejects empty and non-http URLs', async () => {
    expect((await fetchSampleFromUrl('')).ok).toBe(false);
    expect((await fetchSampleFromUrl('not a url')).ok).toBe(false);
    expect((await fetchSampleFromUrl('ftp://example.com/x')).ok).toBe(false);
  });
});
