import type { MockFile } from '@/types'
import type { MockFolderNode } from '@/lib/mockFolderTree'

function safeParseUrl(input: string): URL | null {
  try {
    return new URL(input)
  } catch {
    return null
  }
}

function splitPathname(pathname: string): string[] {
  const cleaned = pathname.replace(/\/+/g, '/').replace(/^\/|\/$/g, '')
  if (!cleaned) return []
  return cleaned.split('/').filter(Boolean)
}

/**
 * Group mocks by endpoint URL:
 * - host (domain) first
 * - then pathname segments
 *
 * This provides a "requests tree" view so domains are separated.
 */
export function buildMockRequestTree(mocks: MockFile[]): MockFolderNode {
  const root: MockFolderNode = {
    segment: '',
    fullPath: '',
    subfolders: new Map(),
    files: [],
  }

  for (const mock of mocks) {
    const endpoint = mock.endpoint ?? ''
    const url = endpoint ? safeParseUrl(endpoint) : null

    const host = url?.host || '(unknown-host)'
    const segments = url ? splitPathname(url.pathname) : []

    const allSegments = [host, ...segments]
    let node = root
    let pathAcc = ''

    for (const seg of allSegments) {
      pathAcc = pathAcc ? `${pathAcc}/${seg}` : seg
      let next = node.subfolders.get(seg)
      if (!next) {
        next = { segment: seg, fullPath: pathAcc, subfolders: new Map(), files: [] }
        node.subfolders.set(seg, next)
      }
      node = next
    }

    node.files.push(mock)
  }

  return root
}

