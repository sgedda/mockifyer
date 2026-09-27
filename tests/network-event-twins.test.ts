import {
  isFetchProxyTwin,
  NETWORK_EVENT_TWINNED_KEY,
} from '../packages/mockifyer-core/src/utils/network-event-twins';
import {
  isFetchProxyTwin as isFetchProxyTwinFromRnEntry,
  buildAtlasLiveStreamHtml,
} from '../packages/mockifyer-core/src/index.react-native';

const fetchSide = { requestId: 'myaccount-hop', parentRequestId: 'gql-a', transport: 'fetch' };
const proxySide = { requestId: 'myaccount-hop', parentRequestId: 'gql-a', transport: 'proxy' };

describe('isFetchProxyTwin', () => {
  it('pairs the service-side and proxy-side record of one call in either order', () => {
    expect(isFetchProxyTwin(fetchSide, proxySide)).toBe(true);
    expect(isFetchProxyTwin(proxySide, fetchSide)).toBe(true);
  });

  it('pairs axios service-side and proxy-side records', () => {
    const axiosSide = { ...fetchSide, transport: 'axios' };
    expect(isFetchProxyTwin(axiosSide, proxySide)).toBe(true);
    expect(isFetchProxyTwin(proxySide, axiosSide)).toBe(true);
  });

  it('keeps calls from other parents and same-side records apart', () => {
    expect(isFetchProxyTwin({ ...fetchSide, parentRequestId: 'gql-b' }, proxySide)).toBe(false);
    expect(isFetchProxyTwin(fetchSide, { ...fetchSide, transport: 'axios' })).toBe(false);
    expect(isFetchProxyTwin(proxySide, { ...proxySide })).toBe(false);
    expect(isFetchProxyTwin({ ...fetchSide, requestId: '' }, proxySide)).toBe(false);
    expect(isFetchProxyTwin({}, proxySide)).toBe(false);
  });

  it('pairs each record once, so a later call reusing the hop ids stays its own row', () => {
    const pairedProxy = { ...proxySide, [NETWORK_EVENT_TWINNED_KEY]: true };
    expect(isFetchProxyTwin(fetchSide, pairedProxy)).toBe(false);
    expect(isFetchProxyTwin(pairedProxy, fetchSide)).toBe(false);
  });

  it('is exported on the React Native entry and embedded in the live page', () => {
    expect(isFetchProxyTwinFromRnEntry).toBe(isFetchProxyTwin);
    const html = buildAtlasLiveStreamHtml();
    expect(html).toContain('var isFetchProxyTwin = function isFetchProxyTwin(');
    expect(html).toContain(`var TWINNED_KEY = ${JSON.stringify(NETWORK_EVENT_TWINNED_KEY)};`);
    expect(isFetchProxyTwin.toString()).toContain(NETWORK_EVENT_TWINNED_KEY);
  });
});
