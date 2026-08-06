import type { DomainPathRulesMode, MockifyerConfig } from '../types';
import {
  type DomainPathRulesMap,
  type DomainPathTrafficGate,
  discoverDomainPathRulesForUrl,
  mergeDomainPathRuleUpserts,
  parseDomainPathRules,
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
  /** Override fetch used for Metro GET/POST (RN). */
  fetchFn?: typeof fetch;
  /**
   * When false, skip filesystem I/O and use Metro GET/POST (React Native Hybrid).
   * Defaults to whether `fs` is require-able in this runtime.
   */
  useFilesystem?: boolean;
}

interface PendingDiscover {
  rawUrl: string;
  baseUrl?: string | null;
}

/**
 * Per-Mockifyer-instance cache + discover/persist for domain-path rules (Hybrid/filesystem).
 * No-op when mode is `off` or dashboard proxy owns traffic.
 */
export class DomainPathRulesSession {
  private mode: DomainPathRulesMode;
  private rules: DomainPathRulesMap | null = null;
  private rulesScenario: string | null = null;
  /** File mtime (ms) at last disk load; `0` when the file was missing. Unused when not using fs. */
  private rulesMtimeMs: number | null = null;
  /** True once rules were loaded from disk or Metro (not merely an empty in-memory seed). */
  private rulesHydrated = false;
  private readonly config: DomainPathRulesSessionOptions['config'];
  private readonly metroPort: number;
  private readonly fetchFn: typeof fetch | undefined;
  private readonly useFs: boolean;
  private persistQueue: Promise<void> = Promise.resolve();
  private hydratePromise: Promise<void> | null = null;
  private pendingDiscovers: PendingDiscover[] = [];

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
    this.useFs = options.useFilesystem ?? fsAvailable;
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

  private resolveFetch(): typeof fetch | undefined {
    return this.fetchFn ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined);
  }

  private metroRulesUrl(scenario: string): string {
    return `http://localhost:${this.metroPort}/mockifyer-domain-path-rules?scenario=${encodeURIComponent(scenario)}`;
  }

  /**
   * Current on-disk mtime for the scenario rules file.
   * Returns `0` when the file does not exist, `null` when fs is unavailable.
   */
  private rulesFileMtimeMs(scenario: string): number | null {
    if (!this.useFs) {
      return null;
    }
    try {
      const { domainPathRulesFilePath } = require('./domain-path-rules-file') as typeof import('./domain-path-rules-file');
      const filePath = domainPathRulesFilePath(this.config.mockDataPath, scenario);
      if (!filePath) {
        return null;
      }
      const fs = require('fs') as typeof import('fs');
      if (!fs.existsSync(filePath)) {
        return 0;
      }
      return fs.statSync(filePath).mtimeMs;
    } catch {
      return null;
    }
  }

  /**
   * Load authoritative rules from disk (Node) or Metro GET (RN Hybrid).
   * Call during startup (e.g. `reloadMockData`) so allowlist flags exist before traffic.
   */
  async hydrate(): Promise<void> {
    if (!this.isActive()) {
      this.rules = {};
      this.rulesScenario = this.scenarioName();
      this.rulesMtimeMs = null;
      this.rulesHydrated = true;
      return;
    }

    const scenario = this.scenarioName();
    if (this.useFs) {
      this.invalidateCache();
      this.loadRulesFromDisk(scenario);
      this.flushPendingDiscovers();
      return;
    }

    if (this.hydratePromise) {
      await this.hydratePromise;
      return;
    }

    this.hydratePromise = this.hydrateFromMetro(scenario);
    try {
      await this.hydratePromise;
    } finally {
      this.hydratePromise = null;
    }
  }

  private async hydrateFromMetro(scenario: string): Promise<void> {
    const fetchFn = this.resolveFetch();
    if (!fetchFn) {
      logger.warn('[Mockifyer] Domain path rules: no fetch available to hydrate from Metro; starting empty');
      this.rules = {};
      this.rulesScenario = scenario;
      this.rulesMtimeMs = null;
      this.rulesHydrated = true;
      this.flushPendingDiscovers();
      return;
    }

    try {
      const res = await fetchFn(this.metroRulesUrl(scenario), { method: 'GET' });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        logger.warn(`[Mockifyer] Domain path rules Metro hydrate HTTP ${res.status}: ${text}`);
        this.rules = this.rules ?? {};
        this.rulesScenario = scenario;
        this.rulesMtimeMs = null;
        this.rulesHydrated = true;
        this.flushPendingDiscovers();
        return;
      }
      const parsed = (await res.json()) as { success?: boolean; rules?: unknown };
      const loaded =
        parsed.success && parsed.rules != null
          ? parseDomainPathRules(parsed.rules)
          : {};
      this.rules = loaded;
      this.rulesScenario = scenario;
      this.rulesMtimeMs = null;
      this.rulesHydrated = true;
      this.flushPendingDiscovers();
    } catch (err) {
      logger.warn('[Mockifyer] Domain path rules Metro hydrate failed:', err);
      this.rules = this.rules ?? {};
      this.rulesScenario = scenario;
      this.rulesMtimeMs = null;
      this.rulesHydrated = true;
      this.flushPendingDiscovers();
    }
  }

  private ensureMetroHydrate(): void {
    if (this.useFs || this.rulesHydrated || this.hydratePromise) {
      return;
    }
    void this.hydrate().catch((err) => {
      logger.warn('[Mockifyer] Domain path rules background hydrate failed:', err);
    });
  }

  private flushPendingDiscovers(): void {
    if (this.pendingDiscovers.length === 0) {
      return;
    }
    const pending = this.pendingDiscovers;
    this.pendingDiscovers = [];
    for (const item of pending) {
      this.discover(item.rawUrl, item.baseUrl);
    }
  }

  private loadRulesFromDisk(scenario: string): DomainPathRulesMap {
    let loaded: DomainPathRulesMap = {};
    const mtimeMs = this.rulesFileMtimeMs(scenario);
    try {
      const { readDomainPathRulesFile } = require('./domain-path-rules-file') as typeof import('./domain-path-rules-file');
      loaded = readDomainPathRulesFile(this.config.mockDataPath, scenario);
    } catch {
      loaded = {};
    }
    this.rules = loaded;
    this.rulesScenario = scenario;
    this.rulesMtimeMs = mtimeMs;
    this.rulesHydrated = true;
    return loaded;
  }

  private loadRules(): DomainPathRulesMap {
    const scenario = this.scenarioName();

    if (this.useFs) {
      const mtimeMs = this.rulesFileMtimeMs(scenario);
      const cacheHit =
        this.rules !== null &&
        this.rulesScenario === scenario &&
        mtimeMs !== null &&
        mtimeMs === this.rulesMtimeMs;
      if (cacheHit) {
        return this.rules!;
      }
      return this.loadRulesFromDisk(scenario);
    }

    // React Native Hybrid: never treat an empty in-memory map as authoritative.
    // Existing project rules live on disk and must be loaded via Metro GET first.
    if (this.rules && this.rulesScenario === scenario && this.rulesHydrated) {
      return this.rules;
    }
    if (this.rulesScenario !== scenario) {
      this.rules = null;
      this.rulesHydrated = false;
      this.rulesScenario = null;
      this.rulesMtimeMs = null;
    }
    this.ensureMetroHydrate();
    return this.rules ?? {};
  }

  /** Drop the in-memory rules map so the next gate/discover reloads from disk (or Metro). */
  invalidateCache(): void {
    this.rules = null;
    this.rulesScenario = null;
    this.rulesMtimeMs = null;
    this.rulesHydrated = false;
    this.hydratePromise = null;
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

    // Without fs, wait for Metro hydrate so discovery does not seed allowlist
    // defaults (false) over project rules that are enabled on disk.
    if (!this.useFs && !this.rulesHydrated) {
      this.pendingDiscovers.push({ rawUrl, baseUrl });
      this.ensureMetroHydrate();
      return;
    }

    const scenarioAtDiscover = this.scenarioName();
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
    this.rulesScenario = scenarioAtDiscover;

    const upsertMap: DomainPathRulesMap = {};
    for (const key of upserted) {
      const rule = rules[key];
      if (rule) {
        upsertMap[key] = rule;
      }
    }

    // Capture scenario at discover time — persist may run after scenario/lane switches.
    this.persistQueue = this.persistQueue
      .then(async () => {
        await this.persistUpserts(upsertMap, scenarioAtDiscover);
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

  /**
   * Persist discovery upserts by merging onto on-disk/Metro rules for `scenario`
   * (the scenario captured at discover time, not whatever is active now).
   * Never prefer the in-memory full map by key count — that can overwrite
   * concurrent dashboard/external edits when key counts are similar.
   * Only refreshes the in-memory cache when the active scenario still matches.
   */
  private async persistUpserts(upsertMap: DomainPathRulesMap, scenario: string): Promise<void> {
    if (this.useFs) {
      try {
        const {
          readDomainPathRulesFile,
          writeDomainPathRulesFile,
        } = require('./domain-path-rules-file') as typeof import('./domain-path-rules-file');
        const onDisk = readDomainPathRulesFile(this.config.mockDataPath, scenario);
        const merged = mergeDomainPathRuleUpserts(onDisk, upsertMap);
        if (merged.changed) {
          writeDomainPathRulesFile(this.config.mockDataPath, scenario, merged.rules);
        }
        if (this.scenarioName() === scenario) {
          this.rules = merged.rules;
          this.rulesScenario = scenario;
          this.rulesMtimeMs = this.rulesFileMtimeMs(scenario);
          this.rulesHydrated = true;
        }
        return;
      } catch (err) {
        logger.warn('[Mockifyer] Domain path rules file write failed:', err);
      }
    }

    const fetchFn = this.resolveFetch();
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
        if (this.scenarioName() === scenario) {
          this.rules = parseDomainPathRules(parsed.rules);
          this.rulesScenario = scenario;
          this.rulesMtimeMs = null;
          this.rulesHydrated = true;
        }
      }
    } catch {
      // ignore non-JSON
    }
  }
}
