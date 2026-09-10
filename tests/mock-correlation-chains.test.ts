import type { MockFile } from '@/types'
import {
  buildMockChainMaps,
  buildMockServiceChainsForDisplay,
  chainHasRequestCorrelation,
  enrichChainHopsForDisplay,
} from '@/lib/mock-correlation-chains'

function mock(partial: Partial<MockFile> & Pick<MockFile, 'filename' | 'endpoint'>): MockFile {
  const modified = partial.modified ?? '2026-09-10T16:18:00.000Z'
  return {
    filePath: partial.filename,
    size: 1,
    created: modified,
    modified,
    graphqlInfo: null,
    sessionId: 'session-1',
    method: 'GET',
    ...partial,
  }
}

describe('mock service chain display', () => {
  it('does not glue an Atlas client session onto one GraphQL chain as entry hops', () => {
    const graphql = mock({
      filename: 'graphql.json',
      method: 'POST',
      endpoint: 'http://localhost:4000/graphql',
      requestId: '45838cee-ffff-4000-8000-000000000001',
      modified: '2026-09-10T16:18:00.000Z',
    })
    const nested = mock({
      filename: 'cms.json',
      method: 'GET',
      endpoint: 'http://localhost:4000/cms/page',
      requestId: 'child-1',
      parentRequestId: graphql.requestId,
      modified: '2026-09-10T16:18:01.000Z',
    })

    const sessionNoise: MockFile[] = []
    const paths = [
      ['GET', 'http://localhost:4000/rest/deliveryapi/attributeCollection?talas=app-localization-master'],
      ['GET', 'http://localhost:4000/rest/deliveryapi/attributeCollection?talas=app-bottom-tabs-6.0.3'],
      ['GET', 'http://localhost:4000/rest/deliveryapi/attributeCollection?talas=prefetch-specification'],
      ['POST', 'http://localhost:4000/rest/deliveryapi/collection'],
      ['POST', 'https://tokenws.acctest.nl/TokenService.asmx'],
      ['GET', 'http://localhost:4000/v-2/myaccount'],
      ['POST', 'http://localhost:4000/mobile/events/diagnostic'],
      ['GET', 'http://localhost:4000/weather/currentConditions'],
    ]
    for (let i = 0; i < 180; i += 1) {
      const [method, endpoint] = paths[i % paths.length]
      sessionNoise.push(
        mock({
          filename: `noise-${i}.json`,
          method,
          endpoint,
          requestId: `noise-${i}`,
          parentRequestId: i === 5 ? '24675618-9999-4000-8000-000000000099' : undefined,
          modified: new Date(Date.parse('2026-09-10T16:18:00.000Z') + i * 200).toISOString(),
        })
      )
    }

    const catalog = [graphql, nested, ...sessionNoise]
    const chains = buildMockServiceChainsForDisplay(catalog)
    expect(chains).toHaveLength(1)
    expect(chains[0].hops.map((hop) => hop.filename)).toEqual(['graphql.json', 'cms.json'])
    expect(chains[0].enrichedHopFilenames ?? []).toEqual([])
  })

  it('still prepends a nearby gateway /aggregate hop onto an id-linked chain', () => {
    const aggregate = mock({
      filename: 'aggregate.json',
      endpoint: 'http://gateway:3000/aggregate',
      modified: '2026-09-10T16:18:00.000Z',
    })
    const viaAxios = mock({
      filename: 'via-axios.json',
      endpoint: 'http://relay:3001/via-axios',
      requestId: 'relay',
      modified: '2026-09-10T16:18:01.000Z',
    })
    const product = mock({
      filename: 'product.json',
      endpoint: 'http://catalog:3002/product/1',
      requestId: 'cat',
      parentRequestId: 'relay',
      modified: '2026-09-10T16:18:02.000Z',
    })

    const chains = buildMockServiceChainsForDisplay([viaAxios, product, aggregate])
    expect(chains).toHaveLength(1)
    expect(chains[0].hops.map((hop) => hop.filename)).toEqual([
      'aggregate.json',
      'via-axios.json',
      'product.json',
    ])
    expect(chains[0].enrichedHopFilenames).toContain('aggregate.json')
  })

  it('does not treat a parent id outside the chain as correlation with the root', () => {
    const hops = [
      mock({
        filename: 'a.json',
        endpoint: 'http://localhost:4000/graphql',
        requestId: '45838cee-ffff-4000-8000-000000000001',
      }),
      mock({
        filename: 'b.json',
        method: 'POST',
        endpoint: 'https://tokenws.acctest.nl/TokenService.asmx',
        requestId: 'token-1',
        parentRequestId: '24675618-9999-4000-8000-000000000099',
      }),
    ]
    expect(chainHasRequestCorrelation(hops)).toBe(false)
  })

  it('does not prepend catalog hops whose parent belongs to another chain', () => {
    const root = mock({
      filename: 'root.json',
      endpoint: 'http://localhost:4000/graphql',
      requestId: 'root-id',
    })
    const child = mock({
      filename: 'child.json',
      endpoint: 'http://localhost:4000/cms/page',
      requestId: 'child-id',
      parentRequestId: 'root-id',
      modified: '2026-09-10T16:18:01.000Z',
    })
    const foreignAggregate = mock({
      filename: 'other-aggregate.json',
      endpoint: 'http://gateway:3000/aggregate',
      requestId: 'other-gw',
      parentRequestId: 'someone-else',
      modified: '2026-09-10T16:17:50.000Z',
    })

    const hops = [root, child]
    const maps = buildMockChainMaps([root, child, foreignAggregate])
    const enriched = enrichChainHopsForDisplay(hops, [root, child, foreignAggregate], maps)
    expect(enriched.hops.map((hop) => hop.filename)).toEqual(['root.json', 'child.json'])
  })
})
