import type { MockifyerConfig } from '../types';
import { parseProxyRecordOnMissEnv } from './proxy-record-on-miss-env';

/**
 * When `proxy.baseUrl` is set and `proxy.recordOnMiss` is omitted, apply `MOCKIFYER_PROXY_RECORD_ON_MISS` if set.
 */
export function applyProxyRecordOnMissEnv(config: MockifyerConfig): MockifyerConfig {
  const proxy = config.proxy;
  const baseUrl = proxy?.baseUrl?.trim();
  if (!proxy || !baseUrl || proxy.recordOnMiss !== undefined) {
    return config;
  }
  const parsed = parseProxyRecordOnMissEnv();
  if (parsed === undefined) {
    return config;
  }
  return {
    ...config,
    proxy: {
      ...proxy,
      baseUrl: proxy.baseUrl,
      recordOnMiss: parsed,
    },
  };
}
