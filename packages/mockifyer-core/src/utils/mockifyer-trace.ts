import {
  MOCKIFYER_PARENT_REQUEST_ID_HEADER,
  MOCKIFYER_REQUEST_ID_HEADER,
} from './request-correlation';

/** Runtime trace ids for dashboard `/api/network-events/trace` lookup — never part of API payloads. */
export interface MockifyerTraceMeta {
  requestId: string;
  parentRequestId?: string;
}

function headerValue(headers: Record<string, string> | undefined, name: string): string | undefined {
  if (!headers) {
    return undefined;
  }
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower && value != null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return undefined;
}

/** Reads trace ids from HTTP response headers (`X-Mockifyer-Request-Id`, parent). */
export function resolveMockifyerTraceFromHeaders(
  headers: Record<string, string> | undefined
): MockifyerTraceMeta | undefined {
  const requestId = headerValue(headers, MOCKIFYER_REQUEST_ID_HEADER);
  if (!requestId) {
    return undefined;
  }
  const parentRequestId = headerValue(headers, MOCKIFYER_PARENT_REQUEST_ID_HEADER);
  return parentRequestId ? { requestId, parentRequestId } : { requestId };
}

/** Peels trace ids from dashboard `/api/proxy` JSON (top-level fields + outer response headers). */
export function resolveMockifyerTraceFromProxyPayload(
  payload: Record<string, unknown>,
  outerProxyHeaders?: Record<string, string>,
  upstreamResponseHeaders?: Record<string, string>
): MockifyerTraceMeta | undefined {
  const payloadRequestId =
    typeof payload.requestId === 'string' && payload.requestId.trim()
      ? payload.requestId.trim()
      : undefined;
  const payloadParentRequestId =
    typeof payload.parentRequestId === 'string' && payload.parentRequestId.trim()
      ? payload.parentRequestId.trim()
      : undefined;

  const mergedHeaders = { ...upstreamResponseHeaders, ...outerProxyHeaders };
  const fromHeaders = resolveMockifyerTraceFromHeaders(mergedHeaders);

  const requestId = payloadRequestId ?? fromHeaders?.requestId;
  if (!requestId) {
    return undefined;
  }

  const parentRequestId = payloadParentRequestId ?? fromHeaders?.parentRequestId;
  return parentRequestId ? { requestId, parentRequestId } : { requestId };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isGraphqlEnvelope(body: Record<string, unknown>): boolean {
  return 'data' in body && ('errors' in body || 'extensions' in body);
}

/** `{ data, mockifyerTrace }` with trace ids only (not inline hop list envelopes). */
function isSimpleTraceIdEnvelope(body: Record<string, unknown>): boolean {
  const keys = Object.keys(body);
  if (
    keys.length === 0 ||
    !keys.every((key) => key === 'data' || key === 'mockifyerTrace') ||
    !('data' in body) ||
    !('mockifyerTrace' in body)
  ) {
    return false;
  }
  const trace = body.mockifyerTrace;
  if (!isPlainObject(trace)) {
    return false;
  }
  // Full inline-trace envelopes carry hops[] — leave those to unwrapAndMergeInlineTraceEnvelope.
  return !Array.isArray(trace.hops);
}

/**
 * Removes accidental trace metadata from parsed bodies before returning to app code or persisting mocks.
 * Does not wrap or reshape valid API payloads.
 */
export function stripMockifyerTraceFromBody<T>(body: T): T {
  if (!isPlainObject(body)) {
    return body;
  }

  if (isSimpleTraceIdEnvelope(body)) {
    return stripMockifyerTraceFromBody(body.data) as T;
  }

  if (isGraphqlEnvelope(body)) {
    const extensions = body.extensions;
    if (!isPlainObject(extensions) || !('mockifyerTrace' in extensions)) {
      return body as T;
    }
    const { mockifyerTrace: _removed, ...restExtensions } = extensions;
    const next: Record<string, unknown> = { ...body };
    if (Object.keys(restExtensions).length > 0) {
      next.extensions = restExtensions;
    } else {
      delete next.extensions;
    }
    return next as T;
  }

  if (!('mockifyerTrace' in body)) {
    return body as T;
  }

  const traceField = body.mockifyerTrace;
  if (isPlainObject(traceField) && Array.isArray(traceField.hops)) {
    // Inline-trace envelope — only unwrapAndMergeInlineTraceEnvelope mutates this.
    return body as T;
  }

  const { mockifyerTrace: _removed, ...rest } = body;
  return rest as T;
}
