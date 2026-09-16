export interface GraphqlListInfo {
  query?: string | null
  variables?: unknown
  operationName?: string | null
  queryPreview?: string | null
  variablesPreview?: string | null
}

const CLIENT_QUERY_PREVIEW_MAX = 1200
const CLIENT_VARIABLES_PREVIEW_MAX = 400

function truncatePreview(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars).replace(/\s+$/g, '')}\n…`
}

function formatQueryForPreview(query: string): string {
  let formatted = query.replace(/\r\n/g, '\n')
  if (!formatted.includes('\n') && /\\n/.test(formatted)) {
    formatted = formatted.replace(/\\n/g, '\n').replace(/\\t/g, '  ')
  }
  if (formatted.includes('\n')) {
    return formatted
      .split('\n')
      .map((line) => line.replace(/\t/g, '  ').replace(/\s+$/g, ''))
      .join('\n')
      .trim()
  }
  return formatted.replace(/\s+/g, ' ').trim()
}

/** Query excerpt for mock list cards when the API did not send queryPreview. */
export function graphqlQueryPreviewText(info: GraphqlListInfo | null | undefined): string | null {
  if (!info) return null
  if (typeof info.queryPreview === 'string' && info.queryPreview.trim()) {
    return info.queryPreview.trim()
  }
  if (typeof info.query === 'string' && info.query.trim()) {
    return truncatePreview(formatQueryForPreview(info.query), CLIENT_QUERY_PREVIEW_MAX)
  }
  return null
}

export function graphqlVariablesPreviewText(info: GraphqlListInfo | null | undefined): string | null {
  if (!info) return null
  if (typeof info.variablesPreview === 'string' && info.variablesPreview.trim()) {
    return info.variablesPreview.trim()
  }
  if (info.variables === undefined || info.variables === null) return null
  try {
    const text = JSON.stringify(info.variables, null, 2)
    if (!text || text === '{}' || text === 'null') return null
    return truncatePreview(text, CLIENT_VARIABLES_PREVIEW_MAX)
  } catch {
    return String(info.variables)
  }
}

/**
 * Readable GraphQL POST body for the mock editor (query with real newlines + variables).
 */
export function formatGraphqlRequestBodyForEditor(data: unknown): string | null {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) return null
  const body = data as Record<string, unknown>
  if (typeof body.query !== 'string') return null
  const trimmed = body.query.trim()
  if (!/^(query|mutation|subscription)\b/.test(trimmed) && !/^\{/.test(trimmed)) return null
  const parts: string[] = []
  if (typeof body.operationName === 'string' && body.operationName.trim()) {
    parts.push(`# operationName: ${body.operationName.trim()}`, '')
  }
  parts.push(formatQueryForPreview(body.query))
  if (body.variables !== undefined && body.variables !== null) {
    parts.push('', '# Variables')
    try {
      parts.push(JSON.stringify(body.variables, null, 2))
    } catch {
      parts.push(String(body.variables))
    }
  }
  if (body.extensions !== undefined && body.extensions !== null) {
    parts.push('', '# Extensions')
    try {
      parts.push(JSON.stringify(body.extensions, null, 2))
    } catch {
      parts.push(String(body.extensions))
    }
  }
  // Include any other extra fields that aren't the standard GraphQL fields
  const standardFields = new Set(['query', 'variables', 'operationName', 'extensions'])
  const extraFields = Object.keys(body).filter((key) => !standardFields.has(key))
  if (extraFields.length > 0) {
    for (const key of extraFields) {
      parts.push('', `# ${key}`)
      try {
        parts.push(JSON.stringify(body[key], null, 2))
      } catch {
        parts.push(String(body[key]))
      }
    }
  }
  return parts.join('\n')
}
