import {
  buildSimilarMockGroups,
  inferGraphqlOperationName,
  jaccardSimilarity,
  stableStringifyVariables,
  tokenizeGraphqlDocument,
  normalizeGraphQLQuery,
} from '@sgedda/mockifyer-core';

describe('mock-body-similarity', () => {
  it('stableStringifyVariables sorts keys', () => {
    expect(stableStringifyVariables({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it('inferGraphqlOperationName prefers explicit operationName', () => {
    expect(inferGraphqlOperationName('query Foo { x }', 'Bar')).toBe('Bar');
    expect(inferGraphqlOperationName('query Foo { x }', null)).toBe('Foo');
  });

  it('jaccardSimilarity is 1 for identical token sets', () => {
    const s = new Set(['a', 'b', 'c']);
    expect(jaccardSimilarity(s, s)).toBe(1);
  });

  it('groups two GraphQL mocks with same op, variables, URL when query differs slightly', () => {
    const baseUrl = 'https://api.example.com/graphql';
    const q1 = normalizeGraphQLQuery(`
      query myAccountDeferredBookings($timeFilter: TimeFilter) {
        myAccount { customerId phoneNumber { value } membershipId }
      }
    `);
    const q2 = normalizeGraphQLQuery(`
      query myAccountDeferredBookings($timeFilter: TimeFilter) {
        myAccount { customerId phoneNumber { value } email { value } membershipId }
      }
    `);
    const groups = buildSimilarMockGroups(
      [
        {
          filename: 'a.json',
          endpoint: baseUrl,
          method: 'POST',
          graphqlInfo: {
            query: q1,
            variables: { timeFilter: 'CURRENT_AND_UPCOMING' },
            operationName: 'myAccountDeferredBookings',
          },
        },
        {
          filename: 'b.json',
          endpoint: baseUrl,
          method: 'POST',
          graphqlInfo: {
            query: q2,
            variables: { timeFilter: 'CURRENT_AND_UPCOMING' },
            operationName: 'myAccountDeferredBookings',
          },
        },
      ],
      { threshold: 0.85 }
    );
    expect(groups.length).toBe(1);
    expect(groups[0].filenames.sort()).toEqual(['a.json', 'b.json']);
    expect(groups[0].minSimilarity).toBeGreaterThanOrEqual(0.85);
  });

  it('does not group when variables differ', () => {
    const url = 'https://api.example.com/graphql';
    const q = 'query Q { myAccount { id } }';
    const groups = buildSimilarMockGroups(
      [
        {
          filename: 'a.json',
          endpoint: url,
          method: 'POST',
          graphqlInfo: { query: q, variables: { a: 1 }, operationName: 'Q' },
        },
        {
          filename: 'b.json',
          endpoint: url,
          method: 'POST',
          graphqlInfo: { query: q, variables: { a: 2 }, operationName: 'Q' },
        },
      ],
      { threshold: 0.99 }
    );
    expect(groups.length).toBe(0);
  });

  it('tokenizeGraphqlDocument picks identifiers', () => {
    const t = tokenizeGraphqlDocument('myAccount { customerId email { value } }');
    expect(t.has('myAccount')).toBe(true);
    expect(t.has('customerId')).toBe(true);
    expect(t.has('email')).toBe(true);
  });
});
