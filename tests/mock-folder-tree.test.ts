import type { MockFile } from '@/types'
import { buildMockFolderTree, mockFolderDirSegments, sortFolderEntries } from '@/lib/mockFolderTree'

function mock(partial: Partial<MockFile> & Pick<MockFile, 'filename'>): MockFile {
  const modified = partial.modified ?? '2026-10-21T10:00:00.000Z'
  return {
    filePath: partial.filename,
    size: 1,
    created: modified,
    modified,
    graphqlInfo: null,
    sessionId: null,
    method: 'GET',
    endpoint: null,
    ...partial,
  }
}

describe('buildMockFolderTree', () => {
  it('keeps on-disk nested paths', () => {
    const nested = mock({
      filename: '127.0.0.1/api/cms/pages/lottery-rules/GET_2026-10-21.json',
      endpoint: 'http://127.0.0.1:4200/api/cms/pages/lottery-rules',
    })
    expect(mockFolderDirSegments(nested)).toEqual([
      '127.0.0.1',
      'api',
      'cms',
      'pages',
      'lottery-rules',
    ])
    const tree = buildMockFolderTree([nested])
    expect(sortFolderEntries(tree).map((e) => e.name)).toEqual(['127.0.0.1'])
  })

  it('nests flat filenames by endpoint host and path', () => {
    const flat = mock({
      filename: '2026-10-21T09-30-34-668Z_GET_127_0_0_1_4203_discover.json',
      endpoint: 'http://127.0.0.1:4203/discover',
    })
    const stub = mock({
      filename: 'inbound-parent_abc.json',
      endpoint: 'http://127.0.0.1:4203/discover',
      inboundParentStub: true,
    })
    expect(mockFolderDirSegments(flat)).toEqual(['127.0.0.1', 'discover'])
    expect(mockFolderDirSegments(stub)).toEqual(['127.0.0.1', 'discover'])

    const tree = buildMockFolderTree([flat, stub])
    const host = tree.subfolders.get('127.0.0.1')
    const discover = host?.subfolders.get('discover')
    expect(discover?.files.map((f) => f.filename).sort()).toEqual([
      flat.filename,
      stub.filename,
    ].sort())
  })

  it('leaves opaque files without endpoint at the scenario root', () => {
    const orphan = mock({ filename: 'domain-path-rules.json' })
    const tree = buildMockFolderTree([orphan])
    expect(tree.files).toEqual([orphan])
    expect(tree.subfolders.size).toBe(0)
  })
})
