#!/usr/bin/env node
/**
 * Regenerate the WanderWeird Atlas showcase assets for mockifyer-web.
 *
 * The Atlas MUST come from real recorded traffic (observed requests > 0),
 * typically the scrubbed e2e/atlas-report produced by Playwright teardown,
 * or the `atlas-architecture` artifact from a successful e2e workflow run.
 *
 * Usage:
 *   # After a local e2e run that wrote e2e/atlas-report/
 *   node mockifyer-web/scripts/regenerate-wanderweird-atlas.mjs --from e2e/atlas-report
 *
 *   # Download the latest successful main-branch e2e Atlas artifact (requires gh)
 *   node mockifyer-web/scripts/regenerate-wanderweird-atlas.mjs --from-ci
 *
 *   # Skip Playwright preview screenshot refresh
 *   node mockifyer-web/scripts/regenerate-wanderweird-atlas.mjs --from e2e/atlas-report --skip-preview
 *
 * Writes:
 *   mockifyer-web/frontend/public/atlas/wanderweird/{index.html,bodies-search.json,GENERATED.md}
 *   mockifyer-web/frontend/public/images/wanderweird-atlas-preview.jpg
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(REPO_ROOT, 'mockifyer-web/frontend/public/atlas/wanderweird');
const PREVIEW_JPG = path.join(
  REPO_ROOT,
  'mockifyer-web/frontend/public/images/wanderweird-atlas-preview.jpg'
);

function parseArgs(argv) {
  const args = { from: null, fromCi: false, skipPreview: false, workflowRun: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--from') args.from = argv[++i];
    else if (a === '--from-ci') args.fromCi = true;
    else if (a === '--skip-preview') args.skipPreview = true;
    else if (a === '--run') args.workflowRun = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node mockifyer-web/scripts/regenerate-wanderweird-atlas.mjs --from <atlas-report-dir>
  node mockifyer-web/scripts/regenerate-wanderweird-atlas.mjs --from-ci [--run <run-id>]
  Options: --skip-preview`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function countObserved(sourceDir) {
  const eventsPath = path.join(sourceDir, 'atlas-events.json');
  const indexPath = path.join(sourceDir, 'index.html');

  let events = [];
  if (fs.existsSync(eventsPath)) {
    const data = readJson(eventsPath);
    events = Array.isArray(data) ? data : data.events || data.networkEvents || [];
  } else if (fs.existsSync(indexPath)) {
    const html = fs.readFileSync(indexPath, 'utf8');
    const match = html.match(
      /<script[^>]*id=["']atlas-data["'][^>]*>([\s\S]*?)<\/script>/i
    );
    if (!match) {
      throw new Error('Could not find embedded #atlas-data in index.html');
    }
    const payload = JSON.parse(match[1]);
    events = payload.events || [];
  } else {
    throw new Error(`No atlas-events.json or index.html in ${sourceDir}`);
  }

  if (!Array.isArray(events) || events.length === 0) {
    throw new Error(
      'Refusing to publish: observed requests = 0 (Atlas must come from real traffic, not a code-only scan)'
    );
  }

  const endpoints = new Set();
  for (const event of events) {
    if (!event || typeof event !== 'object') continue;
    const method = String(event.method || '?').toUpperCase();
    let route = event.path || '';
    if (!route && typeof event.url === 'string') {
      try {
        route = new URL(event.url).pathname;
      } catch {
        route = event.url.split('?')[0];
      }
    }
    endpoints.add(`${method} ${route}`);
  }

  return { requestCount: events.length, endpointCount: endpoints.size };
}

function downloadFromCi(runId) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-atlas-'));
  let resolvedRun = runId;
  if (!resolvedRun) {
    const list = spawnSync(
      'gh',
      [
        'run',
        'list',
        '--workflow=e2e.yml',
        '--branch=main',
        '--status=success',
        '--limit=5',
        '--json',
        'databaseId,conclusion,createdAt',
      ],
      { encoding: 'utf8', cwd: REPO_ROOT }
    );
    if (list.status !== 0) {
      throw new Error(`gh run list failed: ${list.stderr || list.stdout}`);
    }
    const runs = JSON.parse(list.stdout || '[]');
    if (!runs.length) throw new Error('No successful e2e.yml runs found on main');
    resolvedRun = String(runs[0].databaseId);
  }

  console.log(`Downloading atlas-architecture from run ${resolvedRun}…`);
  const dl = spawnSync(
    'gh',
    ['run', 'download', String(resolvedRun), '-n', 'atlas-architecture', '-D', tmp],
    { encoding: 'utf8', cwd: REPO_ROOT }
  );
  if (dl.status !== 0) {
    throw new Error(`gh run download failed: ${dl.stderr || dl.stdout}`);
  }
  return { dir: tmp, runId: resolvedRun };
}

function copyAtlasFiles(sourceDir) {
  const required = ['index.html'];
  for (const name of required) {
    const src = path.join(sourceDir, name);
    if (!fs.existsSync(src)) throw new Error(`Missing ${name} in ${sourceDir}`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.copyFileSync(path.join(sourceDir, 'index.html'), path.join(OUT_DIR, 'index.html'));

  const bodies = path.join(sourceDir, 'bodies-search.json');
  if (fs.existsSync(bodies)) {
    fs.copyFileSync(bodies, path.join(OUT_DIR, 'bodies-search.json'));
  }

  // Keep page weight down: do not vendor atlas.har / atlas-events.json (events are embedded).
}

function writeGeneratedNote({ requestCount, endpointCount, sourceLabel }) {
  const note = `# WanderWeird Atlas (showcase)

Generated by \`mockifyer-web/scripts/regenerate-wanderweird-atlas.mjs\`.

- Source: ${sourceLabel}
- Observed requests: ${requestCount}
- Distinct method+path endpoints: ${endpointCount}
- Scrub: e2e \`scrub-public-atlas\` (applied in e2e global teardown before the artifact is published)
- Theme: light only (Atlas HTML ships \`color-scheme: light\`)

Refresh:

\`\`\`bash
# Local e2e report
node mockifyer-web/scripts/regenerate-wanderweird-atlas.mjs --from e2e/atlas-report

# Latest successful CI artifact
node mockifyer-web/scripts/regenerate-wanderweird-atlas.mjs --from-ci
\`\`\`
`;
  fs.writeFileSync(path.join(OUT_DIR, 'GENERATED.md'), note, 'utf8');
}

async function capturePreview() {
  const playwrightPath = path.join(REPO_ROOT, 'e2e/node_modules/playwright');
  if (!fs.existsSync(playwrightPath)) {
    console.warn('Playwright not installed under e2e/; skipping preview screenshot');
    return;
  }

  const { chromium } = await import(playwrightPath);
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
    const filePath = path.join(
      OUT_DIR,
      safe === '/' ? 'index.html' : safe.replace(/^\//, '')
    );
    if (!filePath.startsWith(OUT_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    const ext = path.extname(filePath);
    const type =
      ext === '.html'
        ? 'text/html; charset=utf-8'
        : ext === '.json'
          ? 'application/json'
          : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    fs.createReadStream(filePath).pipe(res);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    const browser = await chromium.launch();
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
      colorScheme: 'light',
      deviceScaleFactor: 2,
    });
    await page.goto(`http://127.0.0.1:${port}/index.html`, {
      waitUntil: 'networkidle',
      timeout: 60_000,
    });
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('h2,h3,.section-title')).find((node) =>
        /Overview/i.test(node.textContent || '')
      );
      if (el) el.scrollIntoView({ block: 'start' });
    });
    await page.waitForTimeout(400);

    const rawPng = path.join(os.tmpdir(), `wanderweird-atlas-preview-${Date.now()}.png`);
    await page.screenshot({
      path: rawPng,
      clip: { x: 0, y: 0, width: 1100, height: 720 },
    });
    await browser.close();

    // Prefer JPEG via sharp/pillow if available; fall back to keeping PNG renamed note.
    const convert = spawnSync(
      'python3',
      [
        '-c',
        `
from PIL import Image
img = Image.open(${JSON.stringify(rawPng)}).convert('RGB')
max_w = 1100
if img.width > max_w:
    img = img.resize((max_w, int(max_w * img.height / img.width)), Image.Resampling.LANCZOS)
img.save(${JSON.stringify(PREVIEW_JPG)}, 'JPEG', quality=82, optimize=True, progressive=True)
print('wrote', ${JSON.stringify(PREVIEW_JPG)})
`,
      ],
      { encoding: 'utf8' }
    );
    if (convert.status !== 0) {
      console.warn('Pillow JPEG convert failed; copying PNG as fallback note');
      console.warn(convert.stderr || convert.stdout);
      const pngOut = PREVIEW_JPG.replace(/\.jpg$/, '.png');
      fs.copyFileSync(rawPng, pngOut);
    } else {
      console.log(convert.stdout.trim());
    }
    fs.unlinkSync(rawPng);
  } finally {
    server.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  if (!args.from && !args.fromCi) {
    usage();
    process.exitCode = 1;
    return;
  }
  if (args.from && args.fromCi) {
    throw new Error('Use either --from or --from-ci, not both');
  }

  let sourceDir;
  let sourceLabel;
  let cleanup = null;

  if (args.fromCi) {
    const downloaded = downloadFromCi(args.workflowRun);
    sourceDir = downloaded.dir;
    sourceLabel = `GitHub Actions e2e run ${downloaded.runId} (atlas-architecture artifact)`;
    cleanup = () => fs.rmSync(downloaded.dir, { recursive: true, force: true });
  } else {
    sourceDir = path.resolve(REPO_ROOT, args.from);
    sourceLabel = path.relative(REPO_ROOT, sourceDir) || sourceDir;
  }

  try {
    const stats = countObserved(sourceDir);
    console.log(
      `✓ Real traffic: ${stats.requestCount} requests, ${stats.endpointCount} distinct endpoints`
    );
    copyAtlasFiles(sourceDir);
    writeGeneratedNote({ ...stats, sourceLabel });
    console.log(`✓ Wrote Atlas HTML → ${path.relative(REPO_ROOT, OUT_DIR)}`);

    if (!args.skipPreview) {
      await capturePreview();
      console.log(`✓ Preview image → ${path.relative(REPO_ROOT, PREVIEW_JPG)}`);
    }
  } finally {
    if (cleanup) cleanup();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
