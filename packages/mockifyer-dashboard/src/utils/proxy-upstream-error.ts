const MAX_CAUSE_DEPTH = 6;

interface SocketLocation {
  remoteAddress?: string;
  remotePort?: number;
}

interface ErrorWithUndiciFields {
  code?: string;
  cause?: unknown;
  socket?: SocketLocation;
  address?: string;
  port?: number;
}

function asErrorFields(value: unknown): ErrorWithUndiciFields | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  return value as ErrorWithUndiciFields;
}

function ownErrorCode(value: unknown): string | undefined {
  const fields = asErrorFields(value);
  return typeof fields?.code === 'string' && fields.code ? fields.code : undefined;
}

function socketLocation(value: unknown): string | undefined {
  const fields = asErrorFields(value);
  const socket = fields?.socket;
  if (socket?.remoteAddress && socket?.remotePort) {
    return `${socket.remoteAddress}:${socket.remotePort}`;
  }
  if (typeof fields?.address === 'string' && typeof fields?.port === 'number') {
    return `${fields.address}:${fields.port}`;
  }
  return undefined;
}

function errorMessageOf(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  if (value && typeof value === 'object' && 'message' in value) {
    const message = (value as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }
  return undefined;
}

/**
 * Flatten Undici's `TypeError: fetch failed` + `error.cause` into a single string.
 * Node's fetch message is always "fetch failed"; the useful code/host lives on `cause`.
 * Does not require `instanceof Error` — Undici SocketError can fail that check across copies.
 */
export function formatProxyFailureDetails(error: unknown): string {
  const chunks: string[] = [];
  let current: unknown = error;
  const seen = new Set<unknown>();

  while (current && !seen.has(current) && chunks.length < MAX_CAUSE_DEPTH) {
    seen.add(current);
    const message = errorMessageOf(current);
    const code = ownErrorCode(current);
    if (message) {
      const text = code && !message.includes(code) ? `${message} (${code})` : message;
      if (!chunks.includes(text)) {
        chunks.push(text);
      }
    } else if (code && !chunks.includes(code)) {
      chunks.push(code);
    }
    const where = socketLocation(current);
    if (where) {
      const at = `at ${where}`;
      if (!chunks.includes(at)) {
        chunks.push(at);
      }
    }
    const nested = asErrorFields(current)?.cause;
    if (nested && nested !== current) {
      current = nested;
      continue;
    }
    if (!message && !code && !where) {
      chunks.push(String(current));
    }
    break;
  }

  return chunks.length > 0 ? chunks.join(': ') : 'Unknown proxy error';
}

/**
 * Throw a new Error whose `.message` already includes the Undici cause and URL,
 * so a catch that only reads `error.message` never reports a bare "fetch failed".
 */
export function wrapProxyUpstreamFetchError(
  method: string | undefined,
  url: string,
  error: unknown
): Error {
  const details = formatProxyFailureDetails(error);
  const verb = method && method.trim() ? method.trim().toUpperCase() : 'GET';
  const prefix = `${verb} ${url}`;
  if (error instanceof Error && error.message.startsWith(`${prefix}:`)) {
    return error;
  }
  if (details.startsWith(`${prefix}:`)) {
    const already = error instanceof Error ? error : new Error(details);
    (already as { cause?: unknown }).cause = (already as { cause?: unknown }).cause ?? error;
    return already;
  }
  const wrapped = new Error(`${prefix}: ${details}`);
  (wrapped as { cause?: unknown }).cause = error;
  return wrapped;
}
