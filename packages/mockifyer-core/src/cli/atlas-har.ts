#!/usr/bin/env ts-node

/**
 * Generate a Chrome/Proxyman-compatible HAR 1.2 file from Atlas hops.
 *
 * Usage:
 *   npx @sgedda/mockifyer-core mockifyer-atlas-har --dir ./mock-data/atlas-html
 *   npx @sgedda/mockifyer-core mockifyer-atlas-har --events ./hops.json -o ./out.har
 *   or: ts-node src/cli/atlas-har.ts [options]
 *
 * Prefer `--dir` after "Render Atlas docs" (reads `atlas-events.json` written next to HTML).
 */

import fs from 'fs';
import path from 'path';
import { buildAtlasHarJson } from '../utils/atlas-har';
import type { NetworkEvent } from '../utils/network-event-types';

interface CliOptions {
  dir?: string;
  events?: string;
  output?: string;
  scenario?: string;
  includeIncidents?: boolean;
  help?: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--dir' || arg === '-d') {
      options.dir = args[++i];
    } else if (arg === '--events' || arg === '-e') {
      options.events = args[++i];
    } else if (arg === '--output' || arg === '-o') {
      options.output = args[++i];
    } else if (arg === '--scenario' || arg === '-s') {
      options.scenario = args[++i];
    } else if (arg === '--include-incidents') {
      options.includeIncidents = true;
    }
  }

  return options;
}

function showHelp(): void {
  console.log(`
Mockifyer Atlas HAR generator

Writes HAR 1.2 (open in Chrome DevTools → Network → import HAR, Proxyman, Charles).

Usage:
  mockifyer-atlas-har --dir <atlas-html-dir>
  mockifyer-atlas-har --events <events.json> [-o <atlas.har>]

Options:
  -d, --dir <path>           Atlas HTML output dir (reads atlas-events.json)
  -e, --events <path>        JSON array of NetworkEvent hops
  -o, --output <path>        Output .har path (default: <dir>/atlas.har or ./atlas.har)
  -s, --scenario <name>      Scenario comment in HAR creator
      --include-incidents    Include incident rows
  -h, --help                 Show this help

Examples:
  # After Dev Menu → Render Atlas docs
  mockifyer-atlas-har --dir ./mock-data/atlas-html

  # From a saved hop dump
  mockifyer-atlas-har --events ./hops.json -o ./session.har
`);
}

function loadEventsFromFile(filePath: string): NetworkEvent[] {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Events file not found: ${abs}`);
  }
  const raw = fs.readFileSync(abs, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (Array.isArray(parsed)) {
    return parsed as NetworkEvent[];
  }
  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { events?: unknown }).events)) {
    return (parsed as { events: NetworkEvent[] }).events;
  }
  throw new Error(`Expected a JSON array of hops (or { events: [] }) in ${abs}`);
}

function resolveCreatorVersion(): string {
  try {
    const pkgPath = path.join(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: string };
    return pkg.version?.trim() || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

function main(): void {
  const options = parseArgs();
  if (options.help) {
    showHelp();
    return;
  }

  let eventsPath = options.events?.trim();
  let outPath = options.output?.trim();
  const dir = options.dir?.trim();

  if (dir) {
    const absDir = path.resolve(dir);
    if (!eventsPath) {
      eventsPath = path.join(absDir, 'atlas-events.json');
    }
    if (!outPath) {
      outPath = path.join(absDir, 'atlas.har');
    }
  }

  if (!eventsPath) {
    showHelp();
    console.error('Error: provide --dir <atlas-html> or --events <file>');
    process.exit(1);
  }

  if (!outPath) {
    outPath = path.resolve('./atlas.har');
  } else {
    outPath = path.resolve(outPath);
  }

  try {
    const events = loadEventsFromFile(eventsPath);
    const har = buildAtlasHarJson(events, {
      scenario: options.scenario,
      creatorVersion: resolveCreatorVersion(),
      includeIncidents: options.includeIncidents,
    });
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, har, 'utf8');
    const entryCount = JSON.parse(har).log?.entries?.length ?? 0;
    console.log(`Wrote HAR (${entryCount} entries) → ${outPath}`);
  } catch (error) {
    console.error(`Failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

main();
