/**
 * Browser-safe mirror of `@sgedda/mockifyer-generator/node` file naming
 * (`getMockRelativeFile`). Same layout the CLI writes under each scenario
 * folder — no Node `fs` / `crypto` / `Buffer` APIs.
 */

import type { GeneratedMockData } from '@sgedda/mockifyer-generator'
import { sha256Hex } from './sha256'

const RECORDING_IDENTITY_HASH_HEX_LENGTH = 12
const MAX_FILE_NAME_BYTES = 255

function utf8ByteLength(text: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).length
  }
  return Buffer.byteLength(text, 'utf8')
}

function truncateUtf8ToBytes(text: string, maxBytes: number): string {
  if (maxBytes <= 0) return ''
  const bytes =
    typeof TextEncoder !== 'undefined'
      ? new TextEncoder().encode(text)
      : Uint8Array.from(Buffer.from(text, 'utf8'))
  if (bytes.length <= maxBytes) return text
  let end = maxBytes
  while (end > 0 && (bytes[end]! & 0xc0) === 0x80) {
    end -= 1
  }
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder().decode(bytes.subarray(0, end))
  }
  return Buffer.from(bytes.subarray(0, end)).toString('utf8')
}

function clampFsPathSegment(segment: string): string {
  if (utf8ByteLength(segment) <= MAX_FILE_NAME_BYTES) {
    return segment
  }
  const suffix = `_${sha256Hex(segment).slice(0, 10)}`
  const budget = MAX_FILE_NAME_BYTES - utf8ByteLength(suffix)
  return `${truncateUtf8ToBytes(segment, budget)}${suffix}`
}

function clampRecordingFilename(filename: string, uniquenessKey: string): string {
  if (utf8ByteLength(filename) <= MAX_FILE_NAME_BYTES) {
    return filename
  }
  const digest = sha256Hex(uniquenessKey).slice(0, 16)
  const suffix = `_${digest}.json`
  const stem = filename.endsWith('.json') ? filename.slice(0, -'.json'.length) : filename
  const budget = MAX_FILE_NAME_BYTES - utf8ByteLength(suffix)
  if (budget <= 0) {
    const fallback = `${digest}.json`
    return utf8ByteLength(fallback) <= MAX_FILE_NAME_BYTES
      ? fallback
      : digest.slice(0, MAX_FILE_NAME_BYTES)
  }
  return `${truncateUtf8ToBytes(stem, budget)}${suffix}`
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(obj[k])}`).join(',')}}`
}

export function requestIdentityKey(mock: GeneratedMockData): string {
  const method = (mock.request.method || 'GET').toUpperCase()
  let url = (mock.request.url || '').toLowerCase()
  if (
    url.endsWith('?') &&
    (!mock.request.queryParams || Object.keys(mock.request.queryParams).length === 0)
  ) {
    url = url.slice(0, -1)
  }

  let queryString = ''
  const params = mock.request.queryParams
  if (params && Object.keys(params).length > 0) {
    const normalized: Record<string, string> = {}
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        normalized[key] = String(value)
      }
    }
    if (Object.keys(normalized).length > 0) {
      queryString = new URLSearchParams(normalized).toString()
    }
  }

  let key = `${method}:${url}${queryString ? `?${queryString}` : ''}`

  if (['POST', 'PUT', 'PATCH'].includes(method) && mock.request.data !== undefined) {
    try {
      const body =
        typeof mock.request.data === 'string'
          ? JSON.parse(mock.request.data)
          : mock.request.data
      key += `:${stableJson(body)}`
    } catch {
      key += `:${String(mock.request.data)}`
    }
  }

  return key
}

export function formatDateStr(date: Date | string = new Date()): string {
  const iso = typeof date === 'string' ? date : date.toISOString()
  const normalized = Number.isFinite(Date.parse(iso))
    ? new Date(iso).toISOString()
    : new Date(0).toISOString()
  return normalized
    .replace(/T/, '_')
    .replace(/\..+/, '')
    .replace(/:/g, '-')
}

function recordingFilename(filename: string, mock: GeneratedMockData): string {
  const identity = requestIdentityKey(mock)
  const suffix = `_${sha256Hex(identity).slice(0, RECORDING_IDENTITY_HASH_HEX_LENGTH)}`
  const stem = filename.endsWith('.json') ? filename.slice(0, -'.json'.length) : filename
  return clampRecordingFilename(`${stem}${suffix}.json`, identity)
}

export function getMockFilePath(
  mock: GeneratedMockData,
  dateStr: string
): { dir: string; filename: string } {
  const url = mock.request.url || ''
  const method = (mock.request.method || 'GET').toUpperCase()

  try {
    const parsed = new URL(url)
    const host = parsed.hostname
    const pathSegments = parsed.pathname.split('/').filter(Boolean)
    const hostSafe = clampFsPathSegment(host.replace(/[^a-zA-Z0-9.-]/g, '_'))

    const graphqlIdx = pathSegments.lastIndexOf('graphql')
    const restIdx = pathSegments.indexOf('rest')

    let type: string
    let remainingSegments: string[]

    if (graphqlIdx >= 0) {
      type = 'graphql'
      remainingSegments = pathSegments.slice(graphqlIdx + 1)
    } else if (restIdx >= 0) {
      type = 'rest'
      remainingSegments = pathSegments.slice(restIdx + 1)
    } else {
      type = ''
      remainingSegments = pathSegments
    }

    let identifier = ''
    if (mock.request.data) {
      try {
        const body =
          typeof mock.request.data === 'string'
            ? JSON.parse(mock.request.data)
            : mock.request.data
        if (body && typeof body === 'object' && !Array.isArray(body)) {
          const record = body as Record<string, unknown>
          if (typeof record.operationName === 'string') {
            identifier = record.operationName
          } else if (typeof record.path === 'string') {
            identifier = record.path
          } else if (typeof record.webAppName === 'string') {
            identifier = record.webAppName
          }
        }
      } catch {
        // ignore
      }
    }

    identifier = identifier.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 60)

    const dirParts = [hostSafe, type, ...remainingSegments.map(clampFsPathSegment)].filter(
      Boolean
    )
    const dir = dirParts.join('/')
    const filename = identifier
      ? `${method}_${identifier}_${dateStr}.json`
      : `${method}_${dateStr}.json`

    return { dir, filename: recordingFilename(filename, mock) }
  } catch {
    const urlSafe = url.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '_')
    return {
      dir: 'unknown',
      filename: recordingFilename(
        `${method}_${urlSafe.substring(0, 60)}_${dateStr}.json`,
        mock
      ),
    }
  }
}

/**
 * Relative path under the scenario folder for a generated mock
 * (`dir/filename`, POSIX separators) — same as the CLI node writer.
 */
export function getMockRelativeFile(
  mock: GeneratedMockData,
  dateStr?: string
): string {
  const resolvedDate =
    dateStr ??
    formatDateStr(
      typeof mock.timestamp === 'string' && mock.timestamp
        ? mock.timestamp
        : '1970-01-01T00:00:00.000Z'
    )
  const { dir, filename } = getMockFilePath(mock, resolvedDate)
  return dir ? `${dir}/${filename}` : filename
}
