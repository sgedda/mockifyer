import type { MockFile } from '@/types'
import {
  buildMockChainMaps,
  buildMockServiceChainsForDisplay,
  buildUniqueMockChainForest,
  chainHasRequestCorrelation,
  chainHasUpstreamReplayBlock,
  countNestedMockChainCalls,
  enrichChainHopsForDisplay,
  filterMockServiceChainsByFilenames,
  formatChainFirstLastLabel,
  formatHopPathLabel,
  formatHopPathLabelWithCatalog,
  hopPathLabelParts,
  filterMocksByHopTraffic,
  getChainRootRequestId,
  getMockHopTrafficMode,
  mockChainNodeCanExpand,
  mockHopEndpointFingerprint,
  mockHopHitsUpstream,
  collectMockChainRoleFilenames,
  planChainRoleReplay,
  collectUpstreamDomainPathsForReplay,
  planDomainFolderReplay,
  describeBulkReplayModeResult,
  type MockUniqueChainNode,
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

  it('does not promote a LaunchDarkly diagnostic burst into a 71-hop entry chain', () => {
    const graphql = mock({
      filename: 'graphql.json',
      method: 'POST',
      endpoint: 'http://localhost:4000/graphql',
      requestId: 'a6ac4e1a-cccc-4000-8000-000000000002',
      modified: '2026-09-10T16:36:01.000Z',
    })
    const nested = mock({
      filename: 'cms.json',
      method: 'GET',
      endpoint: 'http://localhost:4000/cms/page',
      requestId: 'gql-child',
      parentRequestId: graphql.requestId,
      modified: '2026-09-10T16:36:02.000Z',
    })
    const diagnostic = mock({
      filename: 'diagnostic.json',
      method: 'POST',
      endpoint: 'https://events.launchdarkly.com/mobile/events/diagnostic',
      requestId: 'e9bfa145-cccc-4000-8000-000000000001',
      modified: '2026-09-10T16:36:00.000Z',
    })

    const sessionNoise: MockFile[] = [diagnostic]
    const paths = [
      ['GET', 'http://localhost:4000/rest/deliveryapi/attributeCollection?talas=app-bottom-tabs-6.0.3'],
      ['POST', 'http://localhost:4000/graphql'],
      ['GET', 'http://localhost:4000/rest/deliveryapi/attributeCollection?talas=prefetch-specification'],
      ['GET', 'http://localhost:4000/rest/deliveryapi/attributeCollection?talas=app-localization-master'],
      ['POST', 'http://localhost:4000/rest/deliveryapi/collection'],
    ]
    for (let i = 0; i < 68; i += 1) {
      const [method, endpoint] = paths[i % paths.length]
      sessionNoise.push(
        mock({
          filename: `session-${i}.json`,
          method,
          endpoint,
          requestId: `session-${i}`,
          modified: new Date(Date.parse('2026-09-10T16:36:00.000Z') + (i + 1) * 150).toISOString(),
        })
      )
    }

    const chains = buildMockServiceChainsForDisplay([graphql, nested, ...sessionNoise])
    expect(chains).toHaveLength(1)
    expect(chains[0].hops.map((hop) => hop.filename)).toEqual(['graphql.json', 'cms.json'])
    expect(chains[0].hops.some((hop) => hop.filename === 'diagnostic.json')).toBe(false)
    expect(chains[0].enrichedHopFilenames ?? []).toEqual([])
  })

  it('does not prepend a nearby /aggregate hop without a parent-request-id link', () => {
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
    expect(chains[0].hops.map((hop) => hop.filename)).toEqual(['via-axios.json', 'product.json'])
    expect(chains[0].enrichedHopFilenames ?? []).toEqual([])
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

  it('keeps a search hit inside its full chain instead of rebuilding from the match alone', () => {
    const graphql = mock({
      filename: 'graphql.json',
      method: 'POST',
      endpoint: 'http://localhost:4000/graphql',
      requestId: '561371ed-8d84-47c5-ab9a-92cb9d351b4a',
    })
    const account = mock({
      filename: 'myaccount.json',
      endpoint: 'https://node-capi-member-api-ats.azurewebsites.net/v-2/myaccount/',
      requestId: '6d086533-eb9d-48d2-8581-642b1e86f853',
      parentRequestId: graphql.requestId,
      modified: '2026-09-16T09:09:06.577Z',
    })
    const token = mock({
      filename: 'token.json',
      method: 'POST',
      endpoint: 'http://tokenws.acctest.int/TokenService.asmx',
      requestId: 'f740ef00-1754-4169-af4a-5f03ca10fc49',
      parentRequestId: account.requestId,
      modified: '2026-09-16T09:09:06.661Z',
    })

    const catalogChains = buildMockServiceChainsForDisplay([graphql, account, token])
    expect(catalogChains).toHaveLength(1)
    expect(catalogChains[0].hops.map((hop) => hop.filename)).toEqual([
      'graphql.json',
      'myaccount.json',
      'token.json',
    ])

    const searchOnlyAccount = buildMockServiceChainsForDisplay([account])
    expect(searchOnlyAccount).toHaveLength(0)

    const filtered = filterMockServiceChainsByFilenames(
      catalogChains,
      new Set(['myaccount.json'])
    )
    expect(filtered).toHaveLength(1)
    expect(filtered[0].hops.map((hop) => hop.filename)).toEqual([
      'graphql.json',
      'myaccount.json',
      'token.json',
    ])
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

function forestOutline(nodes: MockUniqueChainNode[], depth = 0): string[] {
  return nodes.flatMap((node) => {
    const label = node.fingerprint.startsWith('missing-parent:')
      ? `missing-parent:${node.representative.requestId}`
      : `${mockHopEndpointFingerprint(node.representative)}${node.callCount > 1 ? `×${node.callCount}` : ''}`
    return [
      `${'  '.repeat(depth)}${label}`,
      ...forestOutline(node.children, depth + 1),
    ]
  })
}

describe('unique mock chain forest', () => {
  it('nests parent-linked hops at different tree levels instead of flattening them', () => {
    const graphql = mock({
      filename: 'graphql.json',
      method: 'POST',
      endpoint: 'http://localhost:4000/graphql',
      requestId: 'root',
    })
    const cms = mock({
      filename: 'cms.json',
      endpoint: 'http://localhost:4000/cms/page',
      requestId: 'cms',
      parentRequestId: 'root',
      modified: '2026-09-10T16:18:01.000Z',
    })
    const fragment = mock({
      filename: 'fragment.json',
      endpoint: 'http://localhost:4000/cms/fragment',
      requestId: 'frag',
      parentRequestId: 'cms',
      modified: '2026-09-10T16:18:02.000Z',
    })

    const forest = buildUniqueMockChainForest([graphql, cms, fragment])
    expect(forestOutline(forest)).toEqual([
      'POST /graphql',
      '  GET /cms/page',
      '    GET /cms/fragment',
    ])
    expect(countNestedMockChainCalls(forest[0])).toBe(2)
  })

  it('keeps the same endpoint nested when it appears on a deeper level', () => {
    const page = mock({
      filename: 'page.json',
      endpoint: 'http://localhost:4000/cms/page',
      requestId: 'page',
    })
    const nestedPage = mock({
      filename: 'nested-page.json',
      endpoint: 'http://localhost:4000/cms/page',
      requestId: 'nested',
      parentRequestId: 'page',
      modified: '2026-09-10T16:18:01.000Z',
    })

    const forest = buildUniqueMockChainForest([page, nestedPage])
    expect(forestOutline(forest)).toEqual(['GET /cms/page', '  GET /cms/page'])
    expect(forest[0].callCount).toBe(1)
    expect(forest[0].children[0].callCount).toBe(1)
  })

  it('nests inferred hops as a path so later services collapse under the entry', () => {
    const aggregate = mock({
      filename: 'aggregate.json',
      endpoint: 'http://gateway:3000/aggregate',
    })
    const viaAxios = mock({
      filename: 'via-axios.json',
      endpoint: 'http://relay:3001/via-axios',
      modified: '2026-09-10T16:18:01.000Z',
    })
    const product = mock({
      filename: 'product.json',
      endpoint: 'http://catalog:3002/product/1',
      modified: '2026-09-10T16:18:02.000Z',
    })

    const forest = buildUniqueMockChainForest([aggregate, viaAxios, product])
    expect(forestOutline(forest)).toEqual([
      'GET /aggregate',
      '  GET /via-axios',
      '    GET /product/:id',
    ])
  })

  it('wraps an enriched entry hop around the linked subtree instead of a sibling root', () => {
    const aggregate = mock({
      filename: 'aggregate.json',
      endpoint: 'http://gateway:3000/aggregate',
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

    const forest = buildUniqueMockChainForest([aggregate, viaAxios, product])
    expect(forestOutline(forest)).toEqual([
      'GET /aggregate',
      '  GET /via-axios',
      '    GET /product/:id',
    ])
  })

  it('collapses consecutive identical hops at the same level and nests the next unique hop', () => {
    const tokenA = mock({
      filename: 'token-a.json',
      method: 'POST',
      endpoint: 'https://tokenws.acctest.nl/TokenService.asmx',
    })
    const tokenB = mock({
      filename: 'token-b.json',
      method: 'POST',
      endpoint: 'https://tokenws.acctest.nl/TokenService.asmx',
      modified: '2026-09-10T16:18:01.000Z',
    })
    const account = mock({
      filename: 'account.json',
      endpoint: 'http://localhost:4000/v-2/myaccount',
      modified: '2026-09-10T16:18:02.000Z',
    })

    const forest = buildUniqueMockChainForest([tokenA, tokenB, account])
    expect(forestOutline(forest)).toEqual([
      'POST /TokenService.asmx×2',
      '  GET /v-2/myaccount',
    ])
    expect(forest[0].hops).toHaveLength(2)
    expect(mockChainNodeCanExpand(forest[0])).toBe(true)
    expect(mockChainNodeCanExpand(forest[0].children[0])).toBe(false)
  })

  it('does not nest two id-bearing orphan roots after a stale parent id', () => {
    const graphql = mock({
      filename: 'graphql.json',
      method: 'POST',
      endpoint: 'http://localhost:4000/graphql',
      requestId: 'g-new',
    })
    const myaccount = mock({
      filename: 'myaccount.json',
      endpoint: 'http://localhost:4000/v-2/myaccount',
      requestId: 'acct',
      parentRequestId: 'g-old',
      modified: '2026-09-10T16:18:01.000Z',
    })
    const bookings = mock({
      filename: 'bookings.json',
      endpoint: 'http://localhost:4000/v-2/myaccount/bookings/11111111-1111-1111-1111-111111111111',
      requestId: 'book',
      parentRequestId: 'acct',
      modified: '2026-09-10T16:18:02.000Z',
    })

    const forest = buildUniqueMockChainForest([graphql, myaccount, bookings])
    expect(forestOutline(forest)).toEqual([
      'POST /graphql',
      'GET /v-2/myaccount',
      '  GET /v-2/myaccount/bookings/:id',
    ])
  })

  it('does not attach orphans to a nearby GraphQL hop just because they were recorded together', () => {
    const graphql = mock({
      filename: 'graphql.json',
      method: 'POST',
      endpoint: 'http://localhost:4000/graphql',
      requestId: 'g-new',
      graphqlInfo: { query: 'query myAccountDeferredBookings { myAccount { id } }', variables: null },
      modified: '2026-09-17T15:00:00.000Z',
    })
    const myaccount = mock({
      filename: 'myaccount.json',
      endpoint: 'https://node-capi-member-api-ats.azurewebsites.net/v-2/myaccount/',
      requestId: 'acct',
      parentRequestId: 'g-old',
      modified: '2026-09-17T15:00:01.000Z',
    })
    const independent = mock({
      filename: 'independent.json',
      method: 'POST',
      endpoint: 'https://independentws-ver3.acctest.int/IndependentService.asmx',
      requestId: 'ind',
      parentRequestId: 'acct',
      modified: '2026-09-17T15:00:02.000Z',
    })
    const bookingRepo: MockFile[] = []
    for (let i = 0; i < 8; i += 1) {
      bookingRepo.push(
        mock({
          filename: `booking-repo-${i}.json`,
          endpoint: `https://bwoty-bookingrepositoryapi-acctst.azurewebsites.net/api/booking/11111111-1111-1111-1111-11111111111${i}`,
          requestId: `repo-${i}`,
          parentRequestId: 'g-old',
          modified: new Date(Date.parse('2026-09-17T15:00:03.000Z') + i * 100).toISOString(),
        })
      )
    }
    const bookingHub: MockFile[] = []
    for (let i = 0; i < 8; i += 1) {
      bookingHub.push(
        mock({
          filename: `booking-hub-${i}.json`,
          endpoint: `https://bwoty-bookinghubapi-acctst.azurewebsites.net/api/booking/22222222-2222-2222-2222-22222222222${i}`,
          requestId: `hub-${i}`,
          parentRequestId: 'g-old',
          modified: new Date(Date.parse('2026-09-17T15:00:04.000Z') + i * 100).toISOString(),
        })
      )
    }
    const tokens: MockFile[] = []
    for (let i = 0; i < 8; i += 1) {
      tokens.push(
        mock({
          filename: `token-${i}.json`,
          method: 'POST',
          endpoint: 'https://nltg-crm-token-fn-acctest.azurewebsites.net/api/token',
          requestId: `tok-${i}`,
          parentRequestId: 'g-old',
          modified: new Date(Date.parse('2026-09-17T15:00:05.000Z') + i * 100).toISOString(),
        })
      )
    }

    const chains = buildMockServiceChainsForDisplay([
      graphql,
      myaccount,
      independent,
      ...bookingRepo,
      ...bookingHub,
      ...tokens,
    ])
    expect(chains).toHaveLength(1)
    expect(chains[0].hops.some((hop) => hop.filename === 'graphql.json')).toBe(false)
    expect(chains[0].hops[0].filename).toBe('myaccount.json')
    expect(chains[0].hops.some((hop) => hop.filename === 'independent.json')).toBe(true)
    expect(chains[0].hops.some((hop) => hop.filename.startsWith('booking-repo-'))).toBe(true)

    const forest = buildUniqueMockChainForest(chains[0].hops)
    expect(forestOutline(forest)).toEqual([
      'missing-parent:g-old',
      '  GET /v-2/myaccount/',
      '    POST /IndependentService.asmx',
      '  GET /api/booking/:id×16',
      '  POST /api/token×8',
    ])
  })

  it('does not promote the first orphan as root when siblings share a missing parent', () => {
    const token = mock({
      filename: 'token.json',
      method: 'POST',
      endpoint: 'https://tokenws.acctest.int/TokenService.asmx',
      requestId: '991e728a-eeee-4000-8000-000000000001',
      parentRequestId: '47afd835-aaaa-4000-8000-000000000099',
      modified: '2026-09-19T20:00:00.000Z',
    })
    const membership = mock({
      filename: 'membership.json',
      method: 'POST',
      endpoint: 'https://crmapi.acctest.int/Customerapi/api/v2/Membership/query',
      requestId: 'c6d55262-eeee-4000-8000-000000000002',
      parentRequestId: '47afd835-aaaa-4000-8000-000000000099',
      modified: '2026-09-19T20:00:01.000Z',
    })
    const independents: MockFile[] = []
    for (let i = 0; i < 5; i += 1) {
      independents.push(
        mock({
          filename: `independent-${i}.json`,
          method: 'POST',
          endpoint: 'https://independentws-ver3.acctest.int/IndependentService.asmx',
          requestId: `ind-${i}`,
          parentRequestId: '47afd835-aaaa-4000-8000-000000000099',
          modified: new Date(Date.parse('2026-09-19T20:00:02.000Z') + i * 100).toISOString(),
        })
      )
    }

    const chains = buildMockServiceChainsForDisplay([token, membership, ...independents])
    expect(chains).toHaveLength(1)
    expect(getChainRootRequestId(chains[0].hops)).toBe('47afd835-aaaa-4000-8000-000000000099')
    expect(chainHasRequestCorrelation(chains[0].hops)).toBe(true)
    expect(forestOutline(buildUniqueMockChainForest(chains[0].hops))).toEqual([
      'missing-parent:47afd835-aaaa-4000-8000-000000000099',
      '  POST /TokenService.asmx',
      '  POST /Customerapi/api/v2/Membership/query',
      '  POST /IndependentService.asmx×5',
    ])
  })

  it('keeps an unrelated root-only hop out of a missing-parent sibling family', () => {
    const loneToken = mock({
      filename: 'lone-token.json',
      method: 'POST',
      endpoint: 'https://tokenws.acctest.int/TokenService.asmx',
      requestId: 'lone-token',
      modified: '2026-09-19T20:00:00.000Z',
    })
    const membership = mock({
      filename: 'membership.json',
      method: 'POST',
      endpoint: 'https://crmapi.acctest.int/Customerapi/api/v2/Membership/query',
      requestId: 'mem-1',
      parentRequestId: 'missing-parent-1',
      modified: '2026-09-19T20:00:01.000Z',
    })
    const independent = mock({
      filename: 'independent.json',
      method: 'POST',
      endpoint: 'https://independentws-ver3.acctest.int/IndependentService.asmx',
      requestId: 'ind-1',
      parentRequestId: 'missing-parent-1',
      modified: '2026-09-19T20:00:02.000Z',
    })

    const chains = buildMockServiceChainsForDisplay([loneToken, membership, independent])
    expect(chains).toHaveLength(1)
    expect(chains[0].hops.map((hop) => hop.filename).sort()).toEqual([
      'independent.json',
      'membership.json',
    ])
    expect(getChainRootRequestId(chains[0].hops)).toBe('missing-parent-1')
  })

  it('nests hops only when parentRequestId matches the caller requestId', () => {
    const graphql = mock({
      filename: 'graphql.json',
      method: 'POST',
      endpoint: 'http://localhost:4000/graphql',
      requestId: 'gql-live',
      graphqlInfo: { query: 'query CurrentWeather { weather }', variables: null },
    })
    const myaccount = mock({
      filename: 'myaccount.json',
      endpoint: 'https://capi.example/v-2/myaccount/',
      requestId: 'acct',
      parentRequestId: 'gql-live',
      modified: '2026-09-17T15:00:01.000Z',
    })
    const independent = mock({
      filename: 'independent.json',
      method: 'POST',
      endpoint: 'https://independentws.example/IndependentService.asmx',
      requestId: 'ind',
      parentRequestId: 'acct',
      modified: '2026-09-17T15:00:02.000Z',
    })
    const weather = mock({
      filename: 'weather-api.json',
      endpoint: 'https://weather.example/current',
      requestId: 'wx',
      parentRequestId: 'gql-live',
      modified: '2026-09-17T15:00:03.000Z',
    })
    const foreignBooking = mock({
      filename: 'other-booking.json',
      endpoint: 'https://booking.example/api/booking/1',
      requestId: 'book',
      parentRequestId: 'someone-else',
      modified: '2026-09-17T15:00:04.000Z',
    })

    const chains = buildMockServiceChainsForDisplay([
      graphql,
      myaccount,
      independent,
      weather,
      foreignBooking,
    ])
    expect(chains).toHaveLength(1)
    expect(forestOutline(buildUniqueMockChainForest(chains[0].hops))).toEqual([
      'POST /graphql',
      '  GET /v-2/myaccount/',
      '    POST /IndependentService.asmx',
      '  GET /current',
    ])
  })
})

describe('getMockHopTrafficMode', () => {
  it('treats always-refresh-from-live as refresh, not replay', () => {
    const hop = mock({
      filename: 'graphql.json',
      method: 'POST',
      endpoint: 'http://localhost:4000/graphql',
      alwaysRefreshFromLive: true,
      replayMode: 'always-refresh',
    })
    expect(getMockHopTrafficMode(hop)).toBe('refresh')
    expect(mockHopHitsUpstream(hop)).toBe(true)
    expect(chainHasUpstreamReplayBlock([hop, hop], 1)).toBe(false)
  })

  it('treats use-saved-mock as replay that blocks downstream hops', () => {
    const upstream = mock({
      filename: 'graphql.json',
      method: 'POST',
      endpoint: 'http://localhost:4000/graphql',
      replayMode: 'stored',
    })
    const downstream = mock({
      filename: 'account.json',
      endpoint: 'http://localhost:4000/v-2/myaccount',
    })
    expect(getMockHopTrafficMode(upstream)).toBe('replay')
    expect(mockHopHitsUpstream(upstream)).toBe(false)
    expect(chainHasUpstreamReplayBlock([upstream, downstream], 1)).toBe(true)
  })

  it('filters mocks by replay traffic mode', () => {
    const stored = mock({
      filename: 'stored.json',
      endpoint: 'http://localhost:4000/graphql',
      replayMode: 'stored',
    })
    const live = mock({
      filename: 'live.json',
      endpoint: 'http://localhost:4000/v-2/myaccount',
      alwaysUseRealApi: true,
    })
    expect(filterMocksByHopTraffic([stored, live], 'replay').map((row) => row.filename)).toEqual([
      'stored.json',
    ])
    expect(filterMocksByHopTraffic([stored, live], 'live').map((row) => row.filename)).toEqual([
      'live.json',
    ])
  })
})

describe('hop path labels', () => {
  it('uses GraphQL operation names and first → last chain path', () => {
    expect(
      formatHopPathLabel({
        method: 'POST',
        endpoint: 'http://localhost:4000/graphql',
        operationName: 'myAccountBookingExtras',
      })
    ).toBe('POST myAccountBookingExtras')
    expect(
      formatHopPathLabel({
        method: 'POST',
        endpoint: 'https://tokenws.acctest.nl/',
      })
    ).toBe('POST tokenws.acctest.nl/')

    const chain = {
      id: 'root-1',
      hops: [
        mock({
          filename: 'graphql.json',
          method: 'POST',
          endpoint: 'http://localhost:4000/graphql',
          graphqlInfo: { operationName: 'Home', query: null, variables: null },
        }),
        mock({
          filename: 'account.json',
          method: 'GET',
          endpoint: 'http://localhost:4000/v-2/myaccount/',
        }),
      ],
      latestModified: '2026-09-10T16:18:01.000Z',
    }
    expect(formatChainFirstLastLabel(chain)).toBe('POST Home → GET /v-2/myaccount/')
    expect(
      hopPathLabelParts({
        method: 'GET',
        endpoint: 'https://api.weather.com/weather/currentConditions?api-version=1.1',
      })
    ).toEqual({
      method: 'GET',
      kind: 'path',
      text: '/weather/currentConditions',
      query: '?api-version=1.1',
    })
  })

  it('does not use Redis hash filenames as hop labels', () => {
    const hash = '29348224605608adf7422ce28684fef8d85534ffc98611c86d797cfd29457a33.json'
    expect(
      formatHopPathLabel({
        method: 'POST',
        endpoint: `redis/${hash}`,
        filename: `redis/${hash}`,
      })
    ).toBe('POST')
    expect(
      formatHopPathLabel({
        method: 'GET',
        endpoint: hash,
        filename: hash,
      })
    ).toBe('GET')
  })

  it('fills missing stats URLs from the compact mock catalog', () => {
    const hash = '29348224605608adf7422ce28684fef8d85534ffc98611c86d797cfd29457a33.json'
    const catalog = mock({
      filename: `redis/${hash}`,
      method: 'GET',
      endpoint: 'http://localhost:4000/v-2/myaccount/',
    })
    expect(
      formatHopPathLabelWithCatalog(
        {
          method: 'GET',
          endpoint: `redis/${hash}`,
          filename: `redis/${hash}`,
        },
        catalog
      )
    ).toBe('GET /v-2/myaccount/')
  })
})

describe('chain role replay plans', () => {
  it('splits GraphQL BFF hops from source/leaf hops and plans Live ancestors', () => {
    const graphql = mock({
      filename: 'graphql.json',
      method: 'POST',
      endpoint: 'http://localhost:4000/graphql',
      requestId: 'bff-1',
      graphqlInfo: { query: 'query Q { a }', variables: {}, operationName: 'Q' },
    })
    const booking = mock({
      filename: 'booking.json',
      method: 'GET',
      endpoint: 'http://booking.example/api/booking/1',
      requestId: 'src-1',
      parentRequestId: graphql.requestId,
    })
    const token = mock({
      filename: 'token.json',
      method: 'POST',
      endpoint: 'https://token.example/TokenService.asmx',
      requestId: 'src-2',
      parentRequestId: graphql.requestId,
    })
    const chains = buildMockServiceChainsForDisplay([graphql, booking, token])
    expect(chains).toHaveLength(1)

    const roles = collectMockChainRoleFilenames(chains)
    expect(roles.bff).toEqual(['graphql.json'])
    expect(roles.sources.sort()).toEqual(['booking.json', 'token.json'])
    expect(roles.ancestorsOfSources).toEqual(['graphql.json'])

    expect(planChainRoleReplay(chains, 'bff')).toEqual({
      stored: ['graphql.json'],
      passthrough: [],
    })
    expect(planChainRoleReplay(chains, 'sources')).toEqual({
      stored: expect.arrayContaining(['booking.json', 'token.json']),
      passthrough: ['graphql.json'],
    })
  })
})

describe('domain folder replay plans', () => {
  it('puts the folder on saved mocks and parent hops on Live', () => {
    const graphql = mock({
      filename: 'graphql.json',
      method: 'POST',
      endpoint: 'http://localhost:4000/graphql',
      requestId: 'bff-1',
      graphqlInfo: { query: 'query Q { a }', variables: {}, operationName: 'Q' },
    })
    const booking = mock({
      filename: 'booking.json',
      method: 'GET',
      endpoint: 'http://booking.example/api/booking/1',
      requestId: 'src-1',
      parentRequestId: graphql.requestId,
    })
    const catalog = [graphql, booking]
    expect(collectUpstreamDomainPathsForReplay([booking], catalog)).toEqual(['localhost:4000/graphql'])
    expect(planDomainFolderReplay(catalog, 'booking.example')).toEqual({
      stored: ['booking.json'],
      passthrough: ['graphql.json'],
    })
  })

  it('does not treat unrelated session traffic as upstream hops', () => {
    const booking = mock({
      filename: 'booking.json',
      method: 'GET',
      endpoint: 'http://booking.example/api/booking/1',
      requestId: 'src-1',
      modified: '2026-09-10T16:18:00.000Z',
    })
    const noise = mock({
      filename: 'noise.json',
      method: 'GET',
      endpoint: 'http://localhost:4000/weather/currentConditions',
      requestId: 'noise-1',
      modified: '2026-09-10T16:18:01.000Z',
    })
    expect(collectUpstreamDomainPathsForReplay([booking], [booking, noise])).toEqual([])
    expect(planDomainFolderReplay([booking, noise], 'booking.example')).toEqual({
      stored: ['booking.json'],
      passthrough: [],
    })
  })

  it('describes mixed stored, pending, and parent-live results', () => {
    expect(
      describeBulkReplayModeResult({
        updatedStored: 2,
        queuedRefreshNext: 1,
        updatedLive: 3,
      })
    ).toBe('2 mocks on saved response. 1 will capture on next request, then replay. 3 parent hops set to Live')
  })
})

