import {
  describeHopChainShape,
  hopEndpointFingerprint,
  isDegenerateHopDaisyChain,
  isNonsensicalServiceChain,
  isShallowClientSessionFanout,
  type HopChainLink,
} from '@sgedda/mockifyer-core';

function hop(partial: HopChainLink): HopChainLink {
  return partial;
}

describe('hop-chain', () => {
  it('fingerprints booking UUIDs as the same endpoint', () => {
    expect(
      hopEndpointFingerprint('GET', 'https://api.example/api/booking/a44837ba-f4d0-4c11-9abc-1234567890ab')
    ).toBe(
      hopEndpointFingerprint('GET', 'https://api.example/api/booking/e0dad828-eb88-4aa1-8def-1234567890ab')
    );
    expect(
      hopEndpointFingerprint('GET', 'https://api.example/api/booking/a44837ba-f4d0-4c11-9abc-1234567890ab')
    ).toBe('GET /api/booking/:id');
  });

  it('treats a flat multi-host client session as a nonsensical service chain', () => {
    const hops: HopChainLink[] = [
      hop({ id: 'root', method: 'HEAD', url: 'https://connectivity.example/generate_204' }),
    ];
    const paths = [
      ['POST', 'https://gql.example/mobile-app/capp-graphql'],
      ['GET', 'https://booking.example/api/booking/11111111-1111-1111-1111-111111111111'],
      ['POST', 'https://auth.example/api/v1/token'],
      ['GET', 'https://weather.example/weather/currentConditions'],
      ['POST', 'https://diag.example/mobile/events/diagnostic'],
      ['GET', 'https://exp.example/WS/Experience/v1/Booked'],
      ['POST', 'https://soap.example/TokenService.asmx'],
      ['GET', 'https://account.example/v-2/myaccount'],
    ];
    for (let i = 0; i < 20; i += 1) {
      const [method, url] = paths[i % paths.length];
      hops.push(
        hop({
          id: `c${i}`,
          parentId: 'root',
          method,
          url,
        })
      );
    }
    const shape = describeHopChainShape(hops);
    expect(shape.maxDepth).toBe(1);
    expect(shape.uniqueHosts).toBeGreaterThanOrEqual(2);
    expect(isShallowClientSessionFanout(shape)).toBe(true);
    expect(isNonsensicalServiceChain(shape)).toBe(true);
  });

  it('treats a two-host dashboard-proxy session as a nonsensical service chain', () => {
    const hops: HopChainLink[] = [
      hop({ id: 'root', method: 'POST', url: 'http://localhost:4000/graphql' }),
    ];
    const paths = [
      ['GET', 'http://localhost:4000/rest/deliveryapi/attributeCollection?id=a'],
      ['GET', 'http://localhost:4000/rest/deliveryapi/attributeCollection?id=b'],
      ['POST', 'http://localhost:4000/rest/deliveryapi/collection'],
      ['POST', 'https://tokenws.acctest.nl/TokenService.asmx'],
      ['GET', 'http://localhost:4000/rest/booking/current'],
      ['POST', 'http://localhost:4000/mobile/events/diagnostic'],
      ['GET', 'http://localhost:4000/v-2/myaccount'],
      ['GET', 'http://localhost:4000/weather/currentConditions'],
    ];
    for (let i = 0; i < 20; i += 1) {
      const [method, url] = paths[i % paths.length];
      hops.push(
        hop({
          id: `c${i}`,
          parentId: 'root',
          method,
          url,
        })
      );
    }
    const shape = describeHopChainShape(hops);
    expect(shape.uniqueHosts).toBe(2);
    expect(shape.maxDepth).toBe(1);
    expect(isShallowClientSessionFanout(shape)).toBe(true);
    expect(isNonsensicalServiceChain(shape)).toBe(true);
  });

  it('keeps a short nested gateway → service → external chain', () => {
    const hops: HopChainLink[] = [
      hop({ id: 'gw', method: 'GET', url: 'http://gateway:3000/aggregate' }),
      hop({
        id: 'cat',
        parentId: 'gw',
        method: 'GET',
        url: 'http://catalog:3001/product/1',
      }),
      hop({
        id: 'ext',
        parentId: 'cat',
        method: 'GET',
        url: 'https://api.example/data',
      }),
    ];
    const shape = describeHopChainShape(hops);
    expect(shape.maxDepth).toBe(2);
    expect(isNonsensicalServiceChain(shape)).toBe(false);
  });

  it('flags a long daisy-chain of parent links', () => {
    const hops: HopChainLink[] = [];
    for (let i = 0; i < 20; i += 1) {
      hops.push(
        hop({
          id: `h${i}`,
          parentId: i === 0 ? null : `h${i - 1}`,
          method: 'GET',
          url: `https://api.example/step/${i}`,
        })
      );
    }
    const shape = describeHopChainShape(hops);
    expect(isDegenerateHopDaisyChain(shape)).toBe(true);
    expect(isNonsensicalServiceChain(shape)).toBe(true);
  });
});
