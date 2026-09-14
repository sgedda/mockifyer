import fs from 'fs';
import {
  readDomainPathRulesFile as readFromCore,
  writeDomainPathRulesFile as writeFromCore,
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

function isExistingDirectory(mockDataPath: string): boolean {
  try {
    return fs.existsSync(mockDataPath) && fs.statSync(mockDataPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Optional disk copy of centralized (Redis/SQLite) domain-path rules.
 *
 * Redis dashboards often use a dummy `MOCKIFYER_PATH` such as `/mock-data` that is not
 * a writable tree. Record response must still succeed after the Redis write; mkdir of
 * that path must not 500 the API.
 *
 * Writes to disk only when `mockDataPath` already exists as a directory, or when
 * `force` is set (Redis disk-mirror mode). Failures are logged and ignored.
 */
export function tryMirrorDomainPathRulesToDisk(
  mockDataPath: string,
  scenario: string,
  rules: DomainPathRulesMap,
  options?: { force?: boolean }
): boolean {
  if (!options?.force && !isExistingDirectory(mockDataPath)) {
    return false;
  }
  try {
    return writeFromCore(mockDataPath, scenario, rules);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[Mockifyer Dashboard] Skipping domain-path-rules.json disk write (${mockDataPath}): ${message}`
    );
    return false;
  }
}
