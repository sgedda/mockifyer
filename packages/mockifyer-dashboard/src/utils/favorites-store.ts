import fs from 'fs';
import path from 'path';
import {
  overrideSetEntryHashForRequest,
  type MockData,
  type StoredRequest,
} from '@sgedda/mockifyer-core';

/** Global (not per-scenario) favorites file at the mock-data root. */
export const FAVORITES_FILENAME = 'favorites.json';

export const FAVORITES_FORMAT_VERSION = 1;

const REQUEST_HASH_PATTERN = /^[a-f0-9]{64}$/i;

export interface FavoriteRequest {
  /** SHA-256 hex of `generateRequestKey` — same identity as override-set entries. */
  id: string;
  method: string;
  endpoint: string;
  operationName: string | null;
  favoritedAt: string;
  /** Filename in the scenario where it was starred (hint only; may not exist elsewhere). */
  filename?: string;
}

export interface FavoritesDocument {
  formatVersion: typeof FAVORITES_FORMAT_VERSION;
  favorites: FavoriteRequest[];
}

function isExistingDirectory(mockDataPath: string): boolean {
  try {
    return fs.existsSync(mockDataPath) && fs.statSync(mockDataPath).isDirectory();
  } catch {
    return false;
  }
}

export function favoritesFilePath(mockDataPath: string): string {
  return path.join(mockDataPath, FAVORITES_FILENAME);
}

export function isFavoriteRequestId(id: string): boolean {
  return REQUEST_HASH_PATTERN.test(id);
}

/**
 * Canonical favorite id for a stored mock. Returns null when the request cannot be keyed.
 */
export function favoriteIdForMock(mockData: { request?: StoredRequest }): string | null {
  try {
    const request = mockData.request;
    if (!request || typeof request !== 'object') return null;
    const id = overrideSetEntryHashForRequest(request);
    return isFavoriteRequestId(id) ? id.toLowerCase() : null;
  } catch {
    return null;
  }
}

function graphqlOperationName(request: StoredRequest | undefined): string | null {
  const body = request?.data;
  const parsed =
    typeof body === 'string'
      ? (() => {
          try {
            return JSON.parse(body) as unknown;
          } catch {
            return null;
          }
        })()
      : body;
  if (!parsed || typeof parsed !== 'object' || parsed === null) return null;
  const operationName = (parsed as { operationName?: unknown }).operationName;
  return typeof operationName === 'string' && operationName.trim() ? operationName.trim() : null;
}

function endpointFromRequest(request: StoredRequest | undefined): string {
  if (!request?.url) return '';
  let endpoint = request.url;
  const params = request.queryParams;
  if (params && typeof params === 'object' && Object.keys(params).length > 0) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value != null) search.append(key, String(value));
    }
    const qs = search.toString();
    if (qs) endpoint += `?${qs}`;
  }
  return endpoint;
}

export function buildFavoriteFromMock(mockData: MockData, filename?: string): FavoriteRequest | null {
  const id = favoriteIdForMock(mockData);
  if (!id) return null;
  const request = mockData.request;
  const method = String(request?.method || 'GET').toUpperCase();
  return {
    id,
    method,
    endpoint: endpointFromRequest(request),
    operationName: graphqlOperationName(request),
    favoritedAt: new Date().toISOString(),
    filename: filename?.trim() ? filename.trim() : undefined,
  };
}

function parseFavoriteEntry(raw: unknown): FavoriteRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id.trim().toLowerCase() : '';
  if (!isFavoriteRequestId(id)) return null;
  const method = typeof o.method === 'string' && o.method.trim() ? o.method.trim().toUpperCase() : 'GET';
  const endpoint = typeof o.endpoint === 'string' ? o.endpoint : '';
  const operationName =
    typeof o.operationName === 'string' && o.operationName.trim() ? o.operationName.trim() : null;
  const favoritedAt =
    typeof o.favoritedAt === 'string' && o.favoritedAt.trim()
      ? o.favoritedAt.trim()
      : new Date().toISOString();
  const filename = typeof o.filename === 'string' && o.filename.trim() ? o.filename.trim() : undefined;
  return { id, method, endpoint, operationName, favoritedAt, filename };
}

export function parseFavoritesDocument(raw: unknown): FavoritesDocument {
  if (!raw || typeof raw !== 'object') {
    return { formatVersion: FAVORITES_FORMAT_VERSION, favorites: [] };
  }
  const o = raw as Record<string, unknown>;
  const list = Array.isArray(o.favorites) ? o.favorites : Array.isArray(o) ? o : [];
  const seen = new Set<string>();
  const favorites: FavoriteRequest[] = [];
  for (const entry of list) {
    const parsed = parseFavoriteEntry(entry);
    if (!parsed || seen.has(parsed.id)) continue;
    seen.add(parsed.id);
    favorites.push(parsed);
  }
  favorites.sort((a, b) => b.favoritedAt.localeCompare(a.favoritedAt));
  return { formatVersion: FAVORITES_FORMAT_VERSION, favorites };
}

export function emptyFavoritesDocument(): FavoritesDocument {
  return { formatVersion: FAVORITES_FORMAT_VERSION, favorites: [] };
}

export function upsertFavorite(doc: FavoritesDocument, favorite: FavoriteRequest): FavoritesDocument {
  const next = doc.favorites.filter((entry) => entry.id !== favorite.id);
  next.unshift(favorite);
  return { formatVersion: FAVORITES_FORMAT_VERSION, favorites: next };
}

export function removeFavorite(doc: FavoritesDocument, id: string): FavoritesDocument {
  const normalized = id.trim().toLowerCase();
  return {
    formatVersion: FAVORITES_FORMAT_VERSION,
    favorites: doc.favorites.filter((entry) => entry.id !== normalized),
  };
}

export function readFavoritesFile(mockDataPath: string): FavoritesDocument {
  const filePath = favoritesFilePath(mockDataPath);
  try {
    if (!fs.existsSync(filePath)) return emptyFavoritesDocument();
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown;
    return parseFavoritesDocument(raw);
  } catch {
    return emptyFavoritesDocument();
  }
}

export function writeFavoritesFile(mockDataPath: string, document: FavoritesDocument): boolean {
  if (!isExistingDirectory(mockDataPath)) return false;
  const filePath = favoritesFilePath(mockDataPath);
  const payload = parseFavoritesDocument(document);
  fs.mkdirSync(mockDataPath, { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  return true;
}
