import {
  inboundHopIdBelongsToOtherEndpoint,
  registerHopOwner,
  resetHopOwnerRegistry,
  resolveRecordedHopIdentity,
  sameHopOwnerEndpoint,
} from '@sgedda/mockifyer-core';

describe('hop identity (exact parent links)', () => {
  beforeEach(() => {
    resetHopOwnerRegistry();
  });

  it('treats relative and absolute URLs as the same endpoint', () => {
    expect(
      sameHopOwnerEndpoint(
        { method: 'GET', url: 'https://capi.example/v-2/myaccount/' },
        { method: 'get', url: '/v-2/myaccount/' }
      )
    ).toBe(true);
    expect(
      sameHopOwnerEndpoint(
        { method: 'POST', url: 'http://localhost:4000/graphql' },
        { method: 'GET', url: 'http://localhost:4000/graphql' }
      )
    ).toBe(false);
  });

  it('keeps a freshly minted inbound id as this hop', () => {
    const identity = resolveRecordedHopIdentity({
      inboundRequestId: 'gql-1',
      method: 'POST',
      url: 'http://localhost:4000/graphql',
    });
    expect(identity).toEqual({ requestId: 'gql-1' });
  });

  it('uses a reused caller id as parent when that id already belongs to another endpoint', () => {
    registerHopOwner({
      requestId: 'gql-1',
      method: 'POST',
      url: 'http://localhost:4000/graphql',
    });
    expect(inboundHopIdBelongsToOtherEndpoint('gql-1', 'GET', 'https://capi.example/v-2/myaccount/')).toBe(
      true
    );

    const identity = resolveRecordedHopIdentity({
      inboundRequestId: 'gql-1',
      method: 'GET',
      url: 'https://capi.example/v-2/myaccount/',
    });
    expect(identity.parentRequestId).toBe('gql-1');
    expect(identity.requestId).toBeTruthy();
    expect(identity.requestId).not.toBe('gql-1');
  });

  it('adopts the stored hop id when the inbound id is the caller', () => {
    registerHopOwner({
      requestId: 'gql-1',
      method: 'POST',
      url: 'http://localhost:4000/graphql',
    });
    const identity = resolveRecordedHopIdentity({
      inboundRequestId: 'gql-1',
      method: 'GET',
      url: 'https://capi.example/v-2/myaccount/',
      storedRequestId: 'acct-stored',
    });
    expect(identity).toEqual({ requestId: 'acct-stored', parentRequestId: 'gql-1' });
  });

  it('does not steal the id when the same endpoint refreshes', () => {
    registerHopOwner({
      requestId: 'gql-1',
      method: 'POST',
      url: 'http://localhost:4000/graphql',
    });
    const identity = resolveRecordedHopIdentity({
      inboundRequestId: 'gql-1',
      inboundParentRequestId: 'client-root',
      method: 'POST',
      url: 'http://localhost:4000/graphql',
      storedRequestId: 'gql-1',
    });
    expect(identity).toEqual({ requestId: 'gql-1', parentRequestId: 'client-root' });
  });

  it('remints when the stored hop id is the stolen caller id', () => {
    registerHopOwner({
      requestId: 'gql-1',
      method: 'POST',
      url: 'http://localhost:4000/graphql',
    });
    const identity = resolveRecordedHopIdentity({
      inboundRequestId: 'gql-1',
      method: 'GET',
      url: 'https://capi.example/v-2/myaccount/',
      storedRequestId: 'gql-1',
    });
    expect(identity.parentRequestId).toBe('gql-1');
    expect(identity.requestId).toBeTruthy();
    expect(identity.requestId).not.toBe('gql-1');
  });
});
