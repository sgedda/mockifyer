/** Node barrel — re-exports client serialize + dashboard upstream builders. */
export type { ProxySerializedBody } from './proxy-request-body-types';
export {
  isProxySerializedBody,
  normalizeProxyBodyForRequestKey,
} from './proxy-request-body-types';
export { serializeProxyRequestBody } from './serialize-proxy-request-body';
export {
  buildProxyUpstreamBodyInit,
  type ProxyUpstreamBodyInit,
} from './build-proxy-upstream-body-init';
