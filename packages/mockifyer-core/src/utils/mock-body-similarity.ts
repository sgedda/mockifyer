import { normalizeGraphQLQuery } from './mock-matcher';

/** Sorted-key JSON for stable comparisons (matches request-key variable hashing). */
export function stableStringifyVariables(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'object') return JSON.stringify(value);
  try {
    const sorted = Object.keys(value as object)
      .sort()
      .reduce(
        (acc, key) => {
          (acc as Record<string, unknown>)[key] = (value as Record<string, unknown>)[key];
          return acc;
        },
        {} as Record<string, unknown>
      );
    return JSON.stringify(sorted);
  } catch {
    return String(value);
  }
}

function tryParseUrl(endpoint: string | null | undefined): URL | null {
  if (!endpoint || typeof endpoint !== 'string') return null;
  try {
    return new URL(endpoint);
  } catch {
    return null;
  }
}

/** Host + pathname, lowercased — ignores trailing slash differences. */
export function groupingUrlKey(endpoint: string | null | undefined): string {
  const u = tryParseUrl(endpoint);
  if (!u) return '';
  const path = u.pathname.replace(/\/+$/, '') || '/';
  return `${u.hostname.toLowerCase()}${path.toLowerCase()}`;
}

/**
 * GraphQL-ish tokens: identifiers and literals after normalization.
 * Used for Jaccard similarity (cheap for large documents vs character bigrams).
 */
export function tokenizeGraphqlDocument(normalizedQuery: string): Set<string> {
  const tokens = new Set<string>();
  if (!normalizedQuery) return tokens;
  const parts = normalizedQuery.split(/[^\w.]+/);
  for (const p of parts) {
    if (p.length >= 2 && /^[_A-Za-z]/.test(p)) {
      tokens.add(p);
    }
  }
  return tokens;
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  const smaller = a.size <= b.size ? a : b;
  const larger = a.size <= b.size ? b : a;
  for (const t of smaller) {
    if (larger.has(t)) inter += 1;
  }
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Best-effort operation name: body.operationName or first named operation in the document.
 */
export function inferGraphqlOperationName(
  query: string,
  explicitOperationName?: string | null
): string | undefined {
  if (typeof explicitOperationName === 'string' && explicitOperationName.trim()) {
    return explicitOperationName.trim();
  }
  const m = query.match(/\b(?:query|mutation|subscription)\s+([_A-Za-z][_0-9A-Za-z]*)/);
  return m?.[1];
}

export interface MockListEntryForSimilarity {
  filename: string;
  endpoint: string | null;
  method: string | null;
  graphqlInfo: { query: string; variables: unknown; operationName?: string | null } | null;
}

export interface SimilarMockGroup {
  /** Stable id from sorted member filenames */
  id: string;
  filenames: string[];
  bodyKind: 'graphql';
  /** Minimum pairwise similarity inside the cluster (after merging). */
  minSimilarity: number;
  operationName?: string;
  groupingKey: string;
}

class UnionFind {
  private readonly parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(i: number): number {
    if (this.parent[i] !== i) this.parent[i] = this.find(this.parent[i]);
    return this.parent[i];
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[rb] = ra;
  }
}

function hashIdFromFilenames(filenames: string[]): string {
  const joined = [...filenames].sort().join('\0');
  let h = 0;
  for (let i = 0; i < joined.length; i++) {
    h = (Math.imul(31, h) + joined.charCodeAt(i)) | 0;
  }
  return `sim-${Math.abs(h).toString(36)}`;
}

export interface BuildSimilarMockGroupsOptions {
  /** Jaccard similarity on GraphQL tokens (default 0.88). */
  threshold?: number;
}

/**
 * Groups mocks whose request bodies are highly similar (same route + method + GraphQL op/variables bucket,
 * then Jaccard overlap on query tokens). Useful for spotting near-duplicate GraphQL documents.
 */
export function buildSimilarMockGroups(
  entries: MockListEntryForSimilarity[],
  options?: BuildSimilarMockGroupsOptions
): SimilarMockGroup[] {
  const threshold = options?.threshold ?? 0.88;

  type Prepared = {
    filename: string;
    bucketKey: string;
    bodyKind: 'graphql';
    tokens: Set<string>;
    operationName?: string;
  };

  const prepared: Prepared[] = [];

  for (const e of entries) {
    const method = (e.method || 'GET').toUpperCase();
    const urlKey = groupingUrlKey(e.endpoint);
    if (!urlKey) continue;

    if (e.graphqlInfo?.query && typeof e.graphqlInfo.query === 'string') {
      const norm = normalizeGraphQLQuery(e.graphqlInfo.query);
      if (!norm) continue;
      const op = inferGraphqlOperationName(e.graphqlInfo.query, e.graphqlInfo.operationName);
      const vars = stableStringifyVariables(e.graphqlInfo.variables);
      const bucketKey = `${urlKey}|${method}|gql|${op || '_'}|${vars}`;
      prepared.push({
        filename: e.filename,
        bucketKey,
        bodyKind: 'graphql',
        tokens: tokenizeGraphqlDocument(norm),
        operationName: op,
      });
    }
  }

  const byBucket = new Map<string, Prepared[]>();
  for (const p of prepared) {
    const list = byBucket.get(p.bucketKey);
    if (list) list.push(p);
    else byBucket.set(p.bucketKey, [p]);
  }

  const groups: SimilarMockGroup[] = [];

  for (const [, bucket] of byBucket) {
    if (bucket.length < 2) continue;

    const uf = new UnionFind(bucket.length);
    for (let a = 0; a < bucket.length; a++) {
      for (let b = a + 1; b < bucket.length; b++) {
        const sim = jaccardSimilarity(bucket[a].tokens, bucket[b].tokens);
        if (sim >= threshold) {
          uf.union(a, b);
        }
      }
    }

    const clusters = new Map<number, Prepared[]>();
    for (let i = 0; i < bucket.length; i++) {
      const r = uf.find(i);
      const arr = clusters.get(r);
      if (arr) arr.push(bucket[i]);
      else clusters.set(r, [bucket[i]]);
    }

    for (const members of clusters.values()) {
      if (members.length < 2) continue;

      let minSim = 1;
      for (let a = 0; a < members.length; a++) {
        for (let b = a + 1; b < members.length; b++) {
          const sim = jaccardSimilarity(members[a].tokens, members[b].tokens);
          if (sim < minSim) minSim = sim;
        }
      }

      const filenames = members.map((m) => m.filename).sort();
      const bodyKind = members[0].bodyKind;
      const operationName = members.find((m) => m.operationName)?.operationName;

      groups.push({
        id: hashIdFromFilenames(filenames),
        filenames,
        bodyKind,
        minSimilarity: minSim,
        operationName,
        groupingKey: members[0].bucketKey,
      });
    }
  }

  groups.sort((a, b) => b.filenames.length - a.filenames.length || a.id.localeCompare(b.id));
  return groups;
}
