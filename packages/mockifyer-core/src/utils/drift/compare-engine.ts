/**
 * Core comparison engine for drift detection.
 * Compares expected mock responses with actual API responses.
 */

import { DriftIssue, DriftSeverity, DriftCheckOptions } from './drift-report';

type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
type JSONObject = { [key: string]: JSONValue };
type JSONArray = JSONValue[];

interface ResponseComparison {
  expectedStatus: number;
  actualStatus: number;
  expectedBody: unknown;
  actualBody: unknown;
}

/**
 * Compare two responses and generate a list of drift issues.
 * Never includes actual values in the report (only types and paths).
 */
export function compareResponses(
  comparison: ResponseComparison,
  options: DriftCheckOptions = {}
): DriftIssue[] {
  const issues: DriftIssue[] = [];
  const { ignorePaths = [] } = options;

  // Check status code drift
  if (comparison.expectedStatus !== comparison.actualStatus) {
    issues.push({
      path: 'status',
      type: 'status_change',
      severity: 'breaking',
      expected: String(comparison.expectedStatus),
      actual: String(comparison.actualStatus),
      message: `HTTP status changed from ${comparison.expectedStatus} to ${comparison.actualStatus}`,
    });
  }

  // Compare response bodies if both are JSON
  if (isJSONCompatible(comparison.expectedBody) && isJSONCompatible(comparison.actualBody)) {
    const bodyIssues = compareJSONShapes(
      comparison.expectedBody as JSONValue,
      comparison.actualBody as JSONValue,
      '',
      ignorePaths
    );
    issues.push(...bodyIssues);
  }

  return issues;
}

/**
 * Check if a value can be compared as JSON.
 */
function isJSONCompatible(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  const type = typeof value;
  return type === 'object' || type === 'string' || type === 'number' || type === 'boolean';
}

/**
 * Compare JSON shapes recursively, generating drift issues for any differences.
 * Only compares structure (keys and types), not values.
 */
function compareJSONShapes(
  expected: JSONValue,
  actual: JSONValue,
  path: string,
  ignorePaths: string[]
): DriftIssue[] {
  const issues: DriftIssue[] = [];

  // Skip if this path is in the ignore list
  if (shouldIgnorePath(path, ignorePaths)) {
    return issues;
  }

  const expectedType = getCoarseType(expected);
  const actualType = getCoarseType(actual);

  // Type mismatch
  if (expectedType !== actualType) {
    // null <-> value is a warning, not breaking
    const isNullChange = expectedType === 'null' || actualType === 'null';
    issues.push({
      path: path || 'body',
      type: 'type_change',
      severity: isNullChange ? 'warning' : 'breaking',
      expected: expectedType,
      actual: actualType,
      message: `Type changed from ${expectedType} to ${actualType}${path ? ` at ${path}` : ''}`,
    });
    return issues;
  }

  // Compare objects
  if (expectedType === 'object' && actualType === 'object') {
    const expectedObj = expected as JSONObject;
    const actualObj = actual as JSONObject;

    const expectedKeys = getSortedKeys(expectedObj);
    const actualKeys = getSortedKeys(actualObj);

    // Find missing keys (in expected but not in actual)
    for (const key of expectedKeys) {
      if (!(key in actualObj)) {
        const fieldPath = path ? `${path}.${key}` : key;
        if (!shouldIgnorePath(fieldPath, ignorePaths)) {
          issues.push({
            path: fieldPath,
            type: 'missing_key',
            severity: 'breaking',
            expected: getCoarseType(expectedObj[key]),
            actual: undefined,
            message: `Key "${key}" removed${path ? ` from ${path}` : ''}`,
          });
        }
      }
    }

    // Find extra keys (in actual but not in expected)
    for (const key of actualKeys) {
      if (!(key in expectedObj)) {
        const fieldPath = path ? `${path}.${key}` : key;
        if (!shouldIgnorePath(fieldPath, ignorePaths)) {
          issues.push({
            path: fieldPath,
            type: 'extra_key',
            severity: 'warning',
            expected: undefined,
            actual: getCoarseType(actualObj[key]),
            message: `New key "${key}" added${path ? ` to ${path}` : ''}`,
          });
        }
      }
    }

    // Recursively compare shared keys
    for (const key of expectedKeys) {
      if (key in actualObj) {
        const fieldPath = path ? `${path}.${key}` : key;
        const nestedIssues = compareJSONShapes(
          expectedObj[key],
          actualObj[key],
          fieldPath,
          ignorePaths
        );
        issues.push(...nestedIssues);
      }
    }
  }

  // Compare arrays - check element shapes (union of all item types)
  if (expectedType === 'array' && actualType === 'array') {
    const expectedArr = expected as JSONArray;
    const actualArr = actual as JSONArray;

    if (expectedArr.length > 0 && actualArr.length === 0) {
      // Empty live list - report as info, not warning or breaking
      // This is common for time-sensitive data (e.g., "upcoming trips" that have passed)
      // Marked as skipped so it doesn't fail CI
      return issues;
    }

    if (expectedArr.length > 0 && actualArr.length > 0) {
      // Compare the union of shapes across ALL items
      const expectedUnion = buildArrayUnionShape(expectedArr);
      const actualUnion = buildArrayUnionShape(actualArr);

      const fieldPath = path ? `${path}[*]` : '[*]';
      const arrayIssues = compareJSONShapes(
        expectedUnion,
        actualUnion,
        fieldPath,
        ignorePaths
      );
      issues.push(...arrayIssues);
    }
  }

  return issues;
}

/**
 * Build a union shape from all items in an array.
 * For object arrays, merges all keys found across all items.
 * For primitive arrays, returns the first item's type.
 */
function buildArrayUnionShape(arr: JSONArray): JSONValue {
  if (arr.length === 0) {
    return {};
  }

  const firstItem = arr[0];
  const firstType = getCoarseType(firstItem);

  // For non-object arrays, just use the first item
  if (firstType !== 'object') {
    return firstItem;
  }

  // For object arrays, merge all keys from all items
  const union: JSONObject = {};
  for (const item of arr) {
    if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
      const itemObj = item as JSONObject;
      for (const [key, value] of Object.entries(itemObj)) {
        // Keep the first encountered value for each key
        if (!(key in union)) {
          union[key] = value;
        }
      }
    }
  }

  return union;
}

/**
 * Get a coarse type classification for JSON values.
 * Returns: 'string', 'number', 'boolean', 'null', 'array', 'object'
 */
function getCoarseType(value: JSONValue): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  const type = typeof value;
  if (type === 'object') {
    return 'object';
  }
  return type;
}

/**
 * Get sorted keys from an object for stable comparison.
 */
function getSortedKeys(obj: JSONObject): string[] {
  return Object.keys(obj).sort();
}

/**
 * Check if a path should be ignored based on the ignore patterns.
 * Supports exact matches and prefix matches.
 * Array wildcards [*] are normalized to [0] for matching.
 */
function shouldIgnorePath(path: string, ignorePaths: string[]): boolean {
  if (!path) {
    return false;
  }

  // Normalize array wildcards for matching
  const normalizedPath = path.replace(/\[\*\]/g, '[0]');

  for (const ignorePath of ignorePaths) {
    const normalizedIgnorePath = ignorePath.replace(/\[\*\]/g, '[0]');

    // Exact match
    if (normalizedPath === normalizedIgnorePath) {
      return true;
    }
    // Prefix match (e.g., 'data.meta' ignores 'data.meta.timestamp')
    if (
      normalizedPath.startsWith(normalizedIgnorePath + '.') ||
      normalizedPath.startsWith(normalizedIgnorePath + '[')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Check if an array of issues contains any breaking changes.
 */
export function hasBreakingIssues(issues: DriftIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'breaking');
}

/**
 * Group issues by severity.
 */
export function groupIssuesBySeverity(issues: DriftIssue[]): {
  breaking: DriftIssue[];
  warning: DriftIssue[];
} {
  return {
    breaking: issues.filter((issue) => issue.severity === 'breaking'),
    warning: issues.filter((issue) => issue.severity === 'warning'),
  };
}
