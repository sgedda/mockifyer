import fs from 'fs';
import path from 'path';
import { getScenarioFolderPath, type DomainPathRulesMap } from '@sgedda/mockifyer-core';

export const DOMAIN_PATH_RULES_FILENAME = 'domain-path-rules.json';

function parseDomainPathRules(raw: unknown): DomainPathRulesMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const out: DomainPathRulesMap = {};
  for (const [domainPath, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!val || typeof val !== 'object') continue;
    const r = val as Record<string, unknown>;
    if (typeof r.recordResponses !== 'boolean') continue;
    out[domainPath] = {
      recordResponses: r.recordResponses,
      autoMock: r.autoMock === true,
      updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : undefined,
    };
  }
  return out;
}

/** Load per-scenario domain auto-record rules from `mock-data/<scenario>/domain-path-rules.json`. */
export function readDomainPathRulesFile(mockDataPath: string, scenario: string): DomainPathRulesMap {
  const filePath = path.join(getScenarioFolderPath(mockDataPath, scenario), DOMAIN_PATH_RULES_FILENAME);
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return parseDomainPathRules(JSON.parse(raw));
  } catch {
    return {};
  }
}

/** Persist domain auto-record rules next to scenario mocks (survives dashboard refresh / Redis loss). */
export function writeDomainPathRulesFile(
  mockDataPath: string,
  scenario: string,
  rules: DomainPathRulesMap
): void {
  const scenarioPath = getScenarioFolderPath(mockDataPath, scenario);
  fs.mkdirSync(scenarioPath, { recursive: true });
  const filePath = path.join(scenarioPath, DOMAIN_PATH_RULES_FILENAME);
  if (Object.keys(rules).length === 0) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return;
  }
  fs.writeFileSync(filePath, `${JSON.stringify(rules, null, 2)}\n`, 'utf-8');
}
