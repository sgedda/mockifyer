import {
  readDomainPathRulesFile as readFromCore,
  writeDomainPathRulesFile as writeFromCore,
  updateDomainPathRulesFile as updateFromCore,
  DOMAIN_PATH_RULES_FILENAME,
} from '@sgedda/mockifyer-core';
import type { DomainPathRulesMap } from '@sgedda/mockifyer-core';

export { DOMAIN_PATH_RULES_FILENAME };

/** Load per-scenario domain auto-record rules from `mock-data/<scenario>/domain-path-rules.json`. */
export function readDomainPathRulesFile(mockDataPath: string, scenario: string): DomainPathRulesMap {
  return readFromCore(mockDataPath, scenario);
}

/** Persist domain auto-record rules next to scenario mocks (survives dashboard refresh / Redis loss). */
export function writeDomainPathRulesFile(
  mockDataPath: string,
  scenario: string,
  rules: DomainPathRulesMap
): void {
  writeFromCore(mockDataPath, scenario, rules);
}

/** Locked read-modify-write so dashboard edits cannot race discovery persists. */
export async function updateDomainPathRulesFile(
  mockDataPath: string,
  scenario: string,
  updater: (rules: DomainPathRulesMap) => DomainPathRulesMap
): Promise<{ rules: DomainPathRulesMap; changed: boolean }> {
  return updateFromCore(mockDataPath, scenario, updater);
}
