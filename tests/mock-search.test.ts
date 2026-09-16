import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  compileMockSearch,
  parseSearchQuery,
  retainCandidatesForToken,
  searchJsonFilesOnDisk,
} from '../packages/mockifyer-dashboard/src/utils/mock-search';

describe('parseSearchQuery', () => {
  it('splits on whitespace into AND tokens', () => {
    expect(parseSearchQuery('  POST   /users ')).toEqual(['POST', '/users']);
  });

  it('keeps quoted phrases as a single token', () => {
    expect(parseSearchQuery('status: "not found" GET')).toEqual(['status:', 'not found', 'GET']);
  });

  it('returns an empty list for blank input', () => {
    expect(parseSearchQuery('')).toEqual([]);
    expect(parseSearchQuery('   ')).toEqual([]);
    expect(parseSearchQuery(undefined)).toEqual([]);
  });
});

describe('retainCandidatesForToken', () => {
  it('keeps path-only hits for the ripgrep token so filename+body AND still works', () => {
    const scenarioPath = '/mocks/default';
    const needContent = [
      '/mocks/default/graphql/POST_GetBookingDetails.json',
      '/mocks/default/noise.json',
    ];
    const kept = retainCandidatesForToken({
      needContent,
      scenarioPath,
      token: 'GetBookingDetails',
      contentHits: [],
    });
    expect(kept).toEqual(['/mocks/default/graphql/POST_GetBookingDetails.json']);
  });
});

describe('compileMockSearch', () => {
  it('matches case-insensitively across filename or raw JSON', () => {
    const matches = compileMockSearch(['Bookings', 'OPEN']);
    expect(matches('api/GET_bookings.json', '{"status":"closed"}')).toBe(false);
    expect(matches('api/GET_bookings.json', '{"status":"open"}')).toBe(true);
    expect(matches('other.json', '{"endpoint":"bookings","status":"OPEN"}')).toBe(true);
  });

  it('does not scan raw JSON when the filename already satisfies every token', () => {
    const matches = compileMockSearch(['graphql', 'GetUser']);
    expect(matches('host/graphql/GET_GetUser.json', '')).toBe(true);
  });
});

describe('searchJsonFilesOnDisk', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-search-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('prefers filename hits and finds tokens in response bodies', async () => {
    fs.writeFileSync(
      path.join(tmp, 'GET_bookings.json'),
      JSON.stringify({ request: { url: 'https://api.example.com/other' }, response: { data: { n: 1 } } })
    );
    fs.writeFileSync(
      path.join(tmp, 'users.json'),
      JSON.stringify({
        request: { url: 'https://api.example.com/users' },
        response: { data: { secretToken: 'unique-body-needle-xyz' } },
      })
    );
    fs.writeFileSync(
      path.join(tmp, 'noise.json'),
      JSON.stringify({ request: { url: 'https://api.example.com/noise' }, response: { data: {} } })
    );

    const byName = await searchJsonFilesOnDisk(tmp, ['bookings'], 10);
    expect(byName.hits.map((h) => h.relativeName)).toEqual(['GET_bookings.json']);

    const byBody = await searchJsonFilesOnDisk(tmp, ['unique-body-needle-xyz'], 10);
    expect(byBody.hits.map((h) => h.relativeName)).toEqual(['users.json']);

    const both = await searchJsonFilesOnDisk(tmp, ['users', 'unique-body-needle-xyz'], 10);
    expect(both.hits.map((h) => h.relativeName)).toEqual(['users.json']);
  });

  it('stops after the limit', async () => {
    for (let i = 0; i < 6; i++) {
      fs.writeFileSync(path.join(tmp, `hit-${i}.json`), JSON.stringify({ marker: 'shared-token' }));
    }
    const result = await searchJsonFilesOnDisk(tmp, ['shared-token'], 3);
    expect(result.hits).toHaveLength(3);
    expect(result.truncated).toBe(true);
  });
});
