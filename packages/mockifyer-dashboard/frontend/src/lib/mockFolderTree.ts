import type { MockFile } from '@/types'
import { safeParseUrl, splitPathname } from '@/lib/mock-tree-url'

export interface MockFolderNode {
  /** Last path segment, or '' for scenario root */
  segment: string
  /** Full path prefix e.g. api/foo/graphql */
  fullPath: string
  subfolders: Map<string, MockFolderNode>
  files: MockFile[]
}

/**
 * Directory segments for the Folders view.
 * Prefer on-disk nested paths; for flat filenames fall back to endpoint host + path
 * (hostname only, matching core `getMockFilePath`) so filesystem catalogs nest usefully.
 */
export function mockFolderDirSegments(mock: MockFile): string[] {
  const filenameSegments = mock.filename.split('/').filter(Boolean)
  if (filenameSegments.length > 1) {
    return filenameSegments.slice(0, -1)
  }

  const endpoint = mock.endpoint?.trim() ?? ''
  const url = endpoint ? safeParseUrl(endpoint) : null
  if (!url?.hostname) return []

  const hostSafe = url.hostname.replace(/[^a-zA-Z0-9.-]/g, '_')
  return [hostSafe, ...splitPathname(url.pathname)]
}

/**
 * Group mock files by directory segments (relative paths with /).
 * Flat scenario-root files are nested by request URL so Folders is not a single dump.
 */
export function buildMockFolderTree(mocks: MockFile[]): MockFolderNode {
  const root: MockFolderNode = {
    segment: '',
    fullPath: '',
    subfolders: new Map(),
    files: [],
  }

  for (const mock of mocks) {
    const dirSegments = mockFolderDirSegments(mock)
    let node = root
    let pathAcc = ''

    for (const seg of dirSegments) {
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

export function sortFolderEntries(node: MockFolderNode): { name: string; child: MockFolderNode }[] {
  return Array.from(node.subfolders.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, child]) => ({ name, child }))
}
