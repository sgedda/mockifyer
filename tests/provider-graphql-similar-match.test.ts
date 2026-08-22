import { MemoryProvider, selectEligibleSimilarMatch } from '@sgedda/mockifyer-core';
import type { MockData, StoredRequest } from '@sgedda/mockifyer-core';

function graphqlRequest(query: string, variables: Record<string, unknown> = {}): StoredRequest {
  return {
    method: 'POST',
    url: 'https://api.example.com/graphql',
    headers: {},
    queryParams: {},
    data: { query, variables },
  };
}

function mockFor(request: StoredRequest, data: unknown): MockData {
  return {
    request,
    response: { status: 200, data, headers: {} },
    timestamp: new Date().toISOString(),
  };
}

describe('database provider GraphQL similar match', () => {
  it('does not return a different GraphQL operation as a similar match', () => {
    const provider = new MemoryProvider({});
    const getUser = graphqlRequest('query GetUser { user { id name } }');
    const getPosts = graphqlRequest('query GetPosts { posts { id title } }');

    provider.save(mockFor(getUser, { data: { user: { id: '1', name: 'Ada' } } }));

    const similar = provider.findAllForSimilarMatch(getPosts);
    expect(similar).toEqual([]);
    expect(selectEligibleSimilarMatch(getPosts, similar)).toBeUndefined();
  });

  it('still similar-matches REST requests that share path and method', () => {
    const provider = new MemoryProvider({});
    const page1: StoredRequest = {
      method: 'GET',
      url: 'https://api.example.com/users?page=1',
      headers: {},
      queryParams: { page: '1' },
    };
    const page2: StoredRequest = {
      method: 'GET',
      url: 'https://api.example.com/users?page=2',
      headers: {},
      queryParams: { page: '2' },
    };

    provider.save(mockFor(page1, { users: [{ id: 1 }] }));

    const similar = provider.findAllForSimilarMatch(page2);
    expect(similar).toHaveLength(1);
    expect(similar[0].mockData.response.data).toEqual({ users: [{ id: 1 }] });
    expect(selectEligibleSimilarMatch(page2, similar)?.mockData.response.data).toEqual({
      users: [{ id: 1 }],
    });
  });
});
