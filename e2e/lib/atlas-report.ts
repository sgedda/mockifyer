/**
 * Generate the interactive Atlas HTML report from dashboard network events.
 * Shared by global teardown (CI Pages artifact) and the Atlas GUI recording test.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BASE_SCENARIO, DASHBOARD } from './env';
import { scrubNetworkEvent } from './scrub-public-atlas';

export const ATLAS_REPORT_DIR = path.join(__dirname, '..', 'atlas-report');
export const ATLAS_INDEX = path.join(ATLAS_REPORT_DIR, 'index.html');

/** Enough recent hops for Architecture + Timeline inspection without a multi‑MB HTML page. */
export const ATLAS_GUI_EVENT_LIMIT = 150;

const WW_ROOT = path.resolve(__dirname, '../../example-projects/wanderweird-travel');
const CORE_DIST = path.resolve(__dirname, '../../packages/mockifyer-core/dist/utils');

export interface GenerateAtlasReportOptions {
  /** Dashboard base URL to pull network events from. */
  dashboardUrl?: string;
  /** Scenario whose network log to read (default: BASE_SCENARIO). */
  scenario?: string;
  /** Output directory (default: e2e/atlas-report). */
  outputDir?: string;
  /**
   * Max newest events to fetch (store is newest-first).
   * GUI recordings should keep this small; teardown may use a high limit.
   */
  limit?: number;
  /**
   * Skip `scanCodeForEndpoints` (≈9s on WanderWeird). Teardown keeps the scan for
   * code-only endpoints; the GUI recording only needs observed traffic.
   */
  skipCodeScan?: boolean;
}

export interface GenerateAtlasReportResult {
  outputDir: string;
  indexPath: string;
  indexUrl: string;
  eventCount: number;
  endpointCount: number;
}

/** file:// URL Playwright can open for the Atlas index page. */
export function atlasIndexFileUrl(indexPath = ATLAS_INDEX): string {
  return pathToFileURL(indexPath).href;
}

interface ScannedEndpoint {
  // Opaque to this module — passed straight into buildAtlasDocHtmlFiles.
  [key: string]: unknown;
}

let cachedScannedEndpoints: ScannedEndpoint[] | null = null;

function loadCoreAtlas(): {
  scanCodeForEndpoints: (dir: string) => { endpoints: ScannedEndpoint[] };
  buildAtlasDocHtmlFiles: (
    map: object,
    events: unknown[],
    options?: { scannedEndpoints?: ScannedEndpoint[] },
  ) => Record<string, string>;
} {
  // Built core dist (same require path as the former global-teardown inline).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { scanCodeForEndpoints } = require(path.join(CORE_DIST, 'atlas-code-scanner.js'));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { buildAtlasDocHtmlFiles } = require(path.join(CORE_DIST, 'atlas-doc-html.js'));
  return { scanCodeForEndpoints, buildAtlasDocHtmlFiles };
}

/** Scan WanderWeird once per process (teardown / repeated generates). */
function scanWanderWeirdEndpoints(): ScannedEndpoint[] {
  if (cachedScannedEndpoints) return cachedScannedEndpoints;
  const { scanCodeForEndpoints } = loadCoreAtlas();
  const mobileScan = scanCodeForEndpoints(path.join(WW_ROOT, 'apps/mobile/src'));
  const servicesScan = scanCodeForEndpoints(path.join(WW_ROOT, 'services'));
  cachedScannedEndpoints = [...mobileScan.endpoints, ...servicesScan.endpoints];
  return cachedScannedEndpoints;
}

/**
 * Fetch scrubbed network events, optionally scan WanderWeird sources, and write interactive Atlas HTML.
 * Never throws for empty traffic — callers decide whether zero events is a failure.
 */
export async function generateAtlasReport(
  options: GenerateAtlasReportOptions = {},
): Promise<GenerateAtlasReportResult> {
  const dashboardUrl = options.dashboardUrl ?? DASHBOARD;
  const scenario = options.scenario ?? BASE_SCENARIO;
  const outputDir = options.outputDir ?? ATLAS_REPORT_DIR;
  const limit = options.limit ?? 10_000;

  fs.mkdirSync(outputDir, { recursive: true });

  const query = new URLSearchParams({
    scenario,
    limit: String(limit),
  });
  const response = await fetch(`${dashboardUrl}/api/network-events?${query}`);
  if (!response.ok) {
    throw new Error(`dashboard network-events returned ${response.status}`);
  }
  const data = await response.json();
  const networkEvents = data.events || data;
  if (!Array.isArray(networkEvents)) {
    throw new Error('dashboard network-events response was not an array');
  }
  if (networkEvents.length >= 5_000) {
    console.warn(`[atlas-report] Hit dashboard limit (~5000); some traffic may be missing`);
  }

  const scrubbedEvents = networkEvents.map(scrubNetworkEvent);
  const allEndpoints = options.skipCodeScan ? [] : scanWanderWeirdEndpoints();
  const { buildAtlasDocHtmlFiles } = loadCoreAtlas();

  const map = {
    scenario: 'WanderWeird E2E Run',
    updatedAt: new Date().toISOString(),
    pages: {},
    screens: {},
    prefetches: {},
  };

  const files = buildAtlasDocHtmlFiles(map, scrubbedEvents, {
    scannedEndpoints: allEndpoints,
  });

  for (const [filename, content] of Object.entries(files)) {
    const filePath = path.join(outputDir, filename);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
  }

  const indexPath = path.join(outputDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error(`Atlas index was not written to ${indexPath}`);
  }

  return {
    outputDir,
    indexPath,
    indexUrl: atlasIndexFileUrl(indexPath),
    eventCount: scrubbedEvents.length,
    endpointCount: allEndpoints.length,
  };
}
