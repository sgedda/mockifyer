import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { getAllJsonFiles } from './json-files';

const execFileAsync = promisify(execFile);

/** Skip ripgrep spawn when a Node scan is cheaper. */
const RIPGREP_MIN_FILES = 48;
/** Ignore 1–2 character tokens for rg; they match almost every JSON file. */
const RIPGREP_MIN_TOKEN_LENGTH = 3;
const FS_READ_CONCURRENCY = 16;

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Split a free-text query into AND tokens.
 * Quoted segments (`"exact phrase"`) stay as one substring; other text splits on whitespace.
 */
export function parseSearchQuery(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const tokens: string[] = [];
  const re = /"([^"]+)"|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(trimmed)) !== null) {
    const token = (match[1] ?? match[2] ?? '').trim();
    if (token) tokens.push(token);
  }
  return tokens;
}

export function compileSearchToken(token: string): (haystack: string) => boolean {
  const re = new RegExp(escapeRegExp(token), 'i');
  return (haystack: string) => re.test(haystack);
}

/**
 * After ripgrep finds files whose *contents* contain `token`, keep disk candidates that
 * either were in that set **or** already have `token` in the relative path.
 * Otherwise a query like `GetBookingDetails xyz` misses `POST_GetBookingDetails.json`
 * when the operation name is only in the filename.
 */
export function retainCandidatesForToken(params: {
  needContent: string[];
  scenarioPath: string;
  token: string;
  contentHits: string[];
}): string[] {
  const tokenIn = compileSearchToken(params.token);
  const contentSet = new Set(params.contentHits.map((filePath) => path.resolve(filePath)));
  return params.needContent.filter((filePath) => {
    if (contentSet.has(path.resolve(filePath))) return true;
    return tokenIn(path.relative(params.scenarioPath, filePath));
  });
}

/**
 * Match when every token appears in the filename **or** the raw JSON (case-insensitive).
 * Filename hits short-circuit so large response bodies are not scanned.
 */
export function compileMockSearch(
  tokens: string[]
): (filename: string, raw: string) => boolean {
  const matchers = tokens.map(compileSearchToken);
  return (filename: string, raw: string) =>
    matchers.every((matches) => matches(filename) || matches(raw));
}

export interface DiskSearchHit {
  filePath: string;
  relativeName: string;
  raw: string;
}

export interface DiskSearchResult {
  hits: DiskSearchHit[];
  truncated: boolean;
}

async function tryRipgrepContentMatches(dir: string, token: string): Promise<string[] | null> {
  try {
    const { stdout } = await execFileAsync(
      'rg',
      [
        '-l',
        '-i',
        '-F',
        '--no-messages',
        '--glob',
        '*.json',
        '--glob',
        '!override-sets/**',
        '--glob',
        '!pool/**',
        '--glob',
        '!scenario-meta.json',
        '--glob',
        '!favorites.json',
        '--',
        token,
        dir,
      ],
      { timeout: 8_000, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' }
    );
    return String(stdout)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((filePath) => path.resolve(filePath));
  } catch (error: unknown) {
    const err = error as { code?: string | number };
    // rg exits 1 when there are no matches.
    if (err.code === 1) return [];
    return null;
  }
}

/**
 * Search mock JSON files under a scenario folder.
 * Path/filename matches are preferred; remaining files are narrowed with ripgrep when available,
 * then verified with a concurrent Node read (parse happens in the caller).
 */
export async function searchJsonFilesOnDisk(
  scenarioPath: string,
  tokens: string[],
  limit: number
): Promise<DiskSearchResult> {
  if (tokens.length === 0 || limit <= 0) {
    return { hits: [], truncated: false };
  }
  const matches = compileMockSearch(tokens);
  const all = getAllJsonFiles(scenarioPath);
  const pathHits: string[] = [];
  const needContent: string[] = [];

  for (const filePath of all) {
    const relativeName = path.relative(scenarioPath, filePath);
    if (matches(relativeName, '')) {
      pathHits.push(filePath);
    } else {
      needContent.push(filePath);
    }
  }

  const hits: DiskSearchHit[] = [];
  let truncated = pathHits.length > limit;

  for (const filePath of pathHits.slice(0, limit)) {
    let raw: string;
    try {
      raw = await fs.readFile(filePath, 'utf-8');
    } catch {
      continue;
    }
    hits.push({
      filePath,
      relativeName: path.relative(scenarioPath, filePath),
      raw,
    });
  }

  if (hits.length >= limit) {
    return { hits: hits.slice(0, limit), truncated: true };
  }

  let contentCandidates = needContent;
  const longest = tokens.reduce((best, token) => (token.length > best.length ? token : best), '');
  if (
    contentCandidates.length >= RIPGREP_MIN_FILES &&
    longest.length >= RIPGREP_MIN_TOKEN_LENGTH
  ) {
    const rgHits = await tryRipgrepContentMatches(scenarioPath, longest);
    if (rgHits) {
      contentCandidates = retainCandidatesForToken({
        needContent,
        scenarioPath,
        token: longest,
        contentHits: rgHits,
      });
    }
  }

  let next = 0;
  let stop = false;
  const workerCount = Math.min(FS_READ_CONCURRENCY, contentCandidates.length);

  async function worker(): Promise<void> {
    while (!stop) {
      const index = next;
      next += 1;
      if (index >= contentCandidates.length) return;
      const filePath = contentCandidates[index];
      let raw: string;
      try {
        raw = await fs.readFile(filePath, 'utf-8');
      } catch {
        continue;
      }
      const relativeName = path.relative(scenarioPath, filePath);
      if (!matches(relativeName, raw)) continue;
      if (hits.length >= limit) {
        truncated = true;
        stop = true;
        return;
      }
      hits.push({ filePath, relativeName, raw });
      if (hits.length >= limit) {
        truncated = true;
        stop = true;
        return;
      }
    }
  }

  if (workerCount > 0) {
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
  }

  if (hits.length > limit) {
    truncated = true;
    hits.length = limit;
  } else if (!truncated && stop && next < contentCandidates.length) {
    truncated = true;
  }

  return { hits, truncated };
}
