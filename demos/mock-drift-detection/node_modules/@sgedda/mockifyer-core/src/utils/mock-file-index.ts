import type { StoredRequest } from '../types';
import { generateRequestKey } from './mock-matcher';

interface MockFileIndexEntry {
  requestKey: string;
  pathMethodKey?: string;
}

/** `METHOD pathname` used by similar matching; undefined when the URL cannot be parsed. */
export function mockPathMethodKey(request: Pick<StoredRequest, 'method' | 'url'>): string | undefined {
  try {
    const pathname = new URL(request.url).pathname;
    return `${(request.method || 'GET').toUpperCase()} ${pathname}`;
  } catch {
    return undefined;
  }
}

function addToBucket(buckets: Map<string, Set<string>>, key: string, file: string): void {
  const bucket = buckets.get(key) ?? new Set<string>();
  bucket.add(file);
  buckets.set(key, bucket);
}

function removeFromBucket(buckets: Map<string, Set<string>>, key: string, file: string): void {
  const bucket = buckets.get(key);
  if (!bucket) return;
  bucket.delete(file);
  if (bucket.size === 0) buckets.delete(key);
}

/**
 * In-memory lookup of mock files in one scenario folder by request key and by
 * `METHOD pathname`. Holds file names only; callers re-read candidates from disk,
 * so a stale entry costs one extra read instead of serving a wrong mock.
 */
export class MockFileIndex {
  private readonly byFile = new Map<string, MockFileIndexEntry>();
  private readonly byRequestKey = new Map<string, Set<string>>();
  private readonly byPathMethod = new Map<string, Set<string>>();

  constructor(readonly scenarioPath: string) {}

  /** Index (or re-index) `file` under the keys derived from its stored request. */
  upsert(file: string, request: StoredRequest): void {
    this.remove(file);
    const entry: MockFileIndexEntry = {
      requestKey: generateRequestKey(request),
      pathMethodKey: mockPathMethodKey(request),
    };
    this.byFile.set(file, entry);
    addToBucket(this.byRequestKey, entry.requestKey, file);
    if (entry.pathMethodKey) addToBucket(this.byPathMethod, entry.pathMethodKey, file);
  }

  remove(file: string): void {
    const entry = this.byFile.get(file);
    if (!entry) return;
    this.byFile.delete(file);
    removeFromBucket(this.byRequestKey, entry.requestKey, file);
    if (entry.pathMethodKey) removeFromBucket(this.byPathMethod, entry.pathMethodKey, file);
  }

  filesForRequestKey(requestKey: string): string[] {
    return [...(this.byRequestKey.get(requestKey) ?? [])];
  }

  filesForPathMethod(request: Pick<StoredRequest, 'method' | 'url'>): string[] {
    const key = mockPathMethodKey(request);
    return key ? [...(this.byPathMethod.get(key) ?? [])] : [];
  }
}
