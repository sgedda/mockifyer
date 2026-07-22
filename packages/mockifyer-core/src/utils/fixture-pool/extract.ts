import { parseResponseDataPath } from '../mock-response-date-overrides';

/**
 * Read a value at a dot path (supports numeric array indices).
 */
export function getValueAtJsonPath(root: unknown, jsonPath: string): unknown {
  const segments = parseResponseDataPath(jsonPath.trim());
  if (segments.length === 0) return root;
  let cur: unknown = root;
  for (const s of segments) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string | number, unknown>)[s as string | number];
  }
  return cur;
}

export interface ExtractEntityResult {
  data: unknown;
  jsonPath: string;
}

/**
 * Extract one value from mock response.data at jsonPath.
 */
export function extractEntityDataFromResponse(
  responseData: unknown,
  jsonPath: string
): ExtractEntityResult | { error: string } {
  const path = jsonPath.trim();
  if (!path) return { error: 'jsonPath is required' };
  const value = getValueAtJsonPath(responseData, path);
  if (value === undefined || value === null) {
    return { error: `No value at jsonPath "${path}"` };
  }
  return { data: deepCloneJson(value), jsonPath: path };
}

/**
 * Extract every element of an array at jsonPath into separate entity payloads.
 */
export function extractAllArrayItemsFromResponse(
  responseData: unknown,
  arrayJsonPath: string
): ExtractEntityResult[] | { error: string } {
  const path = arrayJsonPath.trim();
  if (!path) return { error: 'jsonPath is required' };
  const value = getValueAtJsonPath(responseData, path);
  if (!Array.isArray(value)) {
    return { error: `Value at "${path}" is not an array` };
  }
  return value.map((item, index) => ({
    data: deepCloneJson(item),
    jsonPath: `${path}.${index}`,
  }));
}

function deepCloneJson<T>(data: T): T {
  if (data === undefined) return data;
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(data);
    } catch {
      // fall through
    }
  }
  return JSON.parse(JSON.stringify(data)) as T;
}

export { deepCloneJson as cloneJsonValue };
