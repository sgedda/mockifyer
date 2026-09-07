/**
 * HAR 1.2 export from Atlas / network hops — open in Chrome, Proxyman, Charles.
 * @see https://w3c.github.io/web-performance/specs/HAR/Overview.html
 */

import { formatUsageLabel } from './atlas-usage';
import { usageListForHop } from './hop-display';
import type { NetworkEvent } from './network-event-types';

/** Soft cap so HAR files stay openable in browsers. */
const MAX_HAR_BODY_CHARS = 512_000;

export interface HarHeader {
  name: string;
  value: string;
}

export interface HarContent {
  size: number;
  mimeType: string;
  text?: string;
  encoding?: string;
}

export interface HarPostData {
  mimeType: string;
  text?: string;
}

export interface HarRequest {
  method: string;
  url: string;
  httpVersion: string;
  cookies: unknown[];
  headers: HarHeader[];
  queryString: Array<{ name: string; value: string }>;
  headersSize: number;
  bodySize: number;
  postData?: HarPostData;
}

export interface HarResponse {
  status: number;
  statusText: string;
  httpVersion: string;
  cookies: unknown[];
  headers: HarHeader[];
  content: HarContent;
  redirectURL: string;
  headersSize: number;
  bodySize: number;
}

export interface HarTimings {
  send: number;
  wait: number;
  receive: number;
  blocked?: number;
  dns?: number;
  connect?: number;
  ssl?: number;
}

export interface HarEntry {
  startedDateTime: string;
  time: number;
  request: HarRequest;
  response: HarResponse;
  cache: Record<string, unknown>;
  timings: HarTimings;
  serverIPAddress?: string;
  connection?: string;
  comment?: string;
}

export interface HarLog {
  version: string;
  creator: { name: string; version: string; comment?: string };
  pages?: unknown[];
  entries: HarEntry[];
  comment?: string;
}

export interface HarDocument {
  log: HarLog;
}

export interface BuildAtlasHarOptions {
  scenario?: string;
  creatorVersion?: string;
  /** Include incident / non-HTTP rows (default false). */
  includeIncidents?: boolean;
}

function headersToHar(headers?: Record<string, string>): HarHeader[] {
  if (!headers) return [];
  return Object.entries(headers)
    .map(([name, value]) => ({ name, value: String(value ?? '') }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function guessMime(body: string | undefined, headers?: Record<string, string>): string {
  const fromHeader =
    headers?.['content-type'] ||
    headers?.['Content-Type'] ||
    headers?.['CONTENT-TYPE'];
  if (fromHeader?.trim()) return fromHeader.split(';')[0]!.trim();
  if (!body?.trim()) return 'application/octet-stream';
  const t = body.trim();
  if (t.startsWith('{') || t.startsWith('[')) return 'application/json';
  if (t.startsWith('<')) return 'text/html';
  return 'text/plain';
}

function truncateHarBody(text: string | undefined): { text?: string; size: number } {
  if (text == null || text === '') return { size: 0 };
  if (text.length <= MAX_HAR_BODY_CHARS) return { text, size: text.length };
  return {
    text: `${text.slice(0, MAX_HAR_BODY_CHARS)}\n… [truncated ${text.length - MAX_HAR_BODY_CHARS} chars]`,
    size: text.length,
  };
}

function queryStringFromUrl(url: string): Array<{ name: string; value: string }> {
  try {
    const u = new URL(url);
    return [...u.searchParams.entries()].map(([name, value]) => ({ name, value }));
  } catch {
    const q = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
    if (!q) return [];
    return q.split('&').filter(Boolean).map((part) => {
      const eq = part.indexOf('=');
      if (eq < 0) return { name: decodeURIComponent(part), value: '' };
      return {
        name: decodeURIComponent(part.slice(0, eq)),
        value: decodeURIComponent(part.slice(eq + 1)),
      };
    });
  }
}

function statusTextFor(status: number | undefined): string {
  if (status == null || !Number.isFinite(status)) return '';
  const known: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };
  return known[status] ?? '';
}

function entryComment(ev: NetworkEvent): string | undefined {
  const parts: string[] = [];
  if (ev.requestId) parts.push(`requestId=${ev.requestId}`);
  if (ev.parentRequestId) parts.push(`parentRequestId=${ev.parentRequestId}`);
  if (ev.source) parts.push(`source=${ev.source}`);
  if (ev.sessionId) parts.push(`sessionId=${ev.sessionId}`);
  const usedBy = usageListForHop(ev)
    .map(formatUsageLabel)
    .filter(Boolean);
  if (usedBy.length) parts.push(`usedBy=${[...new Set(usedBy)].join(',')}`);
  if (ev.errorMessage) parts.push(`error=${ev.errorMessage}`);
  return parts.length ? parts.join(' · ') : undefined;
}

function isExportableHop(ev: NetworkEvent, includeIncidents: boolean): boolean {
  if (ev.kind === 'incident') return includeIncidents;
  return Boolean(ev.method && (ev.url || ev.path));
}

/** Convert one network hop into a HAR entry. */
export function networkEventToHarEntry(ev: NetworkEvent): HarEntry {
  const url = ev.url || ev.path || '';
  const method = (ev.method || 'GET').toUpperCase();
  const reqBody = truncateHarBody(ev.requestBodyPreview);
  const resBody = truncateHarBody(ev.responseBodyPreview);
  const reqHeaders = headersToHar(ev.requestHeaders);
  const resHeaders = headersToHar(ev.responseHeaders);
  const reqMime = guessMime(ev.requestBodyPreview, ev.requestHeaders);
  const resMime = guessMime(ev.responseBodyPreview, ev.responseHeaders);
  const duration = typeof ev.durationMs === 'number' && ev.durationMs >= 0 ? ev.durationMs : 0;
  const wait = Math.max(0, Math.round(duration * 0.85));
  const receive = Math.max(0, duration - wait);

  const request: HarRequest = {
    method,
    url,
    httpVersion: 'HTTP/1.1',
    cookies: [],
    headers: reqHeaders,
    queryString: queryStringFromUrl(url),
    headersSize: -1,
    bodySize: reqBody.size,
  };
  if (reqBody.text != null && method !== 'GET' && method !== 'HEAD') {
    request.postData = { mimeType: reqMime, text: reqBody.text };
  }

  const status = typeof ev.status === 'number' ? ev.status : 0;
  const response: HarResponse = {
    status,
    statusText: statusTextFor(ev.status),
    httpVersion: 'HTTP/1.1',
    cookies: [],
    headers: resHeaders,
    content: {
      size: resBody.size,
      mimeType: resMime,
      ...(resBody.text != null ? { text: resBody.text } : {}),
    },
    redirectURL: '',
    headersSize: -1,
    bodySize: resBody.size,
  };

  return {
    startedDateTime: ev.timestamp || new Date().toISOString(),
    time: duration,
    request,
    response,
    cache: {},
    timings: {
      send: 0,
      wait,
      receive,
      blocked: -1,
      dns: -1,
      connect: -1,
      ssl: -1,
    },
    comment: entryComment(ev),
  };
}

/** Build a HAR 1.2 document from network events. */
export function buildAtlasHarDocument(
  networkEvents: readonly NetworkEvent[],
  options?: BuildAtlasHarOptions
): HarDocument {
  const includeIncidents = options?.includeIncidents === true;
  const entries = networkEvents
    .filter((ev) => isExportableHop(ev, includeIncidents))
    .slice()
    .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)))
    .map(networkEventToHarEntry);

  const scenario = options?.scenario?.trim() || networkEvents[0]?.scenario || 'default';
  return {
    log: {
      version: '1.2',
      creator: {
        name: 'Mockifyer Atlas',
        version: options?.creatorVersion?.trim() || '1.0.0',
        comment: `scenario=${scenario}`,
      },
      entries,
      comment: `${entries.length} hop(s)`,
    },
  };
}

/** Pretty-printed HAR JSON string. */
export function buildAtlasHarJson(
  networkEvents: readonly NetworkEvent[],
  options?: BuildAtlasHarOptions
): string {
  return `${JSON.stringify(buildAtlasHarDocument(networkEvents, options), null, 2)}\n`;
}
