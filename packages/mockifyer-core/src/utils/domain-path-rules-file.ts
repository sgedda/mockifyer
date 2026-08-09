/**
 * Node filesystem helpers for `domain-path-rules.json`.
 * Not exported from the React Native entry (uses `fs` / `path`).
 */

import type { DomainPathRulesMap } from './domain-path-rules';
import {
  DOMAIN_PATH_RULES_FILENAME,
  isUsableNodeFsModule,
  parseDomainPathRules,
} from './domain-path-rules';
import { getScenarioFolderPath } from './scenario';

let fs: typeof import('fs') | undefined;
let pathMod: typeof import('path') | undefined;

try {
  const fsMod = require('fs');
  const pathCandidate = require('path');
  // Metro may resolve `fs` to an empty stub — do not treat that as usable Node fs.
  if (isUsableNodeFsModule(fsMod) && pathCandidate && typeof pathCandidate.join === 'function') {
    fs = fsMod;
    pathMod = pathCandidate;
  }
} catch {
  fs = undefined;
  pathMod = undefined;
}

export { DOMAIN_PATH_RULES_FILENAME };

/** Absolute path to `domain-path-rules.json` for a scenario. */
export function domainPathRulesFilePath(mockDataPath: string, scenario: string): string | null {
  if (!pathMod) {
    return null;
  }
  return pathMod.join(getScenarioFolderPath(mockDataPath, scenario), DOMAIN_PATH_RULES_FILENAME);
}

/** Load per-scenario domain path rules from `mock-data/<scenario>/domain-path-rules.json`. */
export function readDomainPathRulesFile(mockDataPath: string, scenario: string): DomainPathRulesMap {
  if (!fs || !pathMod) {
    return {};
  }
  const filePath = domainPathRulesFilePath(mockDataPath, scenario);
  if (!filePath || !fs.existsSync(filePath)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return parseDomainPathRules(JSON.parse(raw));
  } catch {
    return {};
  }
}

/** Persist domain path rules next to scenario mocks. */
export function writeDomainPathRulesFile(
  mockDataPath: string,
  scenario: string,
  rules: DomainPathRulesMap
): void {
  if (!fs || !pathMod) {
    return;
  }
  const scenarioPath = getScenarioFolderPath(mockDataPath, scenario);
  fs.mkdirSync(scenarioPath, { recursive: true });
  const filePath = pathMod.join(scenarioPath, DOMAIN_PATH_RULES_FILENAME);
  if (Object.keys(rules).length === 0) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return;
  }
  fs.writeFileSync(filePath, `${JSON.stringify(rules, null, 2)}\n`, 'utf-8');
}
