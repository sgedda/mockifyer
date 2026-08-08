import {
  readDomainPathRulesFile as readFromCore,
  writeDomainPathRulesFile as writeFromCore,
  DOMAIN_PATH_RULES_FILENAME,
} from '@sgedda/mockifyer-core';
import type { DomainPathRulesMap } from '@sgedda/mockifyer-core';
import type { RedisMockStore } from './redis-mock-store';

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

/**
 * Merge filesystem + centralized (Redis/SQLite) domain-path rules.
 * Centralized entries win on key conflict (same policy as GET /domain-path-rules).
 */
export function mergeDomainPathRulesMaps(
  fromFile: DomainPathRulesMap,
  fromCentralized: DomainPathRulesMap
): DomainPathRulesMap {
  return { ...fromFile, ...fromCentralized };
}

/** Apply a single domain-path upsert or delete to a rules map (immutable). */
export function applyDomainPathRuleMutation(
  rules: DomainPathRulesMap,
  domainPath: string,
  rule: { recordResponses: boolean; autoMock?: boolean } | null
): DomainPathRulesMap {
  const normalized = domainPath.trim().replace(/^\/+|\/+$/g, '');
  const next: DomainPathRulesMap = { ...rules };
  if (!normalized) {
    return next;
  }
  if (rule === null) {
    delete next[normalized];
  } else {
    next[normalized] = {
      recordResponses: rule.recordResponses,
      autoMock: rule.autoMock === true,
      updatedAt: new Date().toISOString(),
    };
  }
  return next;
}

/**
 * Authoritative domain-path rules for Redis/SQLite dashboard: file ∪ store.
 * Discovery often lands on disk first; store may lag until a UI toggle.
 */
export async function loadMergedDomainPathRules(
  store: Pick<RedisMockStore, 'getDomainPathRules'>,
  mockDataPath: string,
  scenario: string
): Promise<DomainPathRulesMap> {
  const fromCentralized = await store.getDomainPathRules(scenario);
  const fromFile = readDomainPathRulesFile(mockDataPath, scenario);
  return mergeDomainPathRulesMaps(fromFile, fromCentralized);
}

/**
 * Persist the full merged rules map to both the centralized store and the scenario file.
 * Avoids POST wiping file-only discovery keys when the store was incomplete.
 */
export async function persistMergedDomainPathRules(
  store: Pick<RedisMockStore, 'replaceDomainPathRules'>,
  mockDataPath: string,
  scenario: string,
  rules: DomainPathRulesMap
): Promise<void> {
  await store.replaceDomainPathRules(scenario, rules);
  writeDomainPathRulesFile(mockDataPath, scenario, rules);
}
