/**
 * Node filesystem helpers for per-scenario override sets.
 * Not imported from the React Native entry (uses `fs` / `path`).
 */
import type { OverrideSetDocument, OverrideSetSummary } from './override-sets';
import {
  DEFAULT_OVERRIDE_SET_ID,
  OVERRIDE_SETS_DIR_NAME,
  createEmptyOverrideSetDocument,
  normalizeOverrideSetId,
  parseOverrideSetDocument,
  summarizeOverrideSetDocument,
} from './override-sets';

let fs: typeof import('fs') | undefined;
let path: typeof import('path') | undefined;

try {
  fs = require('fs');
  path = require('path');
} catch {
  fs = undefined;
  path = undefined;
}

function requireNodeFs(): { fs: typeof import('fs'); path: typeof import('path') } {
  if (!fs || !path) {
    throw new Error('Override set filesystem helpers require Node.js fs/path');
  }
  return { fs, path };
}

/** `{mockDataPath}/{scenario}/override-sets` */
export function getOverrideSetsDir(mockDataPath: string, scenario: string): string {
  const { path: nodePath } = requireNodeFs();
  return nodePath.join(mockDataPath, scenario.trim(), OVERRIDE_SETS_DIR_NAME);
}

export function getOverrideSetFilePath(
  mockDataPath: string,
  scenario: string,
  setId: string
): string {
  const { path: nodePath } = requireNodeFs();
  const id = normalizeOverrideSetId(setId);
  return nodePath.join(getOverrideSetsDir(mockDataPath, scenario), `${id}.json`);
}

/**
 * Read an override set from disk. Missing file → empty document (does not create).
 */
export function readOverrideSetFromFs(
  mockDataPath: string,
  scenario: string,
  setId?: string | null
): OverrideSetDocument {
  const { fs: nodeFs } = requireNodeFs();
  const id = normalizeOverrideSetId(setId);
  const filePath = getOverrideSetFilePath(mockDataPath, scenario, id);
  if (!nodeFs.existsSync(filePath)) {
    return createEmptyOverrideSetDocument(id);
  }
  const raw = JSON.parse(nodeFs.readFileSync(filePath, 'utf-8')) as unknown;
  return parseOverrideSetDocument(raw, id);
}

/** Persist an override set document under the scenario folder. */
export function writeOverrideSetToFs(
  mockDataPath: string,
  scenario: string,
  document: OverrideSetDocument
): OverrideSetDocument {
  const { fs: nodeFs, path: nodePath } = requireNodeFs();
  const id = normalizeOverrideSetId(document.id);
  const dir = getOverrideSetsDir(mockDataPath, scenario);
  nodeFs.mkdirSync(dir, { recursive: true });
  const next: OverrideSetDocument = {
    ...document,
    id,
    updatedAt: new Date().toISOString(),
    entries: document.entries ?? {},
  };
  const filePath = nodePath.join(dir, `${id}.json`);
  nodeFs.writeFileSync(filePath, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

/** List override set ids present on disk for a scenario (always includes `default`). */
export function listOverrideSetsFromFs(
  mockDataPath: string,
  scenario: string
): OverrideSetSummary[] {
  const { fs: nodeFs, path: nodePath } = requireNodeFs();
  const dir = getOverrideSetsDir(mockDataPath, scenario);
  const byId = new Map<string, OverrideSetSummary>();
  byId.set(DEFAULT_OVERRIDE_SET_ID, {
    id: DEFAULT_OVERRIDE_SET_ID,
    entryCount: 0,
  });
  if (!nodeFs.existsSync(dir)) {
    return Array.from(byId.values());
  }
  for (const name of nodeFs.readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    const id = name.slice(0, -'.json'.length);
    try {
      normalizeOverrideSetId(id);
    } catch {
      continue;
    }
    try {
      const raw = JSON.parse(nodeFs.readFileSync(nodePath.join(dir, name), 'utf-8')) as unknown;
      const doc = parseOverrideSetDocument(raw, id);
      byId.set(doc.id, summarizeOverrideSetDocument(doc));
    } catch {
      byId.set(id, { id, entryCount: 0 });
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
}

/** Delete a set file. Refuses to delete {@link DEFAULT_OVERRIDE_SET_ID} (clears entries instead). */
export function deleteOverrideSetFromFs(
  mockDataPath: string,
  scenario: string,
  setId: string
): void {
  const { fs: nodeFs } = requireNodeFs();
  const id = normalizeOverrideSetId(setId);
  if (id === DEFAULT_OVERRIDE_SET_ID) {
    writeOverrideSetToFs(mockDataPath, scenario, createEmptyOverrideSetDocument(id));
    return;
  }
  const filePath = getOverrideSetFilePath(mockDataPath, scenario, id);
  if (nodeFs.existsSync(filePath)) {
    nodeFs.unlinkSync(filePath);
  }
}
