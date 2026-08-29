/**
 * Node filesystem helpers for `domain-path-rules.json`.
 * Not exported from the React Native entry (uses `fs` / `path`).
 */

import type { DomainPathRulesMap } from './domain-path-rules';
import {
  DOMAIN_PATH_RULES_FILENAME,
  parseDomainPathRules,
} from './domain-path-rules';
import { getScenarioFolderPath } from './scenario';

let fs: typeof import('fs') | undefined;
let pathMod: typeof import('path') | undefined;

try {
  fs = require('fs');
  pathMod = require('path');
} catch {
  fs = undefined;
  pathMod = undefined;
}

export { DOMAIN_PATH_RULES_FILENAME };

/**
 * True when `fs` exposes the sync APIs used for domain-path-rules I/O.
 * React Native / Metro often stubs `require('fs')` as `{}` without throwing —
 * treat that as unavailable so Hybrid can fall back to Metro.
 *
 * Call with no args to probe the module-level `require('fs')` result.
 * Pass an explicit candidate (including `undefined` / `null` / `{}`) to test a stub.
 */
export function isNodeFsApiAvailable(candidate?: unknown): boolean {
  const target = arguments.length > 0 ? candidate : fs;
  if (target == null || typeof target !== 'object') {
    return false;
  }
  const api = target as Partial<typeof import('fs')>;
  return (
    typeof api.existsSync === 'function' &&
    typeof api.readFileSync === 'function' &&
    typeof api.writeFileSync === 'function' &&
    typeof api.mkdirSync === 'function'
  );
}

function hasPathJoin(candidate: unknown = pathMod): boolean {
  return (
    candidate != null &&
    typeof candidate === 'object' &&
    typeof (candidate as Partial<typeof import('path')>).join === 'function'
  );
}

/** Absolute path to `domain-path-rules.json` for a scenario. */
export function domainPathRulesFilePath(mockDataPath: string, scenario: string): string | null {
  if (!hasPathJoin(pathMod)) {
    return null;
  }
  return pathMod!.join(getScenarioFolderPath(mockDataPath, scenario), DOMAIN_PATH_RULES_FILENAME);
}

/** Load per-scenario domain path rules from `mock-data/<scenario>/domain-path-rules.json`. */
export function readDomainPathRulesFile(mockDataPath: string, scenario: string): DomainPathRulesMap {
  if (!isNodeFsApiAvailable(fs) || !hasPathJoin(pathMod)) {
    return {};
  }
  const filePath = domainPathRulesFilePath(mockDataPath, scenario);
  if (!filePath || !fs!.existsSync(filePath)) {
    return {};
  }
  try {
    const raw = fs!.readFileSync(filePath, 'utf-8');
    return parseDomainPathRules(JSON.parse(raw));
  } catch {
    return {};
  }
}

/**
 * Persist domain path rules next to scenario mocks.
 * @returns `true` when the write (or unlink) completed; `false` when Node fs is unavailable.
 */
export function writeDomainPathRulesFile(
  mockDataPath: string,
  scenario: string,
  rules: DomainPathRulesMap
): boolean {
  if (!isNodeFsApiAvailable(fs) || !hasPathJoin(pathMod)) {
    return false;
  }
  const scenarioPath = getScenarioFolderPath(mockDataPath, scenario);
  fs!.mkdirSync(scenarioPath, { recursive: true });
  const filePath = pathMod!.join(scenarioPath, DOMAIN_PATH_RULES_FILENAME);
  if (Object.keys(rules).length === 0) {
    if (fs!.existsSync(filePath) && typeof fs!.unlinkSync === 'function') {
      fs!.unlinkSync(filePath);
    }
    return true;
  }
  fs!.writeFileSync(filePath, `${JSON.stringify(rules, null, 2)}\n`, 'utf-8');
  return true;
}
