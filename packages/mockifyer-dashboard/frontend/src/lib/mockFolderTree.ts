import type { MockFile } from '@/types'

export interface MockFolderNode {
  /** Last path segment, or '' for scenario root */
  segment: string
  /** Full path prefix e.g. api/foo/graphql */
  fullPath: string
  subfolders: Map<string, MockFolderNode>
  files: MockFile[]
}

/**
 * Group mock files by directory segments (relative paths with /).
 */
export function buildMockFolderTree(mocks: MockFile[]): MockFolderNode {
  const root: MockFolderNode = {
    segment: '',
    fullPath: '',
    subfolders: new Map(),
    files: [],
  }

  for (const mock of mocks) {
    const segments = mock.filename.split('/').filter(Boolean)
    if (segments.length === 0) continue

    segments.pop() /* file name */
    let node = root
    let pathAcc = ''

    for (const seg of segments) {
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
