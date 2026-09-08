/**
 * Filesystem helpers for Atlas packs under `{mockDataPath}/_atlas/packs/`.
 * Node-oriented (dashboard / build scripts). Safe to import from RN only if fs is unused.
 */

import fs from 'fs';
import path from 'path';
import type { AtlasPack, AtlasPackConfig } from '../types/atlas-pack';
import {
  ATLAS_PACK_CONFIG_FILENAME,
  ATLAS_PACK_ID_PATTERN,
  ATLAS_PACKS_DIR_NAME,
  ATLAS_PACKS_SUBDIR,
} from '../types/atlas-pack';
import { normalizeAtlasPack, validateAtlasPack } from './atlas-pack-apply';

/** `{mockDataPath}/_atlas` */
export function getAtlasPacksRootPath(mockDataPath: string): string {
  return path.join(mockDataPath, ATLAS_PACKS_DIR_NAME);
}

/** `{mockDataPath}/_atlas/packs` */
export function getAtlasPacksDir(mockDataPath: string): string {
  return path.join(getAtlasPacksRootPath(mockDataPath), ATLAS_PACKS_SUBDIR);
}

/** `{mockDataPath}/_atlas/pack-config.json` */
export function getAtlasPackConfigPath(mockDataPath: string): string {
  return path.join(getAtlasPacksRootPath(mockDataPath), ATLAS_PACK_CONFIG_FILENAME);
}

function ensurePacksDir(mockDataPath: string): string {
  const dir = getAtlasPacksDir(mockDataPath);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Read pack-config.json (missing → currentPack null). */
export function readAtlasPackConfig(mockDataPath: string): AtlasPackConfig {
  const filePath = getAtlasPackConfigPath(mockDataPath);
  if (!fs.existsSync(filePath)) {
    return { currentPack: null };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as AtlasPackConfig;
    const current =
      typeof raw.currentPack === 'string' && raw.currentPack.trim()
        ? raw.currentPack.trim()
        : null;
    return { currentPack: current, updatedAt: raw.updatedAt };
  } catch {
    return { currentPack: null };
  }
}

/** Persist active pack pointer. */
export function writeAtlasPackConfig(mockDataPath: string, config: AtlasPackConfig): AtlasPackConfig {
  const root = getAtlasPacksRootPath(mockDataPath);
  fs.mkdirSync(root, { recursive: true });
  const next: AtlasPackConfig = {
    currentPack: config.currentPack?.trim() || null,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(getAtlasPackConfigPath(mockDataPath), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function packFilePath(mockDataPath: string, packId: string): string {
  return path.join(getAtlasPacksDir(mockDataPath), `${packId}.json`);
}

/** List packs from disk (sorted by id). */
export function listAtlasPacksFromDisk(mockDataPath: string): AtlasPack[] {
  const dir = getAtlasPacksDir(mockDataPath);
  if (!fs.existsSync(dir)) return [];
  const packs: AtlasPack[] = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) as unknown;
      const err = validateAtlasPack(raw);
      if (err) continue;
      packs.push(normalizeAtlasPack(raw as AtlasPack));
    } catch {
      // skip corrupt
    }
  }
  return packs.sort((a, b) => a.id.localeCompare(b.id));
}

/** Read one pack from disk. */
export function readAtlasPackFromDisk(mockDataPath: string, packId: string): AtlasPack | null {
  const id = packId.trim();
  if (!ATLAS_PACK_ID_PATTERN.test(id)) return null;
  const filePath = packFilePath(mockDataPath, id);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    const err = validateAtlasPack(raw);
    if (err) return null;
    return normalizeAtlasPack(raw as AtlasPack);
  } catch {
    return null;
  }
}

/** Write / replace a pack on disk. */
export function writeAtlasPackToDisk(mockDataPath: string, pack: AtlasPack): AtlasPack {
  const err = validateAtlasPack(pack);
  if (err) throw new Error(err);
  const normalized = normalizeAtlasPack({
    ...pack,
    updatedAt: new Date().toISOString(),
  });
  ensurePacksDir(mockDataPath);
  fs.writeFileSync(packFilePath(mockDataPath, normalized.id), JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

/** Delete a pack file. Returns true when removed. */
export function deleteAtlasPackFromDisk(mockDataPath: string, packId: string): boolean {
  const id = packId.trim();
  if (!ATLAS_PACK_ID_PATTERN.test(id)) return false;
  const filePath = packFilePath(mockDataPath, id);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

/**
 * Hydrate in-memory registry from disk and set active pack from pack-config.
 * Call from dashboard boot / after pack mutations.
 */
export function hydrateAtlasPackRuntimeFromDisk(
  mockDataPath: string,
  options?: {
    registerAtlasPacks: (packs: AtlasPack[]) => void;
    setActiveAtlasPack: (id: string | null) => void;
    reset?: () => void;
  }
): { packs: AtlasPack[]; currentPack: string | null } {
  const packs = listAtlasPacksFromDisk(mockDataPath);
  const config = readAtlasPackConfig(mockDataPath);
  if (options?.reset) options.reset();
  if (options?.registerAtlasPacks) options.registerAtlasPacks(packs);
  const current =
    config.currentPack && packs.some((p) => p.id === config.currentPack)
      ? config.currentPack
      : null;
  if (options?.setActiveAtlasPack) options.setActiveAtlasPack(current);
  return { packs, currentPack: current };
}
