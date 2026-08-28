/** Coarse JSON value kinds for shape fingerprints and soft anomaly detection. */
export type ResponseShapeKind =
  | 'null'
  | 'undefined'
  | 'boolean'
  | 'number'
  | 'string'
  | 'array'
  | 'object'
  | 'empty-array'
  | 'unknown';

export interface ResponseShapeNode {
  kind: ResponseShapeKind;
  keys?: string[];
  itemKind?: ResponseShapeKind;
  length?: number;
}

const MAX_SHAPE_DEPTH = 4;
const MAX_SHAPE_KEYS = 24;

function kindOf(value: unknown, depth: number): ResponseShapeKind {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) {
    return value.length === 0 ? 'empty-array' : 'array';
  }
  switch (typeof value) {
    case 'boolean':
      return 'boolean';
    case 'number':
      return 'number';
    case 'string':
      return 'string';
    case 'object':
      return depth >= MAX_SHAPE_DEPTH ? 'object' : 'object';
    default:
      return 'unknown';
  }
}

/** Builds a compact, stable shape summary for network forensics (not a JSON Schema). */
export function summarizeResponseShape(value: unknown, depth = 0): ResponseShapeNode {
  const kind = kindOf(value, depth);

  if (kind === 'array' && Array.isArray(value)) {
    const first = value[0];
    return {
      kind,
      length: value.length,
      itemKind: value.length === 0 ? 'empty-array' : kindOf(first, depth + 1),
    };
  }

  if (kind === 'object' && value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort().slice(0, MAX_SHAPE_KEYS);
    return { kind, keys };
  }

  return { kind };
}

/** Stable string fingerprint for comparing response shapes across hops. */
export function responseShapeFingerprint(value: unknown): string {
  try {
    return JSON.stringify(summarizeResponseShape(value));
  } catch {
    return '{"kind":"unknown"}';
  }
}

export type ResponseAnomalyFlag =
  | 'http_error_status'
  | 'graphql_errors'
  | 'null_body'
  | 'empty_array_body'
  | 'slow_response'
  | 'mock_miss'
  | 'network_error';

export interface ResponseAnomalyInput {
  status?: number;
  source?: string;
  durationMs?: number;
  responseBody?: unknown;
  slowThresholdMs?: number;
}

const DEFAULT_SLOW_MS = 3_000;

function hasGraphqlErrors(body: unknown): boolean {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return false;
  }
  const errors = (body as { errors?: unknown }).errors;
  return Array.isArray(errors) && errors.length > 0;
}

/** Heuristic flags for “HTTP OK but suspicious” and hard failures — evidence, not root-cause guesses. */
export function detectResponseAnomalies(input: ResponseAnomalyInput): ResponseAnomalyFlag[] {
  const flags: ResponseAnomalyFlag[] = [];
  const slowThreshold = input.slowThresholdMs ?? DEFAULT_SLOW_MS;

  if (input.source === 'mock-miss') {
    flags.push('mock_miss');
  }
  if (input.source === 'error') {
    flags.push('network_error');
  }
  if (typeof input.status === 'number' && input.status >= 400) {
    flags.push('http_error_status');
  }
  if (typeof input.durationMs === 'number' && input.durationMs >= slowThreshold) {
    flags.push('slow_response');
  }

  const body = input.responseBody;
  if (input.responseBody !== undefined) {
    if (body === null) {
      flags.push('null_body');
    } else if (Array.isArray(body) && body.length === 0) {
      flags.push('empty_array_body');
    } else if (hasGraphqlErrors(body)) {
      flags.push('graphql_errors');
    }
  }

  return flags;
}
