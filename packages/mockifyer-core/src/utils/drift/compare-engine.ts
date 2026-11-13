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
    issues.push({
      path: path || 'body',
      type: 'type_change',
      severity: 'breaking',
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

    if (expectedArr.length > 0 && actualArr.length > 0) {
      // Compare shape of first elements as representative samples
      const fieldPath = path ? `${path}[0]` : '[0]';
      const arrayIssues = compareJSONShapes(
        expectedArr[0],
        actualArr[0],
        fieldPath,
        ignorePaths
      );
      issues.push(...arrayIssues);
    } else if (expectedArr.length > 0 && actualArr.length === 0) {
      // Array went from non-empty to empty (potential issue but warning only)
      issues.push({
        path: path || 'array',
        type: 'type_change',
        severity: 'warning',
        expected: `array[${expectedArr.length}]`,
        actual: 'array[0]',
        message: `Array became empty${path ? ` at ${path}` : ''}`,
      });
    }
  }

  return issues;
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
 */
function shouldIgnorePath(path: string, ignorePaths: string[]): boolean {
  if (!path) {
    return false;
  }

  for (const ignorePath of ignorePaths) {
    // Exact match
    if (path === ignorePath) {
      return true;
    }
    // Prefix match (e.g., 'data.meta' ignores 'data.meta.timestamp')
    if (path.startsWith(ignorePath + '.') || path.startsWith(ignorePath + '[')) {
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
