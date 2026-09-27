import { isFetchProxyTwin, PROXY_TWIN_WINDOW_MS } from '../packages/mockifyer-core/src/utils/network-event-twins';
import {
  isFetchProxyTwin as isFetchProxyTwinFromRnEntry,
  buildAtlasLiveStreamHtml,
} from '../packages/mockifyer-core/src/index.react-native';

const fetchSide = {
  requestId: 'myaccount-hop',
  parentRequestId: 'gql-a',
  transport: 'fetch',
  timestamp: '2026-09-27T20:15:31.168Z',
};
const proxySide = {
  requestId: 'myaccount-hop',
  parentRequestId: 'gql-a',
  transport: 'proxy',
  timestamp: '2026-09-27T20:15:37.984Z',
  durationMs: 6727,
};

describe('isFetchProxyTwin', () => {
  it('pairs the service-side and proxy-side record of one call', () => {
    expect(isFetchProxyTwin(fetchSide, proxySide, PROXY_TWIN_WINDOW_MS)).toBe(true);
    expect(isFetchProxyTwin(proxySide, fetchSide, PROXY_TWIN_WINDOW_MS)).toBe(true);
  });

  it('keeps separate calls that reuse a stored hop id', () => {
    const laterCall = { ...fetchSide, timestamp: '2026-09-27T20:18:40.000Z' };
    expect(isFetchProxyTwin(laterCall, proxySide, PROXY_TWIN_WINDOW_MS)).toBe(false);
    expect(isFetchProxyTwin({ ...fetchSide, parentRequestId: 'gql-b' }, proxySide, PROXY_TWIN_WINDOW_MS)).toBe(false);
  });

  it('only pairs one fetch record with one proxy record', () => {
    expect(isFetchProxyTwin(fetchSide, { ...fetchSide }, PROXY_TWIN_WINDOW_MS)).toBe(false);
    expect(isFetchProxyTwin(proxySide, { ...proxySide }, PROXY_TWIN_WINDOW_MS)).toBe(false);
    expect(isFetchProxyTwin({ ...fetchSide, requestId: '' }, proxySide, PROXY_TWIN_WINDOW_MS)).toBe(false);
    expect(isFetchProxyTwin({}, proxySide, PROXY_TWIN_WINDOW_MS)).toBe(false);
  });

  it('is exported on the React Native entry and embedded in the live page', () => {
    expect(isFetchProxyTwinFromRnEntry).toBe(isFetchProxyTwin);
    const html = buildAtlasLiveStreamHtml();
    expect(html).toContain('var isFetchProxyTwin = function isFetchProxyTwin(');
    expect(html).toContain(`var PROXY_TWIN_WINDOW_MS = ${PROXY_TWIN_WINDOW_MS};`);
  });
});
