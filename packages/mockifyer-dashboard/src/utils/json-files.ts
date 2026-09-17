import fs from 'fs';
import path from 'path';
import {
  isMockRecordingSidecarDir,
  isOverrideGroupConfigFilename,
  SCENARIO_META_FILENAME,
} from '@sgedda/mockifyer-core';

/**
 * Recursively collect all .json file paths under a directory.
 * Uses statSync per entry (not Dirent) so symlinks and odd FS layouts behave consistently,
 * and skips unreadable entries instead of failing the whole walk.
 */
export function getAllJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  let rootStat: fs.Stats;
  try {
    rootStat = fs.statSync(dir);
  } catch {
    return [];
  }
  if (!rootStat.isDirectory()) return [];

  const results: string[] = [];

  function walk(current: string): void {
    let names: string[];
    try {
      names = fs.readdirSync(current);
    } catch {
      return;
    }

    for (const name of names) {
      const full = path.join(current, name);
      let st: fs.Stats;
      try {
        st = fs.statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        // Sidecar dirs — not recorded mock traffic
        if (isMockRecordingSidecarDir(name)) continue;
        walk(full);
      } else if (name.endsWith('.json')) {
        if (
          name === SCENARIO_META_FILENAME ||
          name === 'favorites.json' ||
          isOverrideGroupConfigFilename(name)
        ) {
          continue;
        }
        results.push(full);
      }
    }
  }

  walk(dir);
  return results;
}
