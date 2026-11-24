#!/usr/bin/env node
/**
 * Standalone CLI for `@sgedda/mockifyer-generator` (SGE-73).
 *
 * Node-only entry — do not import from the browser main barrel.
 * Usable as `npx -p @sgedda/mockifyer-generator mockifyer-generate ...`.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ALL_VARIANT_KINDS,
  VARIANT_KIND_SLUGS,
  defaultSampleForEntity,
  generateAsync,
  isMockDataLike,
  parseContext,
  tryResolveLocale,
  variants,
  type ChaosLevel,
  type ChaosLevelName,
  type NamedVariant,
  type VariantKind,
} from '../index';
import { writeVariantScenarios } from '../node';

/** Process exit codes. */
export const EXIT_OK = 0;
export const EXIT_ERROR = 1;

const CHAOS_LEVEL_NAMES: readonly ChaosLevelName[] = [
  'realistic',
  'mild',
  'wild',
  'nightmare',
];

const SLUG_TO_KIND: Record<string, VariantKind> = Object.fromEntries(
  (Object.entries(VARIANT_KIND_SLUGS) as Array<[VariantKind, string]>).map(
    ([kind, slug]) => [slug, kind]
  )
) as Record<string, VariantKind>;

export interface CliIo {
  stdout: { write(chunk: string): void };
  stderr: { write(chunk: string): void };
}

const defaultIo: CliIo = {
  stdout: process.stdout,
  stderr: process.stderr,
};

export class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number = EXIT_ERROR) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

interface FlagBag {
  flags: Map<string, string | true>;
  positionals: string[];
}

/** Flags that never take a value (must not consume the next argv token). */
const BOOLEAN_FLAGS = new Set([
  'help',
  'dry-run',
  'scramble-ids',
]);

/**
 * Minimal argv parser (no external deps).
 * Supports `--flag value`, `--flag=value`, boolean `--flag`, and `-h`.
 */
export function parseArgv(argv: string[]): FlagBag {
  const flags = new Map<string, string | true>();
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (arg === '-h') {
      flags.set('help', true);
      continue;
    }
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }

    const body = arg.slice(2);
    const eq = body.indexOf('=');
    if (eq !== -1) {
      const key = body.slice(0, eq);
      const value = body.slice(eq + 1);
      if (!key) {
        throw new CliError(`Invalid flag: ${arg}`);
      }
      flags.set(key, value);
      continue;
    }

    if (BOOLEAN_FLAGS.has(body)) {
      flags.set(body, true);
      continue;
    }

    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('-')) {
      flags.set(body, next);
      i++;
    } else {
      flags.set(body, true);
    }
  }

  return { flags, positionals };
}

function flagString(flags: Map<string, string | true>, name: string): string | undefined {
  const value = flags.get(name);
  if (value === undefined) return undefined;
  if (value === true) {
    throw new CliError(`Flag --${name} requires a value`);
  }
  return value;
}

function flagBool(flags: Map<string, string | true>, name: string): boolean {
  return flags.has(name);
}

function parseSeed(raw: string | undefined): number | string | undefined {
  if (raw === undefined) return undefined;
  if (/^-?\d+$/.test(raw)) {
    const n = Number(raw);
    if (!Number.isSafeInteger(n)) {
      throw new CliError(`Invalid --seed "${raw}" (must be a safe integer or string)`);
    }
    return n;
  }
  return raw;
}

function parseCount(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new CliError(`Invalid --count "${raw}" (must be a non-negative integer)`);
  }
  return n;
}

function parseChaosLevel(raw: string | undefined): ChaosLevel | undefined {
  if (raw === undefined) return undefined;
  if (/^\d*\.?\d+$/.test(raw)) {
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      throw new CliError(`Invalid --level "${raw}"`);
    }
    return n;
  }
  const lower = raw.toLowerCase() as ChaosLevelName;
  if (!(CHAOS_LEVEL_NAMES as readonly string[]).includes(lower)) {
    throw new CliError(
      `Unknown --level "${raw}". Use realistic|mild|wild|nightmare or a number in [0, 1].`
    );
  }
  return lower;
}

function parseKinds(raw: string | undefined): VariantKind[] | undefined {
  if (raw === undefined) return undefined;
  const parts = raw
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) {
    throw new CliError('Flag --kinds requires at least one kind');
  }

  const kinds: VariantKind[] = [];
  for (const part of parts) {
    if ((ALL_VARIANT_KINDS as readonly string[]).includes(part)) {
      kinds.push(part as VariantKind);
      continue;
    }
    const fromSlug = SLUG_TO_KIND[part];
    if (fromSlug) {
      kinds.push(fromSlug);
      continue;
    }
    const known = ALL_VARIANT_KINDS.map(
      (k) => `${k} (${VARIANT_KIND_SLUGS[k]})`
    ).join(', ');
    throw new CliError(`Unknown variant kind "${part}". Expected one of: ${known}`);
  }
  return kinds;
}

function readJsonFile(filePath: string): unknown {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new CliError(`File not found: ${resolved}`);
  }
  let text: string;
  try {
    text = fs.readFileSync(resolved, 'utf8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new CliError(`Failed to read ${resolved}: ${message}`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new CliError(`Invalid JSON in ${resolved}: ${message}`);
  }
}

function writeTextFile(filePath: string, contents: string): void {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, contents, 'utf8');
}

export function helpText(): string {
  return `mockifyer-generate — standalone mock-data generator CLI (no dashboard required)

USAGE
  mockifyer-generate <command> [options]
  npx -p @sgedda/mockifyer-generator mockifyer-generate <command> [options]

COMMANDS
  variants <mock.json>   Generate edge-case variants from a recorded Mockifyer mock
  sample [sample.json]   Generate records from a JSON sample and/or --context
  help                   Show this help

variants options
  --level <name|0..1>    Chaos level: realistic|mild|wild|nightmare (default mild)
  --kinds <list>         Comma-separated kinds (camelCase or slug), e.g. emptyLists,http-404
  --seed <n|string>      Deterministic seed
  --out <dir>            mock-data root to write scenario folders into (default ./mock-data)
  --scenario-prefix <s>  Scenario name prefix (default generated)
  --dry-run              Print summary + JSON to stdout; write nothing
  --scramble-ids         Allow mutating identifier fields (default: only at nightmare)

sample options
  --context <text>       Free-text context, e.g. 'swedish users, 5 items'
                         'N items' = nested items[] length; 'N orders/users' = record count.
                         Entity words (users/orders/products) pick a built-in shape when
                         no sample file is given.
  --count <n>            Number of records (default 1, or from 'N orders/users/…')
  --locale <code>        Locale: en|sv|de|fr|es (or aliases like swedish)
  --seed <n|string>      Deterministic seed
  --out <file>           Write JSON to file instead of stdout

EXIT CODES
  0  Success
  1  Error (missing file, invalid mock/JSON, unknown locale/kind/level, usage)

EXAMPLES
  mockifyer-generate variants ./mock.json --level wild --seed 42 --dry-run
  mockifyer-generate variants ./mock.json --out ./mock-data --scenario-prefix trip
  mockifyer-generate sample --context 'swedish users, 5 items' --seed 7
  mockifyer-generate sample --context '10 orders, 3 items each, prices in EUR' --seed 7
  mockifyer-generate sample ./user.json --count 5 --locale sv --out users.json
`;
}

function printHelp(io: CliIo): void {
  io.stdout.write(`${helpText()}\n`);
}

function summarizeVariants(named: NamedVariant[]): string {
  const lines = [
    `Generated ${named.length} variant(s):`,
    ...named.map(
      (v) =>
        `  - ${v.name} (kind=${v.kind}, scenario=${v.mock.scenario ?? '?'}, status=${v.mock.response.status})`
    ),
  ];
  return `${lines.join('\n')}\n`;
}

async function runVariants(
  positionals: string[],
  flags: Map<string, string | true>,
  io: CliIo
): Promise<void> {
  const mockPath = positionals[0];
  if (!mockPath) {
    throw new CliError(
      'variants requires a mock file path.\nUsage: mockifyer-generate variants <mock.json> [options]'
    );
  }
  if (positionals.length > 1) {
    throw new CliError(`Unexpected arguments: ${positionals.slice(1).join(' ')}`);
  }

  const sample = readJsonFile(mockPath);
  if (!isMockDataLike(sample)) {
    throw new CliError(
      `Not a Mockifyer mock file (expected request.method, request.url, response.status): ${path.resolve(mockPath)}`
    );
  }

  const chaosLevel = parseChaosLevel(flagString(flags, 'level'));
  const kinds = parseKinds(flagString(flags, 'kinds'));
  const seed = parseSeed(flagString(flags, 'seed'));
  const scenarioPrefix =
    flagString(flags, 'scenario-prefix') ?? flagString(flags, 'scenario') ?? 'generated';
  const dryRun = flagBool(flags, 'dry-run');
  const scrambleIds = flagBool(flags, 'scramble-ids') ? true : undefined;
  const outDir = flagString(flags, 'out') ?? './mock-data';

  const named = variants(sample, {
    seed,
    chaosLevel,
    kinds,
    scenario: scenarioPrefix,
    ...(scrambleIds !== undefined ? { scrambleIds } : {}),
  });

  if (dryRun) {
    io.stdout.write(summarizeVariants(named));
    io.stdout.write(`${JSON.stringify(named, null, 2)}\n`);
    return;
  }

  const written = writeVariantScenarios(named, { mockDataPath: path.resolve(outDir) });
  io.stdout.write(summarizeVariants(named));
  io.stdout.write(`Wrote ${written.length} file(s) under ${path.resolve(outDir)}:\n`);
  for (const item of written) {
    io.stdout.write(`  ${item.filePath}\n`);
  }
}

async function runSample(
  positionals: string[],
  flags: Map<string, string | true>,
  io: CliIo
): Promise<void> {
  if (positionals.length > 1) {
    throw new CliError(`Unexpected arguments: ${positionals.slice(1).join(' ')}`);
  }

  const samplePath = positionals[0];
  const context = flagString(flags, 'context');
  const localeRaw = flagString(flags, 'locale');
  const seed = parseSeed(flagString(flags, 'seed'));
  const countRaw = flagString(flags, 'count');
  const outFile = flagString(flags, 'out');

  if (!samplePath && (context === undefined || context.trim() === '')) {
    throw new CliError(
      "sample requires a JSON sample file and/or --context.\nUsage: mockifyer-generate sample [sample.json] [--context '...'] [options]"
    );
  }

  let locale: string | undefined;
  if (localeRaw !== undefined) {
    const resolved = tryResolveLocale(localeRaw);
    if (!resolved) {
      throw new CliError(
        `Unknown locale "${localeRaw}". Supported: en, sv, de, fr, es (and aliases like swedish, german).`
      );
    }
    locale = resolved;
  }

  const parsed = context ? parseContext(context) : {};
  const sample = samplePath
    ? readJsonFile(samplePath)
    : defaultSampleForEntity(parsed.entity);
  const count = countRaw !== undefined ? parseCount(countRaw, 1) : undefined;

  const records = await generateAsync(sample, {
    seed,
    context,
    locale,
    ...(count !== undefined ? { count } : {}),
  });

  const json = `${JSON.stringify(records, null, 2)}\n`;
  if (outFile) {
    writeTextFile(outFile, json);
    io.stdout.write(`Wrote ${records.length} record(s) to ${path.resolve(outFile)}\n`);
  } else {
    io.stdout.write(json);
  }
}

/**
 * Run the CLI with the given argv (without node/script path).
 * @returns process exit code
 */
export async function runCli(
  argv: string[],
  io: CliIo = defaultIo
): Promise<number> {
  try {
    const { flags, positionals } = parseArgv(argv);

    if (flagBool(flags, 'help') || positionals[0] === 'help') {
      printHelp(io);
      return EXIT_OK;
    }

    const command = positionals[0];
    if (!command) {
      printHelp(io);
      return EXIT_OK;
    }

    const rest = positionals.slice(1);

    if (command === 'variants') {
      await runVariants(rest, flags, io);
      return EXIT_OK;
    }

    if (command === 'sample') {
      await runSample(rest, flags, io);
      return EXIT_OK;
    }

    throw new CliError(
      `Unknown command "${command}".\nRun mockifyer-generate --help for usage.`
    );
  } catch (err) {
    if (err instanceof CliError) {
      io.stderr.write(`Error: ${err.message}\n`);
      return err.exitCode;
    }
    const message = err instanceof Error ? err.message : String(err);
    io.stderr.write(`Error: ${message}\n`);
    return EXIT_ERROR;
  }
}

async function main(): Promise<void> {
  const code = await runCli(process.argv.slice(2));
  process.exit(code);
}

if (require.main === module) {
  void main();
}
