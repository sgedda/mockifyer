import type { DomainPathRulesMode, MockifyerConfig } from '../types';
import {
  type DomainPathRulesMap,
  type DomainPathTrafficGate,
  discoverDomainPathRulesForUrl,
  mergeDomainPathRuleUpserts,
  resolveDomainPathRulesMode,
  resolveDomainPathTrafficGate,
} from './domain-path-rules';
import { getCurrentScenario } from './scenario';
import { logger } from './logger';

let fsAvailable = false;
try {
  require('fs');
  fsAvailable = true;
} catch {
  fsAvailable = false;
}

export interface DomainPathRulesSessionOptions {
  config: Pick<MockifyerConfig, 'mockDataPath' | 'domainPathRulesMode' | 'baseUrl' | 'clientId' | 'proxy' | 'databaseProvider'>;
  /** Metro port for RN Hybrid discovery writes (default 8081). */
  metroPort?: number;
  /** Override fetch used for Metro POSTs (RN). */
  fetchFn?: typeof fetch;
}

/**
 * Per-Mockifyer-instance cache + discover/persist for domain-path rules (Hybrid/filesystem).
 * No-op when mode is `off` or dashboard proxy owns traffic.
 */
export class DomainPathRulesSession {
  private mode: DomainPathRulesMode;
  private rules: DomainPathRulesMap | null = null;
  private rulesScenario: string | null = null;
  private readonly config: DomainPathRulesSessionOptions['config'];
  private readonly metroPort: number;
  private readonly fetchFn: typeof fetch | undefined;
  private persistQueue: Promise<void> = Promise.resolve();

  constructor(options: DomainPathRulesSessionOptions) {
    this.mode = resolveDomainPathRulesMode({ configMode: options.config.domainPathRulesMode });
    this.config = options.config;
    this.metroPort =
      options.metroPort ??
      options.config.databaseProvider?.options?.metroPort ??
      (typeof process !== 'undefined' && process.env?.METRO_PORT
        ? parseInt(process.env.METRO_PORT, 10)
        : 8081);
    this.fetchFn = options.fetchFn;
  }

  getMode(): DomainPathRulesMode {
    return this.mode;
  }

  isActive(): boolean {
    return this.mode !== 'off' && !Boolean(this.config.proxy?.baseUrl?.trim());
  }

  private scenarioName(): string {
    return getCurrentScenario(this.config.mockDataPath, this.config.clientId);
  }

  private loadRules(): DomainPathRulesMap {
    const scenario = this.scenarioName();
    if (this.rules && this.rulesScenario === scenario) {
      return this.rules;
    }
    let loaded: DomainPathRulesMap = {};
    if (fsAvailable) {
      try {
        const { readDomainPathRulesFile } = require('./domain-path-rules-file') as typeof import('./domain-path-rules-file');
        loaded = readDomainPathRulesFile(this.config.mockDataPath, scenario);
      } catch {
        loaded = {};
      }
    }
    this.rules = loaded;
    this.rulesScenario = scenario;
    return loaded;
  }

  invalidateCache(): void {
    this.rules = null;
    this.rulesScenario = null;
  }

  /**
   * Resolve record/replay gate for a URL. When inactive, always allows.
   */
  getTrafficGate(rawUrl: string | null | undefined, baseUrl?: string | null): DomainPathTrafficGate {
    if (!this.isActive()) {
      return { mayRecord: true, mayReplay: true, matchedDomainPath: null, matchedRule: null };
    }
    const rules = this.loadRules();
    return resolveDomainPathTrafficGate(
      rawUrl,
      rules,
      this.mode,
      baseUrl ?? this.config.baseUrl
    );
  }

  /**
   * Upsert discovered domain/path keys and persist (Node fs or Metro POST).
   * Fire-and-forget safe; errors are logged.
   */
  discover(rawUrl: string | null | undefined, baseUrl?: string | null): void {
    if (!this.isActive() || !rawUrl) {
      return;
    }
    const rules = this.loadRules();
    const beforeKeys = Object.keys(rules).length;
    const { changed, upserted } = discoverDomainPathRulesForUrl(
      rules,
      rawUrl,
      this.mode,
      baseUrl ?? this.config.baseUrl
    );
    if (!changed) {
      return;
    }
    this.rules = rules;
    this.rulesScenario = this.scenarioName();

    const upsertMap: DomainPathRulesMap = {};
    for (const key of upserted) {
      const rule = rules[key];
      if (rule) {
        upsertMap[key] = rule;
      }
    }

    this.persistQueue = this.persistQueue
      .then(async () => {
        await this.persistUpserts(upsertMap, rules);
      })
      .catch((err) => {
        logger.warn('[Mockifyer] Domain path rules discover persist failed:', err);
      });

    if (upserted.length > 0) {
      logger.debug(
        `[Mockifyer] Domain path rules discovered (+${upserted.length}, total keys ${beforeKeys + upserted.length}): ${upserted.join(', ')}`
      );
    }
  }

  private async persistUpserts(upsertMap: DomainPathRulesMap, fullRules: DomainPathRulesMap): Promise<void> {
    const scenario = this.scenarioName();
    if (fsAvailable) {
      try {
        const {
          readDomainPathRulesFile,
          writeDomainPathRulesFile,
        } = require('./domain-path-rules-file') as typeof import('./domain-path-rules-file');
        const onDisk = readDomainPathRulesFile(this.config.mockDataPath, scenario);
        const merged = mergeDomainPathRuleUpserts(onDisk, upsertMap);
        const toWrite =
          Object.keys(fullRules).length >= Object.keys(merged.rules).length ? fullRules : merged.rules;
        writeDomainPathRulesFile(this.config.mockDataPath, scenario, toWrite);
        this.rules = toWrite;
        this.rulesScenario = scenario;
        return;
      } catch (err) {
        logger.warn('[Mockifyer] Domain path rules file write failed:', err);
      }
    }

    const fetchFn = this.fetchFn ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined);
    if (!fetchFn) {
      return;
    }
    const metroUrl = `http://localhost:${this.metroPort}/mockifyer-domain-path-rules`;
    const res = await fetchFn(metroUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario,
        upserts: upsertMap,
        mode: this.mode,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.warn(`[Mockifyer] Domain path rules Metro persist HTTP ${res.status}: ${text}`);
      return;
    }
    try {
      const parsed = (await res.json()) as { success?: boolean; rules?: DomainPathRulesMap };
      if (parsed.success && parsed.rules && typeof parsed.rules === 'object') {
        this.rules = parsed.rules;
        this.rulesScenario = scenario;
      }
    } catch {
      // ignore non-JSON
    }
  }
}
