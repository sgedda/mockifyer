#!/usr/bin/env node
/**
 * Sync the WanderWeird Atlas showcase asset into mockifyer-web.
 *
 * Preferred source (real traffic, scrubbed):
 *   1. Local e2e/atlas-report/ after `cd e2e && npm test`
 *      (global-teardown fetches dashboard events, scrubs, buildAtlasDocHtmlFiles)
 *   2. Latest GitHub Actions artifact named `atlas-architecture`
 *      (same pipeline that publishes Pages /atlas/)
 *
 * Usage:
 *   node mockifyer-web/scripts/sync-wanderweird-atlas.mjs
 *   node mockifyer-web/scripts/sync-wanderweird-atlas.mjs --from e2e/atlas-report
 *   node mockifyer-web/scripts/sync-wanderweird-atlas.mjs --from-artifact
 *   node mockifyer-web/scripts/sync-wanderweird-atlas.mjs --skip-preview
 *
 * Requires: gh CLI (for --from-artifact), playwright (for preview.jpg).
 * Does not wire into CI — run manually when refreshing the marketing asset.
 */

import { execFileSync } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const DEST_DIR = path.resolve(__dirname, '../frontend/public/atlas/wanderweird');
const E2E_REPORT = path.join(REPO_ROOT, 'e2e/atlas-report');

/** Interactive Atlas from teardown (renamed to atlas.html so index.html can be the provenance wrapper). */
const REQUIRED_FILES = ['index.html', 'bodies-search.json'];
const DEST_INTERACTIVE = 'atlas.html';
const OPTIONAL_OMIT = ['atlas.har', 'atlas-events.json'];
const WRAPPER_MARKER = 'atlas-origin-banner';

function parseArgs(argv) {
  const args = {
    from: null,
    fromArtifact: false,
    skipPreview: false,
    artifactId: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--from' && argv[i + 1]) {
      args.from = path.resolve(argv[++i]);
    } else if (a === '--from-artifact') {
      args.fromArtifact = true;
    } else if (a === '--skip-preview') {
      args.skipPreview = true;
    } else if (a === '--artifact-id' && argv[i + 1]) {
      args.artifactId = argv[++i];
    } else if (a === '--help' || a === '-h') {
      console.log(`Usage: sync-wanderweird-atlas.mjs [--from DIR | --from-artifact] [--artifact-id ID] [--skip-preview]`);
      process.exit(0);
    }
  }
  return args;
}

function assertRealTrafficHtml(html) {
  const observed = html.match(/"observedEndpoints"\s*:\s*(\d+)/);
  const requests = html.match(/"totalRequests"\s*:\s*(\d+)/);
  const observedN = observed ? Number(observed[1]) : 0;
  const requestsN = requests ? Number(requests[1]) : 0;
  if (requestsN <= 0 && observedN <= 0) {
    throw new Error(
      'Refusing to sync: Atlas has 0 observed requests/endpoints (code-only scan). Generate from real WanderWeird traffic first.'
    );
  }
  if (!/color-scheme:\s*light/.test(html) && !/content="light"/.test(html)) {
    console.warn('⚠ Atlas HTML may be missing explicit light color-scheme');
  }
  if (/prefers-color-scheme:\s*dark/.test(html)) {
    console.warn('⚠ Atlas HTML contains prefers-color-scheme: dark — owner wants light-only');
  }
  return {
    observedEndpoints: observedN,
    totalRequests: requestsN,
  };
}

function extractOverview(html) {
  const m = html.match(/"overview"\s*:\s*(\{[^}]{0,1200}\})/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

function copyAtlasFiles(sourceDir) {
  for (const name of REQUIRED_FILES) {
    const src = path.join(sourceDir, name);
    if (!fs.existsSync(src)) {
      throw new Error(`Missing required file in source: ${name}`);
    }
  }
  fs.mkdirSync(DEST_DIR, { recursive: true });
  // Preserve marketing wrapper (index.html); write interactive Atlas beside it.
  const wrapperPath = path.join(DEST_DIR, 'index.html');
  if (fs.existsSync(wrapperPath)) {
    const wrapper = fs.readFileSync(wrapperPath, 'utf8');
    if (!wrapper.includes(WRAPPER_MARKER)) {
      throw new Error(
        'Dest index.html is not the provenance wrapper — refusing to overwrite. Restore the wrapper first.'
      );
    }
  }
  fs.copyFileSync(path.join(sourceDir, 'index.html'), path.join(DEST_DIR, DEST_INTERACTIVE));
  fs.copyFileSync(path.join(sourceDir, 'bodies-search.json'), path.join(DEST_DIR, 'bodies-search.json'));
  for (const name of OPTIONAL_OMIT) {
    const dest = path.join(DEST_DIR, name);
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
  }
}

function downloadLatestArtifact(artifactId) {
  const tmp = fs.mkdtempSync(path.join('/tmp', 'atlas-sync-'));
  const zipPath = path.join(tmp, 'atlas.zip');
  let id = artifactId;
  if (!id) {
    const list = execFileSync(
      'gh',
      ['api', 'repos/sgedda/mockifyer/actions/artifacts', '--jq', '.artifacts[] | select(.name=="atlas-architecture" and .expired==false) | .id'],
      { encoding: 'utf8' }
    )
      .trim()
      .split('\n')
      .filter(Boolean);
    if (!list.length) {
      throw new Error('No non-expired atlas-architecture artifacts found');
    }
    id = list[0];
  }
  console.log(`Downloading artifact ${id}…`);
  execFileSync('gh', ['api', `repos/sgedda/mockifyer/actions/artifacts/${id}/zip`], {
    stdio: ['ignore', fs.openSync(zipPath, 'w'), 'inherit'],
  });
  execFileSync('unzip', ['-qo', zipPath, '-d', tmp]);
  return { dir: tmp, artifactId: id };
}

async function capturePreview() {
  const require = createRequire(import.meta.url);
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    console.warn('playwright not installed in mockifyer-web — skipping preview.jpg');
    return false;
  }

  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = urlPath === '/' || urlPath.endsWith('/') ? 'index.html' : urlPath.replace(/^\//, '');
    const filePath = path.join(DEST_DIR, rel);
    if (!filePath.startsWith(DEST_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404);
      res.end('missing');
      return;
    }
    const ext = path.extname(filePath);
    const types = { '.html': 'text/html', '.json': 'application/json', '.jpg': 'image/jpeg' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, colorScheme: 'light' });
    await page.emulateMedia({ colorScheme: 'light' });
    // Preview the interactive Atlas (not the provenance wrapper).
    await page.goto(`http://127.0.0.1:${port}/atlas.html`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      const overview = [...document.querySelectorAll('h2,h3')].find((n) =>
        /^Overview$/i.test((n.textContent || '').trim())
      );
      overview?.scrollIntoView({ block: 'start' });
    });
    await page.waitForTimeout(400);
    const clip = await page.evaluate(() => {
      const overview = [...document.querySelectorAll('h2,h3')].find((n) =>
        /^Overview$/i.test((n.textContent || '').trim())
      );
      const svg = document.querySelector('svg');
      if (!overview || !svg) return null;
      const o = overview.getBoundingClientRect();
      const s = svg.getBoundingClientRect();
      const top = Math.max(0, o.top - 16);
      const bottom = Math.min(window.innerHeight, s.bottom + 24);
      return { x: 0, y: top, width: window.innerWidth, height: Math.max(400, bottom - top) };
    });
    const out = path.join(DEST_DIR, 'preview.jpg');
    await page.screenshot({
      path: out,
      type: 'jpeg',
      quality: 82,
      clip: clip || { x: 0, y: 120, width: 1600, height: 860 },
    });
    console.log(`  ✓ preview.jpg (${Math.round(fs.statSync(out).size / 1024)}KB)`);
    return true;
  } finally {
    await browser.close();
    server.close();
  }
}

function writeManifest({ source, artifactId, overview, stats }) {
  const html = fs.readFileSync(path.join(DEST_DIR, DEST_INTERACTIVE));
  const manifest = {
    source,
    artifactId: artifactId || null,
    generatedVia: 'e2e/global-teardown.ts → scrubNetworkEvent + buildAtlasDocHtmlFiles',
    scenario: 'WanderWeird E2E Run',
    overview: overview || stats,
    scrubbed: true,
    colorScheme: 'light',
    syncedAt: new Date().toISOString(),
    files: {
      'atlas.html': { bytes: html.length },
      'index.html': { note: 'provenance wrapper (banner + iframe); not overwritten by sync' },
      'bodies-search.json': { bytes: fs.statSync(path.join(DEST_DIR, 'bodies-search.json')).size },
      'preview.jpg': fs.existsSync(path.join(DEST_DIR, 'preview.jpg'))
        ? { bytes: fs.statSync(path.join(DEST_DIR, 'preview.jpg')).size }
        : null,
    },
    omitted: OPTIONAL_OMIT,
    omitReason:
      'Hop events are embedded in atlas.html; HAR is unused by the interactive page. Keeps the static asset small.',
  };
  fs.writeFileSync(path.join(DEST_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let sourceDir = args.from;
  let sourceLabel = sourceDir;
  let artifactId = args.artifactId;

  if (!sourceDir && !args.fromArtifact && fs.existsSync(path.join(E2E_REPORT, 'index.html'))) {
    sourceDir = E2E_REPORT;
    sourceLabel = 'e2e/atlas-report (local Playwright teardown)';
    console.log(`Using local e2e report: ${sourceDir}`);
  }

  if (!sourceDir) {
    args.fromArtifact = true;
  }

  if (args.fromArtifact) {
    const downloaded = downloadLatestArtifact(artifactId);
    sourceDir = downloaded.dir;
    artifactId = downloaded.artifactId;
    sourceLabel = `github-actions artifact atlas-architecture (${artifactId})`;
  }

  console.log(`Syncing Atlas from ${sourceLabel}`);
  const html = fs.readFileSync(path.join(sourceDir, 'index.html'), 'utf8');
  const stats = assertRealTrafficHtml(html);
  const overview = extractOverview(html);
  console.log(
    `  observedEndpoints=${stats.observedEndpoints} totalRequests=${stats.totalRequests}`
  );

  copyAtlasFiles(sourceDir);
  if (!args.skipPreview) {
    await capturePreview();
  }
  const manifest = writeManifest({
    source: sourceLabel,
    artifactId,
    overview,
    stats,
  });
  console.log(`✓ Wrote ${DEST_DIR}`);
  console.log(`  overview: ${JSON.stringify(manifest.overview)}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
