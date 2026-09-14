import {
  decodeMockFilenameParam,
  parseRedisHashFromFilename,
} from '../packages/mockifyer-dashboard/src/utils/mock-filename';

const HASH = '97db31e9e128bd9d74eb4004a8e40a27246b338ca6aa12597abb38c9f3f2cc14';
const FILENAME = `redis/${HASH}.json`;

describe('mock filename parsing', () => {
  it('parses redis/<64-hex>.json', () => {
    expect(parseRedisHashFromFilename(FILENAME)).toBe(HASH);
  });

  it('parses a fully encodeURIComponent filename (slash as %2F)', () => {
    expect(parseRedisHashFromFilename(encodeURIComponent(FILENAME))).toBe(HASH);
  });

  it('rejects GET catch-all paths that include /field-overrides', () => {
    expect(parseRedisHashFromFilename(`${FILENAME}/field-overrides`)).toBeNull();
  });

  it('rejects non-redis names', () => {
    expect(parseRedisHashFromFilename('host/graphql/file.json')).toBeNull();
  });

  it('decodes percent-encoded slashes', () => {
    expect(decodeMockFilenameParam(`redis%2F${HASH}.json`)).toBe(FILENAME);
  });
});
