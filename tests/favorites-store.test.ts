import fs from 'fs';
import os from 'os';
import path from 'path';
import type { MockData } from '@sgedda/mockifyer-core';
import {
  buildFavoriteFromMock,
  favoriteIdForMock,
  parseFavoritesDocument,
  readFavoritesFile,
  removeFavorite,
  upsertFavorite,
  writeFavoritesFile,
} from '../packages/mockifyer-dashboard/src/utils/favorites-store';

function makeMock(url: string): MockData {
  return {
    request: {
      method: 'GET',
      url,
      headers: {},
      queryParams: {},
    },
    response: { status: 200, data: { ok: true }, headers: {} },
    timestamp: '2026-01-01T00:00:00.000Z',
  };
}

describe('favorites-store', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-fav-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('assigns the same id to the same request in different scenarios', () => {
    const a = buildFavoriteFromMock(makeMock('https://api.example.com/bookings'), 'a.json');
    const b = buildFavoriteFromMock(makeMock('https://api.example.com/bookings'), 'b.json');
    expect(a?.id).toBeTruthy();
    expect(a?.id).toBe(b?.id);
    expect(favoriteIdForMock(makeMock('https://api.example.com/other'))).not.toBe(a?.id);
  });

  it('writes and reads a global favorites file at the mock-data root', () => {
    const favorite = buildFavoriteFromMock(makeMock('https://api.example.com/bookings'), 'bookings.json');
    expect(favorite).toBeTruthy();
    writeFavoritesFile(tmpRoot, { formatVersion: 1, favorites: [favorite!] });
    const loaded = readFavoritesFile(tmpRoot);
    expect(loaded.favorites).toHaveLength(1);
    expect(loaded.favorites[0].id).toBe(favorite!.id);
    expect(loaded.favorites[0].endpoint).toContain('api.example.com/bookings');
    expect(fs.existsSync(path.join(tmpRoot, 'favorites.json'))).toBe(true);
  });

  it('upserts by id and removes by id', () => {
    const first = buildFavoriteFromMock(makeMock('https://api.example.com/bookings'), 'one.json')!;
    const second = buildFavoriteFromMock(makeMock('https://api.example.com/users'), 'two.json')!;
    let doc = parseFavoritesDocument({ favorites: [] });
    doc = upsertFavorite(doc, first);
    doc = upsertFavorite(doc, { ...first, filename: 'renamed.json' });
    doc = upsertFavorite(doc, second);
    expect(doc.favorites).toHaveLength(2);
    expect(doc.favorites.find((entry) => entry.id === first.id)?.filename).toBe('renamed.json');
    doc = removeFavorite(doc, first.id);
    expect(doc.favorites.map((entry) => entry.id)).toEqual([second.id]);
  });

  it('ignores invalid entries when parsing', () => {
    const valid = buildFavoriteFromMock(makeMock('https://api.example.com/bookings'))!;
    const parsed = parseFavoritesDocument({
      formatVersion: 1,
      favorites: [{ id: 'not-a-hash', method: 'GET' }, valid, { id: valid.id, method: 'POST' }],
    });
    expect(parsed.favorites).toHaveLength(1);
    expect(parsed.favorites[0].id).toBe(valid.id);
  });
});
