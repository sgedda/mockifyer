/**
 * Metro middleware for mock file synchronization
 *
 * Provides sync mechanisms:
 * 1. POST /mockifyer-save - Direct save endpoint (used by Hybrid Provider for instant sync)
 * 2. GET/POST /mockifyer-domain-path-rules - Load or merge discovered domain-path allowlist keys into scenario file
 * 3. GET /mockifyer-sync-to-device-manifest + /mockifyer-sync-to-device-file - Project → app (HybridProvider; avoids huge single JSON)
 * 4. GET /mockifyer-sync-to-device - Legacy: all files in one response (may fail on large scenarios)
 * 5. GET /mockifyer-pool-response?id= - Load a promoted pool response for RN `$pool` resolve
 * 6. GET /mockifyer-sync - Legacy: iOS simulator mock-data → project folder
 * 7. POST /mockifyer-atlas-html — write crash-scoped trace HTML to mock-data/atlas-html/incidents/
 * 8. GET /atlas-html[/…] (legacy: /mockifyer-atlas-html[/…]) — serve atlas-html static files (index.html, pages, incidents, screenshots)
 * 9. POST /mockifyer-atlas-screenshot — write screen image (png/jpg/webp) under mock-data/atlas-html/screenshots/
 * 10. POST /mockifyer-atlas-render — write full interactive Atlas HTML under mock-data/atlas-html/
 * 11. POST /mockifyer-atlas-body-spill — write full hop body text under mock-data/atlas-html/bodies/
 * 12. POST/GET /mockifyer-network-events — live hop ring buffer for `mockifyer-atlas` CLI
 * 13. GET /mockifyer-network-events/stream — SSE hop stream
 * 14. GET /mockifyer-network-events/analyze — hop summary JSON
 * 15. POST /mockifyer-network-events/snapshot — write hops JSON/NDJSON under atlas-html/
 * 16. POST /mockifyer-network-events/render — render Atlas HTML from buffer hops
 * 17. POST /mockifyer-network-events/clear — clear ring buffer
 * 18. GET /mockifyer-atlas-live — live hop stream web page (SSE + expand/collapse)
 * 19. GET /mockifyer-atlas-trace?id= — re-call a hop with X-Mockifyer-Include-Trace (`&format=html` opens a result tab)
 * 20. GET /mockifyer-atlas-capture — Atlas `t` capture session active flag
 * 21. Metro terminal key `t` — start/stop Atlas capture (start opens live stream; stop generates HTML; stream auto-starts; `atlasKey: false` to disable). `a` is reserved for Android.
 * 22. Metro terminal key `m` — open Mockifyer dashboard in the browser (`dashboardKey: false` to disable)
 * 23. On hop ingest / Atlas render — pull nested hops from dashboard `/api/network-events/trace` (remote BFF → dashboard → Atlas)
 *
 * The Hybrid Provider (recommended) uses POST /mockifyer-save for instant file sync.
 * Legacy polling-based sync is still available for backward compatibility.
 *
 * Usage: Add to metro.config.js middleware array
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import {
  MockData,
  TestGenerator,
  TestGenerationOptions,
} from "@sgedda/mockifyer-core";
import { logger } from "@sgedda/mockifyer-core";
import {
  POOL_ID_PATTERN,
  loadPoolResponseItem,
  type PoolResponseItem,
  mergeDomainPathRuleUpserts,
  parseDomainPathRules,
  readDomainPathRulesFile,
  writeDomainPathRulesFile,
  type DomainPathRulesMap,
  containsMockifyerSyncEndpointMarker,
  setAtlasDocScreenshot,
  flushAtlasDocHtmlRewrite,
  setAtlasDocHtmlOutputPath,
  writeAtlasDocHtml,
  writeNetworkBodySpillMap,
  flushNetworkBodySpillsToDir,
  getNetworkBodySpillSnapshot,
  prettyPrintJsonText,
  setAtlasDocMap,
  type AtlasDocMap,
  type NetworkEvent,
  getMetroNetworkEventBuffer,
  resolveNetworkEventBodyRelPaths,
  networkBodySpillRelPath,
  analyzeMetroNetworkEvents,
  createEmptyAtlasDocMap,
  buildAtlasHarJson,
  buildAtlasLiveStreamHtml,
  buildAtlasTraceReplayHtml,
  ATLAS_LIVE_STREAM_PATH,
  ATLAS_TRACE_REPLAY_PATH,
  ATLAS_CAPTURE_SESSION_PATH,
  replayNetworkEventWithIncludeTrace,
  setMetroAtlasCaptureSessionActive,
  isMetroAtlasCaptureSessionActive,
  normalizeDashboardBaseUrl,
  pullDashboardDescendantsForParents,
} from "@sgedda/mockifyer-core";
import {
  attachMetroAtlasKeyHandler,
  notifyMetroAtlasStreamClientConnected,
  notifyMetroAtlasStreamClientDisconnected,
  resolveMetroDashboardUrl,
  type AtlasKeyOption,
} from "./metro-atlas-key-handlers";

export interface MetroSyncMiddlewareOptions {
  /** Project root directory (default: process.cwd()) */
  projectRoot?: string;
  /** Path to mock data directory relative to project root (default: 'mock-data') */
  mockDataPath?: string;
  /**
   * Metro terminal key that starts/stops Atlas capture (default `"t"`).
   * Start clears the hop buffer; stop generates HTML (same as `POST /mockifyer-network-events/render`).
   * Pass `false` to disable. `a` is reserved by Metro for Android.
   */
  atlasKey?: AtlasKeyOption;
  /**
   * Metro terminal key that opens the dashboard in the browser (default `"m"`).
   * Pass `false` to disable.
   */
  dashboardKey?: AtlasKeyOption;
  /**
   * Dashboard URL for Metro `m` (default: `MOCKIFYER_DASHBOARD_URL` or `http://localhost:3002`).
   * `MOCKIFYER_DASHBOARD_BASE` is appended when set.
   */
  dashboardUrl?: string;
  /** Test generation configuration - tests are generated when mocks are saved to project folder */
  testGeneration?: {
    /** Enable automatic test generation when mocks are saved */
    enabled?: boolean;
    /** Test framework to use: 'jest' (default), 'vitest', or 'mocha' */
    framework?: "jest" | "vitest" | "mocha";
    /** Output path for generated tests (default: './tests/generated') */
    outputPath?: string;
    /** Test file naming pattern with placeholders: {endpoint}, {method}, {scenario} (default: '{endpoint}.test.ts') */
    testPattern?: string;
    /** Include setup code in generated tests (default: true) */
    includeSetup?: boolean;
    /** Group tests by: 'endpoint', 'scenario', or 'file' (default: 'endpoint') */
    groupBy?: "endpoint" | "scenario" | "file";
    /** If true, only generate one test per endpoint (method + pathname), ignoring query parameters (default: false) */
    uniqueTestsPerEndpoint?: boolean;
  };
}

const DEFAULT_SCENARIO = "default";
/** Atlas render POSTs can include many hops + body spills — avoid O(n²) string concat. */
const MAX_METRO_POST_BODY_BYTES = 64 * 1024 * 1024;

/**
 * Debounce so a burst of hops triggers one dashboard read, and remote BFF children
 * (logged slightly after the parent) have landed before we ask.
 */
const DASHBOARD_ENRICH_DEBOUNCE_MS = 1_500;

/** Hard deadline for the enrichment on Atlas stop — `t` must never hang on a slow store. */
const DASHBOARD_ENRICH_DEADLINE_MS = 4_000;

let autoSyncInterval: NodeJS.Timeout | null = null;

/** Last dashboard base seen on a hop POST (device proxy URL). */
let lastHopDashboardBaseUrl: string | undefined;
let dashboardEnrichTimer: ReturnType<typeof setTimeout> | null = null;
let dashboardEnrichInFlight: Promise<number> | null = null;

function clearDashboardTraceEnrichmentSchedules(): void {
  if (dashboardEnrichTimer) {
    clearTimeout(dashboardEnrichTimer);
    dashboardEnrichTimer = null;
  }
  dashboardEnrichInFlight = null;
}

function resolveAtlasEnrichmentDashboardUrl(
  middlewareDashboardUrl: string | undefined,
  hopHint?: string,
): string | undefined {
  const fromHop = normalizeDashboardBaseUrl(hopHint);
  if (fromHop) {
    lastHopDashboardBaseUrl = fromHop;
    return fromHop;
  }
  if (lastHopDashboardBaseUrl) {
    return lastHopDashboardBaseUrl;
  }
  const hasExplicit =
    Boolean(middlewareDashboardUrl?.trim()) ||
    Boolean(
      typeof process !== "undefined" &&
        process.env.MOCKIFYER_DASHBOARD_URL?.trim(),
    );
  if (!hasExplicit) {
    return undefined;
  }
  return normalizeDashboardBaseUrl(
    resolveMetroDashboardUrl(middlewareDashboardUrl),
  );
}

/**
 * Merge remote-service children into the Metro buffer with a single dashboard read.
 * Buffered hop ids are the parents; descendants are linked by `parentRequestId`.
 * Returns how many new hops were appended. Never throws.
 */
async function enrichMetroBufferFromDashboard(options: {
  dashboardBaseUrl: string;
  mockDataPath: string;
  timeoutMs?: number;
}): Promise<number> {
  if (!options.dashboardBaseUrl) {
    return 0;
  }
  if (dashboardEnrichInFlight) {
    return dashboardEnrichInFlight;
  }

  const flight = (async (): Promise<number> => {
    const buffer = getMetroNetworkEventBuffer();
    const existing = buffer.list();
    const parentRequestIds = [
      ...new Set(
        existing
          .map((event) => event.requestId?.trim())
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (parentRequestIds.length === 0) {
      return 0;
    }

    const children = await pullDashboardDescendantsForParents({
      dashboardBaseUrl: options.dashboardBaseUrl,
      parentRequestIds,
      existing,
      timeoutMs: options.timeoutMs,
    });

    let added = 0;
    for (const child of children) {
      const stored = buffer.append(child);
      appendNetworkEventNdjson(options.mockDataPath, stored);
      added += 1;
    }
    return added;
  })();

  dashboardEnrichInFlight = flight;
  try {
    return await flight;
  } catch {
    return 0;
  } finally {
    dashboardEnrichInFlight = null;
  }
}

/**
 * Render the current Metro hop buffer to Atlas HTML and log the outcome.
 * Returns the hop count written (0 when the buffer is empty — the existing
 * `index.html` is then left alone rather than overwritten with an empty doc).
 */
function renderBufferedAtlasHtml(options: {
  projectRoot: string;
  mockDataPath: string;
  scenario?: string;
}): number {
  const events = [...getMetroNetworkEventBuffer().list()].reverse();
  if (events.length === 0) {
    console.warn(
      `[Mockifyer] Atlas: 0 hops — keeping the existing ${path.join(options.mockDataPath, "atlas-html", "index.html")}`,
    );
    console.warn(
      "[Mockifyer] Atlas: no hops reached Metro. Check that Mockifyer is enabled in the app " +
        "(runtimeMode 'manual' needs the dev-menu switch), that the app made requests during the " +
        "session, and that hops arrive: curl http://localhost:8081/mockifyer-network-events",
    );
    return 0;
  }
  const startedAt = Date.now();
  const result = renderNetworkEventsAtlasHtml(
    options.projectRoot,
    options.mockDataPath,
    events,
    options.scenario,
  );
  if (result.success) {
    const elapsedMs = Date.now() - startedAt;
    console.log(
      `[Mockifyer] Atlas HTML (${result.hopCount} hop(s), ${elapsedMs}ms) → ${result.indexPath}`,
    );
    return result.hopCount;
  }
  console.error(
    `[Mockifyer] Atlas render failed: ${result.error ?? "unknown"}`,
  );
  return 0;
}

/** Coalesce hop-ingest bursts into one dashboard read. */
function scheduleDashboardTraceEnrichment(options: {
  dashboardBaseUrl: string;
  mockDataPath: string;
}): void {
  if (!options.dashboardBaseUrl) {
    return;
  }
  if (dashboardEnrichTimer) {
    clearTimeout(dashboardEnrichTimer);
  }
  dashboardEnrichTimer = setTimeout(() => {
    dashboardEnrichTimer = null;
    void enrichMetroBufferFromDashboard(options);
  }, DASHBOARD_ENRICH_DEBOUNCE_MS);
  dashboardEnrichTimer.unref?.();
}

/**
 * Buffer an incoming request body with `Buffer.concat` (not `body += chunk`).
 * Large Atlas render payloads hang for minutes with quadratic string concatenation.
 */
function collectRequestBodyUtf8(
  req: {
    on: (event: string, cb: (...args: any[]) => void) => void;
    destroy?: () => void;
  },
  onDone: (err: Error | null, body: string) => void,
  maxBytes: number = MAX_METRO_POST_BODY_BYTES,
): void {
  const chunks: Buffer[] = [];
  let size = 0;
  let settled = false;
  const finish = (err: Error | null, body: string) => {
    if (settled) return;
    settled = true;
    onDone(err, body);
  };
  req.on("data", (chunk: Buffer | string) => {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > maxBytes) {
      finish(new Error(`Request body exceeds ${maxBytes} bytes`), "");
      try {
        req.destroy?.();
      } catch {
        // ignore
      }
      return;
    }
    chunks.push(buf);
  });
  req.on("end", () => {
    try {
      finish(null, Buffer.concat(chunks).toString("utf8"));
    } catch (e) {
      finish(e instanceof Error ? e : new Error(String(e)), "");
    }
  });
  req.on("error", (e: Error) => finish(e, ""));
}

function getMockFilePathLocal(
  mockData: MockData,
  dateStr: string,
): { dir: string; filename: string } {
  const url = mockData.request.url || "";
  const method = (mockData.request.method || "GET").toUpperCase();
  let host = "unknown";
  let pathSegments: string[] = [];
  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    pathSegments = parsed.pathname.split("/").filter(Boolean);
  } catch {
    return { dir: "unknown", filename: `${method}_${dateStr}.json` };
  }
  const hostSafe = host.replace(/[^a-zA-Z0-9.-]/g, "_");
  const graphqlIdx = pathSegments.lastIndexOf("graphql");
  const restIdx = pathSegments.indexOf("rest");
  let type: string;
  let remainingSegments: string[];
  if (graphqlIdx >= 0) {
    type = "graphql";
    remainingSegments = pathSegments.slice(graphqlIdx + 1);
  } else if (restIdx >= 0) {
    type = "rest";
    remainingSegments = pathSegments.slice(restIdx + 1);
  } else {
    type = "";
    remainingSegments = pathSegments;
  }
  let identifier = "";
  if (mockData.request.data) {
    try {
      const body =
        typeof mockData.request.data === "string"
          ? JSON.parse(mockData.request.data)
          : mockData.request.data;
      if (body.operationName) identifier = body.operationName;
      else if (body.path) identifier = body.path;
      else if (body.webAppName) identifier = body.webAppName;
    } catch {
      /* ignore */
    }
  }
  identifier = identifier.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 60);
  const dir = [hostSafe, type, ...remainingSegments].filter(Boolean).join("/");
  const filename = identifier
    ? `${method}_${identifier}_${dateStr}.json`
    : `${method}_${dateStr}.json`;
  return { dir, filename };
}

/**
 * Get current scenario from scenario-config.json
 */
function getCurrentScenario(mockDataPath: string): string {
  // Check environment variable first
  if (process.env.MOCKIFYER_SCENARIO) {
    return process.env.MOCKIFYER_SCENARIO;
  }

  // Try to load from scenario-config.json
  try {
    const configPath = path.join(mockDataPath, "scenario-config.json");
    if (fs.existsSync(configPath)) {
      const fileContent = fs.readFileSync(configPath, "utf-8");
      const config = JSON.parse(fileContent);
      if (config.currentScenario) {
        return config.currentScenario;
      }
    }
  } catch (error) {
    // Silently fail - file might not exist or be invalid
  }

  return DEFAULT_SCENARIO;
}

/**
 * Get scenario folder path
 */
function getScenarioPath(scenario: string, mockDataPath: string): string {
  // Always create scenario subfolder, even for 'default'
  return path.join(mockDataPath, scenario);
}

/**
 * Get test generation config from options or environment variables
 * Options take precedence, then fall back to environment variables (for backward compatibility)
 */
function getTestGenerationConfig(
  options?: MetroSyncMiddlewareOptions,
): TestGenerationOptions | null {
  // Check if enabled via options or environment variables
  const enabled =
    options?.testGeneration?.enabled === true ||
    process.env.MOCKIFYER_GENERATE_TESTS === "true" ||
    process.env.MOCKIFYER_GENERATE_TESTS === "1";

  if (!enabled) {
    return null;
  }

  // Use options if provided, otherwise fall back to environment variables
  return {
    framework:
      options?.testGeneration?.framework ||
      (process.env.MOCKIFYER_TEST_FRAMEWORK as any) ||
      "jest",
    outputPath:
      options?.testGeneration?.outputPath ||
      process.env.MOCKIFYER_TEST_OUTPUT_PATH ||
      "./tests/generated",
    testPattern:
      options?.testGeneration?.testPattern ||
      process.env.MOCKIFYER_TEST_PATTERN ||
      "{endpoint}.test.ts",
    includeSetup:
      options?.testGeneration?.includeSetup !== false &&
      process.env.MOCKIFYER_TEST_INCLUDE_SETUP !== "false",
    groupBy:
      options?.testGeneration?.groupBy ||
      (process.env.MOCKIFYER_TEST_GROUP_BY as any) ||
      "endpoint",
    httpClientType: "fetch",
    uniqueTestsPerEndpoint:
      options?.testGeneration?.uniqueTestsPerEndpoint ||
      process.env.MOCKIFYER_UNIQUE_TESTS_PER_ENDPOINT === "true",
  };
}

/**
 * Generate test file for a mock (runs in Metro/Node.js where fs is available)
 */
function generateTestForMock(
  mockData: MockData,
  testConfig: TestGenerationOptions,
  projectRoot: string,
): boolean {
  try {
    // Try to require TestGenerator from mockifyer-core
    let TestGeneratorClass: typeof TestGenerator;
    try {
      let mockifyerCore;
      try {
        mockifyerCore = require("@sgedda/mockifyer-core");
      } catch (e) {
        // Fallback: try relative path (for local file: dependencies)
        const corePath = path.join(
          projectRoot,
          "../../packages/mockifyer-core/dist/index.js",
        );
        if (fs.existsSync(corePath)) {
          mockifyerCore = require(corePath);
        } else {
          throw new Error(`Could not find mockifyer-core at ${corePath}`);
        }
      }

      TestGeneratorClass = mockifyerCore?.TestGenerator;

      if (!TestGeneratorClass) {
        const testGeneratorPath = path.join(
          projectRoot,
          "../../packages/mockifyer-core/dist/utils/test-generator.js",
        );
        if (fs.existsSync(testGeneratorPath)) {
          const testGeneratorModule = require(testGeneratorPath);
          TestGeneratorClass = testGeneratorModule.TestGenerator;
        }
      }
    } catch (e) {
      return false;
    }

    if (!TestGeneratorClass) {
      return false;
    }

    const generator = new TestGeneratorClass();

    const options: TestGenerationOptions = {
      framework: testConfig.framework,
      outputPath: testConfig.outputPath,
      testPattern: testConfig.testPattern,
      includeSetup: testConfig.includeSetup,
      groupBy: testConfig.groupBy,
      httpClientType: testConfig.httpClientType,
      uniqueTestsPerEndpoint: testConfig.uniqueTestsPerEndpoint,
    };

    const testInfo = generator.analyzeMock(
      mockData,
      options.httpClientType || "fetch",
    );
    const testFilePath = generator.determineTestFilePath(mockData, options);

    const absoluteTestPath = path.resolve(projectRoot, testFilePath);
    const testDir = path.dirname(absoluteTestPath);

    // If uniqueTestsPerEndpoint is enabled, check if a test file already exists
    if (options.uniqueTestsPerEndpoint && fs.existsSync(absoluteTestPath)) {
      return true;
    }

    // Ensure test directory exists
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    const testCode = generator.generateTest(mockData, options);

    // Check if test file already exists
    if (fs.existsSync(absoluteTestPath)) {
      const testName = `${testInfo.method} ${testInfo.endpoint}`;

      const existingContent = fs.readFileSync(absoluteTestPath, "utf-8");
      if (
        existingContent.includes(`it('${testName}'`) ||
        existingContent.includes(`it("${testName}"`)
      ) {
        return true;
      }

      // Append test to existing file
      const testMatch = testCode.match(
        /it\('.*?', async \(\) => \{[\s\S]*?\}\);?/,
      );
      if (testMatch) {
        const newTest = testMatch[0];
        const updatedContent = existingContent.replace(
          /(\s+)(\}\);?\s*)$/,
          `$1${newTest}\n$1$2`,
        );
        fs.writeFileSync(absoluteTestPath, updatedContent);
        return true;
      }
    } else {
      // Create new test file
      fs.writeFileSync(absoluteTestPath, testCode);
    }

    return true;
  } catch (error) {
    logger.error(`[MockSync] ❌ Error generating test:`, error);
    return false;
  }
}

/**
 * Save mock data directly to project folder
 * Called by HybridProvider when saving mocks
 */
function saveMockToProjectFolder(
  mockData: MockData,
  projectRoot: string,
  mockDataPath: string,
  testConfig: TestGenerationOptions | null,
): {
  success: boolean;
  filename?: string;
  scenario?: string;
  error?: string;
  skipped?: boolean;
  reason?: string;
} {
  try {
    // CRITICAL: Never save Mockifyer sync endpoint requests to prevent infinite loops
    const url = mockData?.request?.url || "";
    if (containsMockifyerSyncEndpointMarker(url)) {
      console.warn(
        `[MockSync] ⚠️ Rejecting save - Mockifyer sync endpoint detected: ${url}`,
      );
      return {
        success: false,
        error: "Cannot save Mockifyer sync endpoint requests",
      };
    }

    // Also check if the mockData string contains nested sync requests
    const mockDataStr = JSON.stringify(mockData);
    if (containsMockifyerSyncEndpointMarker(mockDataStr)) {
      logger.warn(
        `[MockSync] ⚠️ Rejecting save - Mock data contains nested Mockifyer sync requests`,
      );
      return {
        success: false,
        error: "Mock data contains nested Mockifyer sync requests",
      };
    }

    // Get current scenario and ensure scenario folder exists
    const currentScenario = getCurrentScenario(mockDataPath);
    const scenarioPath = getScenarioPath(currentScenario, mockDataPath);
    fs.mkdirSync(scenarioPath, { recursive: true });

    const dateStr = new Date()
      .toISOString()
      .replace(/T/, "_")
      .replace(/\..+/, "")
      .replace(/:/g, "-");
    const { dir, filename } = getMockFilePathLocal(mockData, dateStr);
    const fullDir = path.join(scenarioPath, dir);
    const filePath = path.join(fullDir, filename);

    // Check if file already exists - skip saving if it does
    if (fs.existsSync(filePath)) {
      return {
        success: true,
        filename: path.join(dir, filename),
        skipped: true,
        reason: "File already exists",
      };
    }

    fs.mkdirSync(fullDir, { recursive: true });
    // Write to file
    fs.writeFileSync(filePath, JSON.stringify(mockData, null, 2));

    // Generate test file if enabled
    if (testConfig) {
      generateTestForMock(mockData, testConfig, projectRoot);
    }

    return {
      success: true,
      filename: path.join(dir, filename),
      scenario: currentScenario,
    };
  } catch (error) {
    console.error(`[MockSync] ❌ Error saving mock to project folder:`, error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Save a proxy-mirrored mock to an explicit scenario subpath (e.g. `redis/<hash>.json`).
 * Used when the dashboard records to Redis and the RN app POSTs an envelope to `/mockifyer-save`.
 */
function saveProxyMirrorMockToProject(
  mockData: MockData,
  projectRoot: string,
  mockDataPath: string,
  scenarioName: string,
  relativePath: string,
  testConfig: TestGenerationOptions | null,
): { success: boolean; filename?: string; scenario?: string; error?: string } {
  try {
    const url = mockData?.request?.url || "";
    if (containsMockifyerSyncEndpointMarker(url)) {
      console.warn(
        `[MockSync] ⚠️ Rejecting save - Mockifyer sync endpoint detected: ${url}`,
      );
      return {
        success: false,
        error: "Cannot save Mockifyer sync endpoint requests",
      };
    }
    const mockDataStr = JSON.stringify(mockData);
    if (containsMockifyerSyncEndpointMarker(mockDataStr)) {
      return {
        success: false,
        error: "Mock data contains nested Mockifyer sync requests",
      };
    }
    const id = scenarioName.trim();
    if (!id) {
      return { success: false, error: "scenarioName is required" };
    }
    const normalized = relativePath.replace(/\\/g, "/").replace(/^\//, "");
    if (!normalized) {
      return { success: false, error: "relativePath is required" };
    }
    const scenarioPath = getScenarioPath(id, mockDataPath);
    fs.mkdirSync(scenarioPath, { recursive: true });
    const filePath = path.join(scenarioPath, normalized);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(mockData, null, 2));
    if (testConfig) {
      generateTestForMock(mockData, testConfig, projectRoot);
    }
    return { success: true, filename: normalized, scenario: id };
  } catch (error) {
    console.error(`[MockSync] ❌ Error saving proxy mirror mock:`, error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Clear all mock files from project folder (current scenario)
 */
function clearMockFiles(mockDataPath: string): {
  success: boolean;
  filesDeleted?: number;
  error?: string;
} {
  try {
    const currentScenario = getCurrentScenario(mockDataPath);
    const scenarioPath = getScenarioPath(currentScenario, mockDataPath);

    if (!fs.existsSync(scenarioPath)) {
      return { success: true, filesDeleted: 0 };
    }

    const files = fs.readdirSync(scenarioPath);
    let deleted = 0;

    files.forEach((file) => {
      if (file.endsWith(".json")) {
        const filePath = path.join(scenarioPath, file);
        fs.unlinkSync(filePath);
        deleted++;
      }
    });

    return { success: true, filesDeleted: deleted };
  } catch (error) {
    logger.error(`[MockSync] ❌ Error clearing mock files:`, error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Sync mock files from iOS simulator to project folder
 */
function syncFromIOSSimulator(
  projectRoot: string,
  mockDataPath: string,
): {
  success: boolean;
  filesSynced?: number;
  syncedFiles?: string[];
  error?: string;
} {
  try {
    // Get iOS simulator path
    const homeDir = process.env.HOME || process.env.USERPROFILE || "";
    const simulatorPath = path.join(
      homeDir,
      "Library/Developer/CoreSimulator/Devices",
    );

    if (!fs.existsSync(simulatorPath)) {
      return { success: false, error: "iOS Simulator path not found" };
    }

    // Find the most recent simulator device
    const devices = fs.readdirSync(simulatorPath);
    let latestDevice = "";
    let latestTime = 0;

    devices.forEach((device) => {
      const devicePath = path.join(simulatorPath, device);
      const stat = fs.statSync(devicePath);
      if (stat.mtimeMs > latestTime) {
        latestTime = stat.mtimeMs;
        latestDevice = device;
      }
    });

    if (!latestDevice) {
      return { success: false, error: "No iOS Simulator device found" };
    }

    // Look for mock-data directory in the simulator
    const appDataPath = path.join(
      simulatorPath,
      latestDevice,
      "data/Containers/Data/Application",
    );

    if (!fs.existsSync(appDataPath)) {
      return { success: false, error: "iOS Simulator app data path not found" };
    }

    const apps = fs.readdirSync(appDataPath);
    let found = false;
    let filesSynced = 0;
    const syncedFiles: string[] = [];

    for (const app of apps) {
      const appPath = path.join(appDataPath, app);
      const mockDataSimPath = path.join(appPath, "Documents/mock-data");

      if (fs.existsSync(mockDataSimPath)) {
        found = true;
        const currentScenario = getCurrentScenario(mockDataPath);
        const scenarioPath = getScenarioPath(currentScenario, mockDataPath);
        fs.mkdirSync(scenarioPath, { recursive: true });

        const files = fs.readdirSync(mockDataSimPath);
        files.forEach((file) => {
          if (file.endsWith(".json")) {
            const sourcePath = path.join(mockDataSimPath, file);
            const destPath = path.join(scenarioPath, file);
            fs.copyFileSync(sourcePath, destPath);
            filesSynced++;
            syncedFiles.push(file);
          }
        });

        break;
      }
    }

    if (!found) {
      return {
        success: false,
        filesSynced: 0,
        error: "mock-data directory not found in simulator",
      };
    }

    return { success: true, filesSynced, syncedFiles };
  } catch (error) {
    return { success: false, filesSynced: 0, error: (error as Error).message };
  }
}

/**
 * Recursive mock JSON files under scenario root (paths relative to scenario, POSIX slashes).
 */
function listScenarioMockJsonFiles(
  scenarioAbsPath: string,
): Array<{ relativePath: string; fullPath: string }> {
  const out: Array<{ relativePath: string; fullPath: string }> = [];
  if (!fs.existsSync(scenarioAbsPath)) {
    return out;
  }
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".json")) {
        const rel = path.relative(scenarioAbsPath, full);
        const relativePath = rel.split(path.sep).join("/");
        if (
          relativePath === "scenario-config.json" ||
          relativePath === "date-config.json"
        ) {
          continue;
        }
        out.push({ relativePath, fullPath: full });
      }
    }
  };
  walk(scenarioAbsPath);
  return out;
}

/**
 * Resolve a client-supplied path to a mock file under the scenario folder (blocks path traversal).
 */
function resolveScenarioRelativeMockPath(
  rawQueryPath: string,
  scenarioAbsPath: string,
): { relativePath: string; fullPath: string } | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawQueryPath);
  } catch {
    return null;
  }
  const normalized = decoded.replace(/\\/g, "/").replace(/^\//, "");
  if (!normalized.endsWith(".json") || normalized.includes("..")) {
    return null;
  }
  const fullPath = path.normalize(path.join(scenarioAbsPath, normalized));
  const scenarioResolved = path.resolve(scenarioAbsPath);
  const relativeToScenario = path.relative(scenarioResolved, fullPath);
  if (
    relativeToScenario.startsWith("..") ||
    path.isAbsolute(relativeToScenario)
  ) {
    return null;
  }
  const relativePath = relativeToScenario.split(path.sep).join("/");
  return { relativePath, fullPath };
}

/**
 * Small manifest only (paths + mtimes) for GET /mockifyer-sync-to-device-manifest.
 */
function buildSyncToDeviceManifest(mockDataPath: string): {
  success: boolean;
  files?: Array<{ filename: string; modificationTime: number }>;
  count?: number;
  error?: string;
} {
  try {
    const currentScenario = getCurrentScenario(mockDataPath);
    const scenarioPath = getScenarioPath(currentScenario, mockDataPath);
    const entries = listScenarioMockJsonFiles(scenarioPath);
    const files: Array<{ filename: string; modificationTime: number }> = [];
    for (const { relativePath, fullPath } of entries) {
      try {
        const stat = fs.statSync(fullPath);
        files.push({ filename: relativePath, modificationTime: stat.mtimeMs });
      } catch (e) {
        logger.warn(
          `[MetroSyncMiddleware] Manifest: could not stat ${fullPath}:`,
          e,
        );
      }
    }
    logger.info(
      `[MetroSyncMiddleware] /mockifyer-sync-to-device-manifest: ${files.length} file(s), scenario "${currentScenario}"`,
    );
    return { success: true, files, count: files.length };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * One mock file for GET /mockifyer-sync-to-device-file?path=
 */
function buildSyncToDeviceSingleFilePayload(
  mockDataPath: string,
  rawPathParam: string,
): {
  success: boolean;
  filename?: string;
  content?: MockData;
  modificationTime?: number;
  error?: string;
} {
  try {
    const currentScenario = getCurrentScenario(mockDataPath);
    const scenarioPath = getScenarioPath(currentScenario, mockDataPath);
    const resolved = resolveScenarioRelativeMockPath(
      rawPathParam,
      scenarioPath,
    );
    if (!resolved) {
      return { success: false, error: "Invalid or unsafe path" };
    }
    const { fullPath, relativePath } = resolved;
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      return { success: false, error: "Not found" };
    }
    const raw = fs.readFileSync(fullPath, "utf-8");
    const content = JSON.parse(raw) as MockData;
    if (!content?.request || !content?.response) {
      return {
        success: false,
        error: "Invalid mock JSON (missing request/response)",
      };
    }
    const stat = fs.statSync(fullPath);
    return {
      success: true,
      filename: relativePath,
      content,
      modificationTime: stat.mtimeMs,
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Build payload for GET /mockifyer-sync-to-device (project mock-data → native app via HybridProvider).
 */
function buildSyncToDevicePayload(mockDataPath: string): {
  success: boolean;
  files?: Array<{
    filename: string;
    content: MockData;
    modificationTime: number;
  }>;
  count?: number;
  error?: string;
} {
  try {
    const currentScenario = getCurrentScenario(mockDataPath);
    const scenarioPath = getScenarioPath(currentScenario, mockDataPath);
    const entries = listScenarioMockJsonFiles(scenarioPath);
    const files: Array<{
      filename: string;
      content: MockData;
      modificationTime: number;
    }> = [];

    for (const { relativePath, fullPath } of entries) {
      try {
        const raw = fs.readFileSync(fullPath, "utf-8");
        const content = JSON.parse(raw) as MockData;
        if (!content?.request || !content?.response) {
          logger.debug(
            `[MetroSyncMiddleware] Skipping JSON without request/response: ${relativePath}`,
          );
          continue;
        }
        const stat = fs.statSync(fullPath);
        files.push({
          filename: relativePath,
          content,
          modificationTime: stat.mtimeMs,
        });
      } catch (e) {
        logger.warn(`[MetroSyncMiddleware] Could not read ${fullPath}:`, e);
      }
    }

    logger.info(
      `[MetroSyncMiddleware] /mockifyer-sync-to-device: ${files.length} mock file(s) from scenario "${getCurrentScenario(mockDataPath)}"`,
    );
    return { success: true, files, count: files.length };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * One pool response fixture for GET /mockifyer-pool-response?id=
 * Used by React Native serve-time `$pool` resolution when Node fs is unavailable.
 */
function buildPoolResponsePayload(
  mockDataPath: string,
  rawId: string,
): { success: boolean; item?: PoolResponseItem; error?: string } {
  const id = String(rawId || "").trim();
  if (!id || !POOL_ID_PATTERN.test(id)) {
    return { success: false, error: "Invalid pool response id" };
  }
  try {
    const item = loadPoolResponseItem(mockDataPath, id, {
      joinPath: (...parts) => path.join(...parts),
      existsSync: (p) => fs.existsSync(p),
      readFileSync: (p, encoding) => fs.readFileSync(p, encoding),
      writeFileSync: () => {
        throw new Error("pool loader is read-only");
      },
      mkdirSync: () => undefined,
    });
    if (!item) {
      return { success: false, error: "Not found" };
    }
    return { success: true, item };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Normalize URL pathname from Node/Metro `req.url` so `/mockifyer-sync-to-device/` matches `/mockifyer-sync-to-device`.
 * Without this, trailing slashes fall through to Expo Web's SPA and Expo Router treats them as AppDun routes.
 */
function normalizeMiddlewarePathname(reqUrl: string): string {
  if (!reqUrl || typeof reqUrl !== "string") {
    return "/";
  }
  let pathname = reqUrl.split("?")[0];
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  return pathname;
}

function saveAtlasHtmlIncident(
  projectRoot: string,
  mockDataPath: string,
  incidentId: string,
  html: string,
): {
  success: boolean;
  filePath?: string;
  relativePath?: string;
  error?: string;
} {
  const id = incidentId.trim();
  if (!id || !html.trim()) {
    return { success: false, error: "incidentId and html are required" };
  }
  if (id.includes("..") || id.includes("/") || id.includes("\\")) {
    return { success: false, error: "Invalid incident id" };
  }
  try {
    const dir = path.join(mockDataPath, "atlas-html", "incidents");
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${id}.html`);
    fs.writeFileSync(filePath, html, "utf8");
    const relativeFromRoot = path.relative(projectRoot, filePath);
    return {
      success: true,
      filePath,
      relativePath: relativeFromRoot.split(path.sep).join("/"),
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

function saveAtlasScreenshot(
  projectRoot: string,
  mockDataPath: string,
  relativePath: string,
  base64: string,
  metadata?: {
    sessionId?: string;
    screen?: string;
    scenario?: string;
    pageId?: string;
    capturedAt?: string;
  },
): {
  success: boolean;
  filePath?: string;
  relativePath?: string;
  error?: string;
} {
  const rel = relativePath.trim().replace(/^\/+/, "");
  if (!rel || !base64.trim()) {
    return { success: false, error: "relativePath and base64 are required" };
  }
  if (
    rel.includes("..") ||
    !rel.startsWith("screenshots/") ||
    !/\.(png|jpe?g|webp)$/i.test(rel)
  ) {
    return {
      success: false,
      error: "relativePath must be screenshots/<name>.(png|jpg|webp)",
    };
  }
  const fileName = path.basename(rel);
  if (!fileName || fileName === "." || fileName === "..") {
    return { success: false, error: "Invalid screenshot file name" };
  }
  try {
    const dir = path.join(mockDataPath, "atlas-html", "screenshots");
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, Buffer.from(base64.trim(), "base64"));
    const relativeFromRoot = path.relative(projectRoot, filePath);

    // Update Atlas doc map with screenshot metadata (Metro has fs, so HTML will be written)
    if (metadata?.screen && metadata?.sessionId) {
      const htmlPath = path.join(mockDataPath, "atlas-html");
      setAtlasDocHtmlOutputPath(htmlPath);
      setAtlasDocScreenshot({
        scenario: metadata.scenario,
        screen: metadata.screen,
        sessionId: metadata.sessionId,
        screenshotPath: rel,
        capturedAt: metadata.capturedAt ?? new Date().toISOString(),
        pageId: metadata.pageId,
      });
      flushAtlasDocHtmlRewrite();
    }

    return {
      success: true,
      filePath,
      relativePath: relativeFromRoot.split(path.sep).join("/"),
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Candidate relative body paths for a hop (refs first, then id / requestId variants).
 * Spills key by requestId when present, but older captures / races can land under event.id.
 */
function candidateBodyRelPaths(
  event: NetworkEvent,
  side: "req" | "res",
): string[] {
  const preferred = resolveNetworkEventBodyRelPaths(event);
  const out: string[] = [side === "req" ? preferred.req : preferred.res];
  const push = (rel: string | undefined) => {
    const trimmed = rel?.trim();
    if (!trimmed || out.includes(trimmed)) return;
    out.push(trimmed);
  };
  if (side === "req") push(event.requestBodyRef);
  else push(event.responseBodyRef);
  push(networkBodySpillRelPath(event.id, event.requestId, side));
  push(networkBodySpillRelPath(event.id, null, side));
  if (event.requestId?.trim()) {
    push(networkBodySpillRelPath(event.requestId, event.requestId, side));
  }
  return out;
}

const BODY_SPILL_REL_PATTERN =
  /^bodies\/[A-Za-z0-9._-]+-(req|res)\.(json|txt)$/;

/**
 * Locate a full body on disk or in the Metro spill buffer.
 * Writes buffer hits to disk so subsequent opens are stable.
 */
function findExistingBodyFile(options: {
  projectRoot: string;
  mockDataPath: string;
  event: NetworkEvent;
  side: "req" | "res";
}): { abs: string; rel: string } | null {
  const outDir = path.join(options.mockDataPath, "atlas-html");
  flushNetworkBodySpillsToDir(outDir);
  const snapshot = getNetworkBodySpillSnapshot();

  for (const rel of candidateBodyRelPaths(options.event, options.side)) {
    const fromBuffer = snapshot[rel];
    if (typeof fromBuffer === "string" && fromBuffer.length > 0) {
      const saved = saveAtlasBodySpill(
        options.projectRoot,
        options.mockDataPath,
        rel,
        fromBuffer,
      );
      if (saved.success && saved.filePath) {
        return { abs: saved.filePath, rel };
      }
    }
    const abs = path.join(outDir, rel);
    if (fs.existsSync(abs)) {
      return { abs, rel };
    }
  }
  return null;
}

/**
 * Read spilled request body text for a live include-trace re-call (optional).
 * Trace does not require spill — preview is used when the file is missing.
 */
function readSpilledRequestBodyText(
  projectRoot: string,
  mockDataPath: string,
  event: NetworkEvent,
): string | undefined {
  const found = findExistingBodyFile({
    projectRoot,
    mockDataPath,
    event,
    side: "req",
  });
  if (!found) return undefined;
  try {
    return fs.readFileSync(found.abs, "utf8");
  } catch {
    return undefined;
  }
}

/**
 * Nested hops already in the Metro buffer for this request (shown on the
 * include-trace HTML result page before the live re-call payload).
 */
function formatCapturedTraceLines(
  events: readonly NetworkEvent[],
  root: NetworkEvent,
): string[] {
  const byParent = new Map<string, NetworkEvent[]>();
  for (const ev of events) {
    const parent =
      typeof ev.parentRequestId === "string" ? ev.parentRequestId.trim() : "";
    if (!parent) continue;
    const list = byParent.get(parent) ?? [];
    list.push(ev);
    byParent.set(parent, list);
  }

  const lines: string[] = [];
  const guard = new Set<string>();
  const walk = (ev: NetworkEvent, depth: number): void => {
    const id =
      (typeof ev.requestId === "string" && ev.requestId.trim()) ||
      (typeof ev.id === "string" ? ev.id.trim() : "");
    if (id && guard.has(id)) return;
    if (id) guard.add(id);
    const indent = depth > 0 ? `${"  ".repeat(depth)}` : "";
    const status = ev.status != null ? String(ev.status) : "—";
    const ms = ev.durationMs != null ? `${ev.durationMs}ms` : "";
    lines.push(
      `${indent}${(ev.method || "?").toUpperCase()}  ${status}  ${ms}  ${ev.url || ev.path || ""}`.trimEnd(),
    );
    if (!id) return;
    for (const kid of byParent.get(id) || []) {
      walk(kid, depth + 1);
    }
  };
  walk(root, 0);
  return lines;
}

/**
 * Persist a full hop body spill from the device (RN) under atlas-html/bodies/.
 */
function saveAtlasBodySpill(
  projectRoot: string,
  mockDataPath: string,
  relativePath: string,
  text: string,
): {
  success: boolean;
  filePath?: string;
  relativePath?: string;
  error?: string;
} {
  const rel = relativePath.trim().replace(/^\/+/, "").replace(/\\/g, "/");
  if (!rel || typeof text !== "string") {
    return { success: false, error: "relativePath and text are required" };
  }
  if (rel.includes("..") || !BODY_SPILL_REL_PATTERN.test(rel)) {
    return {
      success: false,
      error:
        "relativePath must be bodies/<id>-req.json or bodies/<id>-res.json",
    };
  }
  try {
    const filePath = path.join(mockDataPath, "atlas-html", rel);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const body = rel.endsWith(".json") ? prettyPrintJsonText(text) : text;
    fs.writeFileSync(filePath, body, "utf8");
    const relativeFromRoot = path.relative(projectRoot, filePath);
    return {
      success: true,
      filePath,
      relativePath: relativeFromRoot.split(path.sep).join("/"),
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

const ATLAS_HTML_CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

/**
 * Serve any safe file under mock-data/atlas-html/ (index, pages, incidents, screenshots).
 * Prevents path traversal; directories resolve to index.html.
 */
function serveAtlasHtmlStatic(
  mockDataPath: string,
  relativeUrlPath: string,
  res: {
    setHeader: (k: string, v: string) => void;
    statusCode: number;
    end: (b?: string | Buffer) => void;
  },
): boolean {
  let rel = relativeUrlPath.split("?")[0] || "";
  try {
    rel = decodeURIComponent(rel);
  } catch {
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/plain");
    res.end("Invalid path encoding");
    return true;
  }
  rel = rel.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!rel || rel.endsWith("/")) {
    rel = `${rel}index.html`.replace(/^\//, "");
  }
  if (!rel || rel.includes("..") || path.isAbsolute(rel)) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/plain");
    res.end("Invalid atlas-html path");
    return true;
  }

  const root = path.resolve(mockDataPath, "atlas-html");
  const filePath = path.resolve(root, rel);
  const rootPrefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (filePath !== root && !filePath.startsWith(rootPrefix)) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "text/plain");
    res.end("Invalid atlas-html path");
    return true;
  }

  if (!fs.existsSync(filePath)) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain");
    res.end(
      "Atlas HTML file not found — run Dev Menu “Render Atlas docs” first.",
    );
    return true;
  }

  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    const indexPath = path.join(filePath, "index.html");
    if (!fs.existsSync(indexPath) || !fs.statSync(indexPath).isFile()) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain");
      res.end("Atlas HTML index not found in directory.");
      return true;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.end(fs.readFileSync(indexPath, "utf8"));
    return true;
  }

  if (!stat.isFile()) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain");
    res.end("Not a file");
    return true;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType =
    ATLAS_HTML_CONTENT_TYPES[ext] || "application/octet-stream";
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "no-cache");
  res.end(fs.readFileSync(filePath));
  return true;
}

const NETWORK_STREAM_NDJSON_REL = path.join("atlas-html", "atlas.ndjson");

function appendNetworkEventNdjson(
  mockDataPath: string,
  event: NetworkEvent,
): void {
  try {
    const filePath = path.join(mockDataPath, NETWORK_STREAM_NDJSON_REL);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.appendFileSync(filePath, `${JSON.stringify(event)}\n`, "utf8");
  } catch {
    // disk append is best-effort
  }
}

function writeNetworkEventsSnapshot(
  mockDataPath: string,
  events: NetworkEvent[],
): {
  dir: string;
  jsonPath: string;
  ndjsonPath: string;
  harPath: string;
  count: number;
} {
  const dir = path.join(mockDataPath, "atlas-html");
  fs.mkdirSync(dir, { recursive: true });
  const jsonPath = path.join(dir, "atlas-events.json");
  const ndjsonPath = path.join(dir, "atlas.ndjson");
  const harPath = path.join(dir, "atlas.har");
  fs.writeFileSync(jsonPath, `${JSON.stringify(events, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    ndjsonPath,
    `${events.map((e) => JSON.stringify(e)).join("\n")}${events.length ? "\n" : ""}`,
    "utf8",
  );
  fs.writeFileSync(harPath, buildAtlasHarJson(events), "utf8");
  return { dir, jsonPath, ndjsonPath, harPath, count: events.length };
}

function renderNetworkEventsAtlasHtml(
  projectRoot: string,
  mockDataPath: string,
  events: NetworkEvent[],
  scenario?: string,
): {
  success: boolean;
  written: number;
  outputDir: string;
  /** Absolute path to index.html on disk (open with the OS file handler). */
  indexPath: string;
  hopCount: number;
  error?: string;
} {
  const outDir = path.join(mockDataPath, "atlas-html");
  const doc = createEmptyAtlasDocMap(
    scenario?.trim() || events[0]?.scenario || "default",
  );
  // Flush any buffered large bodies so HTML "Open full …" links resolve on disk.
  flushNetworkBodySpillsToDir(outDir);
  const written = writeAtlasDocHtml(outDir, doc, events);
  writeNetworkEventsSnapshot(mockDataPath, events);
  const relativeFromRoot = path
    .relative(projectRoot, outDir)
    .split(path.sep)
    .join("/");
  const indexPath = path.join(outDir, "index.html");
  return {
    success: written > 0,
    written,
    outputDir: relativeFromRoot,
    indexPath,
    hopCount: events.length,
    error: written > 0 ? undefined : "writeAtlasDocHtml wrote 0 files",
  };
}

/** GET path under `/atlas-html/` or legacy `/mockifyer-atlas-html/` → file under mock-data/atlas-html/. */
function atlasHtmlStaticSuffix(url: string): string | null {
  const prefixes = ["/atlas-html", "/mockifyer-atlas-html"] as const;
  for (const prefix of prefixes) {
    if (url === prefix || url === `${prefix}/`) {
      return "index.html";
    }
    if (url.startsWith(`${prefix}/`)) {
      return url.slice(prefix.length + 1);
    }
  }
  return null;
}

/**
 * Metro middleware function
 */
export function createMockSyncMiddleware(options?: MetroSyncMiddlewareOptions) {
  const projectRoot = options?.projectRoot || process.cwd();
  const mockDataPath = path.resolve(
    projectRoot,
    options?.mockDataPath || "mock-data",
  );
  const testConfig = getTestGenerationConfig(options);

  // Log the resolved paths for debugging
  logger.info(
    `[MetroSyncMiddleware] Initialized with projectRoot: ${projectRoot}, mockDataPath: ${mockDataPath}`,
  );

  /** Last scenario announced at info. Polls of an unchanged scenario stay quiet. */
  let announcedScenario: string | undefined;

  attachMetroAtlasKeyHandler({
    atlasKey: options?.atlasKey,
    dashboardKey: options?.dashboardKey,
    dashboardUrl: options?.dashboardUrl,
    onSessionStart: (reason) => {
      clearDashboardTraceEnrichmentSchedules();
      // Explicit `t` starts a clean session. Live-stream connect must NOT wipe hops
      // already in the buffer (that made the live page look empty and empty HTML on stop).
      if (reason === "key") {
        lastHopDashboardBaseUrl = undefined;
        getMetroNetworkEventBuffer().clear();
      }
      setMetroAtlasCaptureSessionActive(true);
    },
    onSessionStop: async () => {
      setMetroAtlasCaptureSessionActive(false);

      const hopCount = getMetroNetworkEventBuffer().list().length;
      console.log(
        `[Mockifyer] Atlas: writing HTML for ${hopCount} hop(s)…`,
      );
      // Let Metro flush the stop logs before the sync HTML write blocks the loop.
      await new Promise<void>((resolve) => setImmediate(resolve));

      // Render local hops first so the HTML is usable immediately —
      // a slow dashboard must never hold up the file.
      if (renderBufferedAtlasHtml({ projectRoot, mockDataPath }) === 0) {
        console.log("[Mockifyer] Atlas stop complete.");
        return;
      }

      const dashboardBaseUrl = resolveAtlasEnrichmentDashboardUrl(
        options?.dashboardUrl,
      );
      if (!dashboardBaseUrl) {
        console.log("[Mockifyer] Atlas stop complete.");
        return;
      }

      const deadlineSec = Math.round(DASHBOARD_ENRICH_DEADLINE_MS / 1000);
      console.log(
        `[Mockifyer] Atlas: checking dashboard for nested hops (up to ${deadlineSec}s)…`,
      );
      const enrichStartedAt = Date.now();
      const heartbeat = setInterval(() => {
        const waitedSec = Math.round((Date.now() - enrichStartedAt) / 1000);
        console.log(
          `[Mockifyer] Atlas: still waiting on dashboard… (${waitedSec}s)`,
        );
      }, 1_500);
      heartbeat.unref?.();

      let added = 0;
      try {
        added = await enrichMetroBufferFromDashboard({
          dashboardBaseUrl,
          mockDataPath,
          timeoutMs: DASHBOARD_ENRICH_DEADLINE_MS,
        });
      } finally {
        clearInterval(heartbeat);
      }

      if (added > 0) {
        console.log(
          `[Mockifyer] Atlas: merged ${added} nested hop(s) from dashboard — re-rendering`,
        );
        await new Promise<void>((resolve) => setImmediate(resolve));
        renderBufferedAtlasHtml({ projectRoot, mockDataPath });
      } else {
        console.log(
          "[Mockifyer] Atlas: no additional nested hops from dashboard",
        );
      }
      console.log("[Mockifyer] Atlas stop complete.");
    },
  });

  return function mockSyncMiddleware(req: any, res: any, next: any) {
    const url = normalizeMiddlewarePathname(req.url || "");

    // Handle POST endpoint for clearing mocks
    if (url === "/mockifyer-clear" && req.method === "POST") {
      const result = clearMockFiles(mockDataPath);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
      return;
    }

    // Atlas `t` capture session flag — device / live page poll this for session UI.
    if (
      (url === ATLAS_CAPTURE_SESSION_PATH ||
        url === `${ATLAS_CAPTURE_SESSION_PATH}/`) &&
      req.method === "GET"
    ) {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      res.end(
        JSON.stringify({
          success: true,
          active: isMetroAtlasCaptureSessionActive(),
        }),
      );
      return;
    }

    // Live Atlas hop stream page (browser EventSource → same SSE as mockifyer-atlas CLI)
    if (
      (url === ATLAS_LIVE_STREAM_PATH || url === `${ATLAS_LIVE_STREAM_PATH}/`) &&
      req.method === "GET"
    ) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(buildAtlasLiveStreamHtml());
      return;
    }

    // Re-call a buffered hop with X-Mockifyer-Include-Trace (live page "trace" link).
    // Live HTTP only — nested hops come back on the response; no disk/Redis store required.
    // `format=html` returns a result page (new browser tab); default remains JSON.
    if (req.method === "GET" && url === ATLAS_TRACE_REPLAY_PATH) {
      const fullUrl = String(req.url || "");
      const q = fullUrl.includes("?")
        ? fullUrl.slice(fullUrl.indexOf("?") + 1)
        : "";
      const params = new URLSearchParams(q);
      const hopId = (params.get("id") || "").trim();
      const includeBodies = params.get("bodies") !== "0";
      const wantHtml =
        params.get("format") === "html" ||
        String(req.headers?.accept || "").includes("text/html");
      if (!hopId) {
        res.statusCode = 400;
        if (wantHtml) {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            buildAtlasTraceReplayHtml(
              {
                success: false,
                hopId: "",
                method: "",
                url: "",
                error: "id query param required",
                requestHeaders: {},
              },
              {
                atlasLiveUrl: ATLAS_LIVE_STREAM_PATH,
                dashboardUrl: resolveMetroDashboardUrl(options?.dashboardUrl),
              },
            ),
          );
        } else {
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({ success: false, error: "id query param required" }),
          );
        }
        return;
      }
      const buffer = getMetroNetworkEventBuffer();
      const events = buffer.list();
      const event =
        events.find((e) => e && (e.id === hopId || e.requestId === hopId)) ??
        undefined;
      const spilledRequestBody = event
        ? readSpilledRequestBodyText(projectRoot, mockDataPath, event)
        : undefined;
      const capturedLines = event
        ? formatCapturedTraceLines(events, event)
        : undefined;
      void replayNetworkEventWithIncludeTrace(events, hopId, {
        includeBodies,
        requestBody: spilledRequestBody,
      }).then((result) => {
        res.statusCode = result.success
          ? 200
          : result.error === "hop not found"
            ? 404
            : 502;
        res.setHeader("Cache-Control", "no-store");
        if (wantHtml) {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(
            buildAtlasTraceReplayHtml(result, {
              capturedLines,
              atlasLiveUrl: ATLAS_LIVE_STREAM_PATH,
              dashboardUrl: resolveMetroDashboardUrl(options?.dashboardUrl),
              requestBody:
                spilledRequestBody ||
                (typeof event?.requestBodyPreview === "string"
                  ? event.requestBodyPreview
                  : undefined),
            }),
          );
        } else {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        }
      });
      return;
    }

    // Live hop ring buffer for `mockifyer-atlas` interactive CLI
    if (url === "/mockifyer-network-events" && req.method === "POST") {
      collectRequestBodyUtf8(req, (err, body) => {
        if (err) {
          res.statusCode = 413;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: false, error: err.message }));
          return;
        }
        try {
          const parsed = JSON.parse(body) as {
            event?: NetworkEvent;
            events?: NetworkEvent[];
            dashboardBaseUrl?: string;
          };
          const incoming: NetworkEvent[] = [];
          if (parsed.event && typeof parsed.event === "object") {
            incoming.push(parsed.event);
          }
          if (Array.isArray(parsed.events)) {
            for (const e of parsed.events) {
              if (e && typeof e === "object") incoming.push(e);
            }
          }
          if (incoming.length === 0) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                success: false,
                error: "event or events required",
              }),
            );
            return;
          }
          const buffer = getMetroNetworkEventBuffer();
          const saved = incoming.map((e) => {
            const stored = buffer.append(e);
            appendNetworkEventNdjson(mockDataPath, stored);
            return stored;
          });
          const dashboardBaseUrl = resolveAtlasEnrichmentDashboardUrl(
            options?.dashboardUrl,
            parsed.dashboardBaseUrl,
          );
          if (dashboardBaseUrl) {
            scheduleDashboardTraceEnrichment({ dashboardBaseUrl, mockDataPath });
          }
          res.statusCode = 201;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              success: true,
              count: saved.length,
              size: buffer.size,
              atlasCaptureActive: isMetroAtlasCaptureSessionActive(),
            }),
          );
        } catch (error) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              success: false,
              error: `Invalid JSON: ${(error as Error).message}`,
            }),
          );
        }
      });
      return;
    }

    if (url === "/mockifyer-network-events" && req.method === "GET") {
      const fullUrl = req.url || "";
      const qIndex = fullUrl.indexOf("?");
      const params = new URLSearchParams(
        qIndex >= 0 ? fullUrl.slice(qIndex + 1) : "",
      );
      const limitRaw = params.get("limit");
      const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
      const buffer = getMetroNetworkEventBuffer();
      const events = buffer.list(
        Number.isFinite(limit as number) ? (limit as number) : undefined,
      );
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: true, size: buffer.size, events }));
      return;
    }

    if (url === "/mockifyer-network-events/stream" && req.method === "GET") {
      const fullUrl = req.url || "";
      const qIndex = fullUrl.indexOf("?");
      const params = new URLSearchParams(
        qIndex >= 0 ? fullUrl.slice(qIndex + 1) : "",
      );
      const backlog = params.get("backlog") !== "0";
      // First SSE client (e.g. mockifyer-atlas) auto-starts Metro Atlas capture.
      // Must run before reading the buffer — start clears hops for a clean session.
      notifyMetroAtlasStreamClientConnected();
      const buffer = getMetroNetworkEventBuffer();
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      if (typeof res.flushHeaders === "function") {
        res.flushHeaders();
      }
      res.write(
        `event: hello\ndata: ${JSON.stringify({ size: buffer.size })}\n\n`,
      );
      if (backlog) {
        const past = [...buffer.list()].reverse();
        for (const event of past) {
          res.write(`event: hop\ndata: ${JSON.stringify(event)}\n\n`);
        }
      }
      const unsubscribe = buffer.subscribe((event) => {
        try {
          res.write(`event: hop\ndata: ${JSON.stringify(event)}\n\n`);
        } catch {
          unsubscribe();
        }
      });
      const keepAlive = setInterval(() => {
        try {
          res.write(": ping\n\n");
        } catch {
          clearInterval(keepAlive);
          unsubscribe();
        }
      }, 15_000);
      const onClose = () => {
        clearInterval(keepAlive);
        unsubscribe();
        notifyMetroAtlasStreamClientDisconnected();
      };
      req.on("close", onClose);
      req.on("aborted", onClose);
      return;
    }

    if (url === "/mockifyer-network-events/analyze" && req.method === "GET") {
      const fullUrl = req.url || "";
      const qIndex = fullUrl.indexOf("?");
      const params = new URLSearchParams(
        qIndex >= 0 ? fullUrl.slice(qIndex + 1) : "",
      );
      const slowRaw = params.get("slowMs");
      const slowMs = slowRaw ? Number.parseInt(slowRaw, 10) : undefined;
      const buffer = getMetroNetworkEventBuffer();
      const analysis = analyzeMetroNetworkEvents(buffer.list(), {
        slowMs: Number.isFinite(slowMs as number)
          ? (slowMs as number)
          : undefined,
      });
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: true, analysis }));
      return;
    }

    if (url === "/mockifyer-network-events/snapshot" && req.method === "POST") {
      const buffer = getMetroNetworkEventBuffer();
      const events = [...buffer.list()].reverse();
      const result = writeNetworkEventsSnapshot(mockDataPath, events);
      res.statusCode = 201;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: true,
          count: result.count,
          dir: path.relative(projectRoot, result.dir).split(path.sep).join("/"),
          jsonPath: path
            .relative(projectRoot, result.jsonPath)
            .split(path.sep)
            .join("/"),
          ndjsonPath: path
            .relative(projectRoot, result.ndjsonPath)
            .split(path.sep)
            .join("/"),
          harPath: path
            .relative(projectRoot, result.harPath)
            .split(path.sep)
            .join("/"),
        }),
      );
      return;
    }

    if (url === "/mockifyer-network-events/render" && req.method === "POST") {
      collectRequestBodyUtf8(req, (err, body) => {
        if (err) {
          res.statusCode = 413;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: false, error: err.message }));
          return;
        }
        let scenario: string | undefined;
        if (body.trim()) {
          try {
            const parsed = JSON.parse(body) as { scenario?: string };
            if (typeof parsed.scenario === "string") scenario = parsed.scenario;
          } catch {
            // empty / ignore
          }
        }
        const buffer = getMetroNetworkEventBuffer();
        const dashboardBaseUrl = resolveAtlasEnrichmentDashboardUrl(
          options?.dashboardUrl,
        );
        const finishRender = () => {
          const events = [...buffer.list()].reverse();
          const result = renderNetworkEventsAtlasHtml(
            projectRoot,
            mockDataPath,
            events,
            scenario,
          );
          res.statusCode = result.success ? 201 : 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        };
        if (!dashboardBaseUrl) {
          finishRender();
          return;
        }
        void enrichMetroBufferFromDashboard({
          dashboardBaseUrl,
          mockDataPath,
          timeoutMs: DASHBOARD_ENRICH_DEADLINE_MS,
        }).then(() => {
          finishRender();
        });
      });
      return;
    }

    if (url === "/mockifyer-network-events/clear" && req.method === "POST") {
      clearDashboardTraceEnrichmentSchedules();
      lastHopDashboardBaseUrl = undefined;
      const buffer = getMetroNetworkEventBuffer();
      buffer.clear();
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: true, size: 0 }));
      return;
    }

    // Handle GET endpoint for domain-path rules (RN Hybrid hydrate at startup)
    if (url === "/mockifyer-domain-path-rules" && req.method === "GET") {
      const fullUrl = req.url || "";
      const qIndex = fullUrl.indexOf("?");
      const query = qIndex >= 0 ? fullUrl.slice(qIndex + 1) : "";
      const params = new URLSearchParams(query);
      const scenarioParam = params.get("scenario");
      const scenarioName =
        scenarioParam && scenarioParam.trim() !== ""
          ? scenarioParam.trim()
          : getCurrentScenario(mockDataPath);
      const rules = readDomainPathRulesFile(mockDataPath, scenarioName);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: true, scenario: scenarioName, rules }));
      return;
    }

    // Handle POST endpoint for domain-path rules discovery merge (Hybrid / RN)
    if (url === "/mockifyer-domain-path-rules" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body) as {
            scenario?: string;
            upserts?: DomainPathRulesMap;
            rules?: DomainPathRulesMap;
          };
          const scenarioName =
            typeof parsed.scenario === "string" && parsed.scenario.trim() !== ""
              ? parsed.scenario.trim()
              : getCurrentScenario(mockDataPath);
          const upserts = parseDomainPathRules(
            parsed.upserts ?? parsed.rules ?? {},
          );
          const existing = readDomainPathRulesFile(mockDataPath, scenarioName);
          const { rules, changed } = mergeDomainPathRuleUpserts(
            existing,
            upserts,
          );
          if (changed) {
            writeDomainPathRulesFile(mockDataPath, scenarioName, rules);
          }
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              success: true,
              changed,
              scenario: scenarioName,
              rules,
            }),
          );
        } catch (error) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              success: false,
              error: `Invalid JSON: ${(error as Error).message}`,
            }),
          );
        }
      });
      return;
    }

    // Generate-on-click for terminal OSC-8 links (terminals cannot hijack OSC-8).
    // GET /mockifyer-atlas-open?id=<hopId>&side=req|res|html
    if (
      req.method === "GET" &&
      (url === "/mockifyer-atlas-open" || url.startsWith("/mockifyer-atlas-open?"))
    ) {
      const fullUrl = String(req.url || "");
      const q = fullUrl.includes("?") ? fullUrl.slice(fullUrl.indexOf("?") + 1) : "";
      const params = new URLSearchParams(q);
      const hopId = (params.get("id") || "").trim();
      const sideParam = (params.get("side") || "html").trim().toLowerCase();
      const side =
        sideParam === "req" || sideParam === "res" ? sideParam : "html";

      const buffer = getMetroNetworkEventBuffer();
      // Buffer is newest-first; render expects chronological / display order.
      const events = [...buffer.list()].reverse();
      const rendered = renderNetworkEventsAtlasHtml(projectRoot, mockDataPath, events);
      if (!rendered.success) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            success: false,
            error: rendered.error || "atlas render failed",
          }),
        );
        return;
      }

      if (side === "html") {
        res.statusCode = 302;
        res.setHeader("Location", "/atlas-html/index.html");
        res.end();
        return;
      }

      const event =
        (hopId
          ? events.find((e) => e && (e.id === hopId || e.requestId === hopId))
          : undefined) || events[0];
      if (!event) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ success: false, error: "hop not found" }));
        return;
      }

      const found = findExistingBodyFile({
        projectRoot,
        mockDataPath,
        event,
        side,
      });
      if (found) {
        res.statusCode = 302;
        res.setHeader(
          "Location",
          `/atlas-html/${found.rel.split(path.sep).join("/")}`,
        );
        res.end();
        return;
      }

      // Spill not on disk yet (race) or never uploaded — still return the captured
      // preview so open/trace UX is usable. Do not write preview as the spill file.
      const preview =
        side === "req" ? event.requestBodyPreview : event.responseBodyPreview;
      if (typeof preview === "string" && preview.length > 0) {
        const preferred = resolveNetworkEventBodyRelPaths(event);
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Mockifyer-Body-Source", "preview");
        res.setHeader(
          "X-Mockifyer-Body-Note",
          "Full spill file missing; showing hop preview",
        );
        res.end(
          JSON.stringify(
            {
              success: true,
              source: "preview",
              hopId: event.id,
              side,
              relativePath: side === "req" ? preferred.req : preferred.res,
              preview,
            },
            null,
            2,
          ),
        );
        return;
      }

      const preferred = resolveNetworkEventBodyRelPaths(event);
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: false,
          error:
            "No full body spill on disk and no hop preview. Re-hit the endpoint during Atlas capture, then open again.",
          hopId: event.id,
          side,
          relativePath: side === "req" ? preferred.req : preferred.res,
        }),
      );
      return;
    }

    // Atlas HTML static files (index, pages, incidents, screenshots) — must not fall through to Expo web shell.
    // Prefer /atlas-html/; keep /mockifyer-atlas-html/ as a legacy alias.
    if (req.method === "GET") {
      const atlasSuffix = atlasHtmlStaticSuffix(url);
      if (atlasSuffix != null && serveAtlasHtmlStatic(mockDataPath, atlasSuffix, res)) {
        return;
      }
    }

    if (url === "/mockifyer-atlas-html" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body) as {
            incidentId?: string;
            html?: string;
          };
          const incidentId =
            typeof parsed.incidentId === "string" ? parsed.incidentId : "";
          const html = typeof parsed.html === "string" ? parsed.html : "";
          const result = saveAtlasHtmlIncident(
            projectRoot,
            mockDataPath,
            incidentId,
            html,
          );
          res.setHeader("Content-Type", "application/json");
          res.statusCode = result.success ? 201 : 400;
          res.end(JSON.stringify(result));
        } catch (error) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              success: false,
              error: `Invalid JSON: ${(error as Error).message}`,
            }),
          );
        }
      });
      return;
    }

    // Atlas screen screenshot (device → project mock-data/atlas-html/screenshots/)
    if (url === "/mockifyer-atlas-screenshot" && req.method === "POST") {
      collectRequestBodyUtf8(req, (err, body) => {
        if (err) {
          res.statusCode = 413;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: false, error: err.message }));
          return;
        }
        try {
          const parsed = JSON.parse(body) as {
            relativePath?: string;
            base64?: string;
            sessionId?: string;
            screen?: string;
            scenario?: string;
            pageId?: string;
            capturedAt?: string;
          };
          const relativePath =
            typeof parsed.relativePath === "string" ? parsed.relativePath : "";
          const base64 = typeof parsed.base64 === "string" ? parsed.base64 : "";
          const metadata = {
            sessionId:
              typeof parsed.sessionId === "string"
                ? parsed.sessionId
                : undefined,
            screen:
              typeof parsed.screen === "string" ? parsed.screen : undefined,
            scenario:
              typeof parsed.scenario === "string" ? parsed.scenario : undefined,
            pageId:
              typeof parsed.pageId === "string" ? parsed.pageId : undefined,
            capturedAt:
              typeof parsed.capturedAt === "string"
                ? parsed.capturedAt
                : undefined,
          };
          const result = saveAtlasScreenshot(
            projectRoot,
            mockDataPath,
            relativePath,
            base64,
            metadata,
          );
          res.setHeader("Content-Type", "application/json");
          res.statusCode = result.success ? 201 : 400;
          res.end(JSON.stringify(result));
        } catch (error) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              success: false,
              error: `Invalid JSON: ${(error as Error).message}`,
            }),
          );
        }
      });
      return;
    }

    // Full hop body spill (device → project mock-data/atlas-html/bodies/)
    if (url === "/mockifyer-atlas-body-spill" && req.method === "POST") {
      collectRequestBodyUtf8(req, (err, body) => {
        if (err) {
          res.statusCode = 413;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: false, error: err.message }));
          return;
        }
        try {
          const parsed = JSON.parse(body) as {
            relativePath?: string;
            text?: string;
          };
          const relativePath =
            typeof parsed.relativePath === "string" ? parsed.relativePath : "";
          const text = typeof parsed.text === "string" ? parsed.text : "";
          const result = saveAtlasBodySpill(
            projectRoot,
            mockDataPath,
            relativePath,
            text,
          );
          res.setHeader("Content-Type", "application/json");
          res.statusCode = result.success ? 201 : 400;
          res.end(JSON.stringify(result));
        } catch (error) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              success: false,
              error: `Invalid JSON: ${(error as Error).message}`,
            }),
          );
        }
      });
      return;
    }

    // Full Atlas interactive HTML (Dev Menu → requestAtlasDocsRender)
    if (url === "/mockifyer-atlas-render" && req.method === "POST") {
      collectRequestBodyUtf8(req, (err, body) => {
        if (err) {
          res.statusCode = 413;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: false, error: err.message }));
          return;
        }
        try {
          const parsed = JSON.parse(body) as {
            outputRelativeDir?: string;
            doc?: AtlasDocMap;
            events?: NetworkEvent[];
            bodySpills?: Record<string, string>;
          };
          const rel =
            typeof parsed.outputRelativeDir === "string" &&
            parsed.outputRelativeDir.trim()
              ? parsed.outputRelativeDir.trim().replace(/^[/\\]+/, "")
              : "atlas-html";
          if (rel.includes("..")) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                success: false,
                error: "Invalid outputRelativeDir",
              }),
            );
            return;
          }
          const outDir = path.join(mockDataPath, rel);
          const doc = parsed.doc;
          if (!doc || typeof doc !== "object") {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({ success: false, error: "doc is required" }),
            );
            return;
          }
          setAtlasDocMap(doc);
          setAtlasDocHtmlOutputPath(outDir);
          const spillWritten = writeNetworkBodySpillMap(
            outDir,
            parsed.bodySpills,
          );
          const events = Array.isArray(parsed.events) ? parsed.events : [];
          const written = writeAtlasDocHtml(outDir, doc, events);
          const relativeFromRoot = path
            .relative(projectRoot, outDir)
            .split(path.sep)
            .join("/");
          res.setHeader("Content-Type", "application/json");
          res.statusCode = written > 0 ? 201 : 500;
          res.end(
            JSON.stringify({
              success: written > 0,
              written,
              bodySpillsWritten: spillWritten,
              dir: outDir,
              outputDir: relativeFromRoot,
              indexPath: path.join(outDir, "index.html"),
              hopCount: events.length,
              error:
                written > 0 ? undefined : "writeAtlasDocHtml wrote 0 files",
            }),
          );
        } catch (error) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              success: false,
              error: `Invalid JSON: ${(error as Error).message}`,
            }),
          );
        }
      });
      return;
    }

    // Handle POST endpoint for direct save (HybridProvider)
    if (url === "/mockifyer-save" && req.method === "POST") {
      let body = "";

      req.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });

      req.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          if (
            parsed &&
            typeof parsed === "object" &&
            parsed.__mockifyerProxyMirror === true &&
            parsed.mockData
          ) {
            const scenarioName =
              typeof parsed.scenarioName === "string"
                ? parsed.scenarioName
                : "";
            const relativePath =
              typeof parsed.relativePath === "string"
                ? parsed.relativePath
                : "";
            const result = saveProxyMirrorMockToProject(
              parsed.mockData,
              projectRoot,
              mockDataPath,
              scenarioName,
              relativePath,
              testConfig,
            );
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result));
            return;
          }
          const mockData = parsed;
          const result = saveMockToProjectFolder(
            mockData,
            projectRoot,
            mockDataPath,
            testConfig,
          );

          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        } catch (error) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              success: false,
              error: `Invalid JSON: ${(error as Error).message}`,
            }),
          );
        }
      });
      return;
    }

    // Project folder → device/simulator: manifest (small JSON)
    if (url === "/mockifyer-sync-to-device-manifest" && req.method === "GET") {
      const payload = buildSyncToDeviceManifest(mockDataPath);
      res.setHeader("Content-Type", "application/json");
      res.statusCode = payload.success ? 200 : 500;
      res.end(JSON.stringify(payload));
      return;
    }

    // Promoted pool response for RN `$pool` serve-time resolve
    if (url === "/mockifyer-pool-response" && req.method === "GET") {
      const fullUrl = req.url || "";
      const qIndex = fullUrl.indexOf("?");
      const query = qIndex >= 0 ? fullUrl.slice(qIndex + 1) : "";
      const params = new URLSearchParams(query);
      const idParam = params.get("id") || "";
      const payload = buildPoolResponsePayload(mockDataPath, idParam);
      res.setHeader("Content-Type", "application/json");
      if (payload.success) {
        res.statusCode = 200;
      } else if (payload.error === "Not found") {
        res.statusCode = 404;
      } else {
        res.statusCode = 400;
      }
      res.end(JSON.stringify(payload));
      return;
    }

    // Single file for HybridProvider (avoids multi‑MB single response)
    if (url === "/mockifyer-sync-to-device-file" && req.method === "GET") {
      const fullUrl = req.url || "";
      const qIndex = fullUrl.indexOf("?");
      const query = qIndex >= 0 ? fullUrl.slice(qIndex + 1) : "";
      const params = new URLSearchParams(query);
      const pathParam = params.get("path") || "";
      const payload = buildSyncToDeviceSingleFilePayload(
        mockDataPath,
        pathParam,
      );
      res.setHeader("Content-Type", "application/json");
      if (payload.success) {
        res.statusCode = 200;
      } else if (payload.error === "Not found") {
        res.statusCode = 404;
      } else {
        res.statusCode = 400;
      }
      res.end(JSON.stringify(payload));
      return;
    }

    // Legacy: all files in one response (may OOM / timeout on large scenarios)
    if (url === "/mockifyer-sync-to-device" && req.method === "GET") {
      const payload = buildSyncToDevicePayload(mockDataPath);
      res.setHeader("Content-Type", "application/json");
      res.statusCode = payload.success ? 200 : 500;
      res.end(JSON.stringify(payload));
      return;
    }

    // Handle GET endpoint for sync status
    if (url === "/mockifyer-sync/status" && req.method === "GET") {
      const currentScenario = getCurrentScenario(mockDataPath);
      const scenarioPath = getScenarioPath(currentScenario, mockDataPath);
      const files = fs.existsSync(scenarioPath)
        ? fs
            .readdirSync(scenarioPath)
            .filter((f: string) => f.endsWith(".json"))
        : [];

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: true,
          scenario: currentScenario,
          fileCount: files.length,
          files: files.slice(0, 10), // Return first 10 files
        }),
      );
      return;
    }

    // Handle GET endpoint for sync (legacy polling-based sync)
    if (url === "/mockifyer-sync" && req.method === "GET") {
      const result = syncFromIOSSimulator(projectRoot, mockDataPath);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
      return;
    }

    // Handle GET endpoint for scenario config
    if (url === "/mockifyer-scenario-config" && req.method === "GET") {
      const writeScenarioResponse = (scenario: string): void => {
        if (announcedScenario !== scenario) {
          logger.info(`[MetroSyncMiddleware] Active scenario: ${scenario}`);
          announcedScenario = scenario;
        }
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            success: true,
            currentScenario: scenario,
          }),
        );
      };

      try {
        // Check environment variable first (highest priority)
        if (process.env.MOCKIFYER_SCENARIO) {
          logger.debug(
            `[MetroSyncMiddleware] Using scenario from MOCKIFYER_SCENARIO env var: ${process.env.MOCKIFYER_SCENARIO}`,
          );
          writeScenarioResponse(process.env.MOCKIFYER_SCENARIO);
          return;
        }

        const configPath = path.join(mockDataPath, "scenario-config.json");
        const resolvedPath = path.resolve(configPath);
        logger.debug(
          `[MetroSyncMiddleware] Reading scenario config from: ${resolvedPath}`,
        );
        logger.debug(
          `[MetroSyncMiddleware] mockDataPath: ${mockDataPath}, projectRoot: ${projectRoot}`,
        );

        if (fs.existsSync(configPath)) {
          const fileContent = fs.readFileSync(configPath, "utf-8");
          logger.debug(`[MetroSyncMiddleware] File content: ${fileContent}`);
          const config = JSON.parse(fileContent);
          const scenario = config.currentScenario || DEFAULT_SCENARIO;
          logger.debug(
            `[MetroSyncMiddleware] Found scenario in config: ${scenario} (from file: ${JSON.stringify(config)})`,
          );
          writeScenarioResponse(scenario);
        } else {
          logger.debug(
            `[MetroSyncMiddleware] Config file not found at ${resolvedPath}, returning default scenario`,
          );
          writeScenarioResponse(DEFAULT_SCENARIO);
        }
      } catch (error) {
        logger.error(
          `[MetroSyncMiddleware] Error reading scenario config:`,
          error,
        );
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({ success: false, error: (error as Error).message }),
        );
      }
      return;
    }

    // Handle POST endpoint for scenario config sync
    if (url === "/mockifyer-scenario-config" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        try {
          const config = JSON.parse(body);
          const configPath = path.join(mockDataPath, "scenario-config.json");
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({ success: false, error: (error as Error).message }),
          );
        }
      });
      return;
    }

    // Continue to next middleware if not handled
    next();
  };
}

/**
 * Start auto-sync from iOS Simulator
 */
export function startAutoSync(
  intervalMs: number = 5000,
  options?: MetroSyncMiddlewareOptions,
): void {
  if (autoSyncInterval) {
    return;
  }

  const projectRoot = options?.projectRoot || process.cwd();
  const mockDataPath = path.resolve(
    projectRoot,
    options?.mockDataPath || "mock-data",
  );

  logger.info(`[MockSync] Starting auto-sync every ${intervalMs}ms`);
  autoSyncInterval = setInterval(() => {
    syncFromIOSSimulator(projectRoot, mockDataPath);
  }, intervalMs);
}

/**
 * Stop auto-sync
 */
export function stopAutoSync(): void {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }
}

// Export sync function for manual use
export { syncFromIOSSimulator };
