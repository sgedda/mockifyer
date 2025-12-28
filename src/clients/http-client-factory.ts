import { HTTPClient } from '../types/http-client';
import { AxiosHTTPClient } from './axios-client';
import { FetchHTTPClient } from './fetch-client';

export type HTTPClientType = 'axios' | 'fetch';

export interface HTTPClientConfig {
  type?: HTTPClientType;
  baseUrl?: string;
  defaultHeaders?: Record<string, string>;
  axiosInstance?: any; // For Axios-specific configuration
}

export function createHTTPClient(config: HTTPClientConfig = {}): HTTPClient {
  console.log('[Mockifyer] ⚡⚡⚡ Creating HTTPClient with config:', config);
  const { type = 'axios', baseUrl, defaultHeaders, axiosInstance } = config;

  switch (type) {
    case 'fetch':
      console.log('[HTTPClientFactory] Creating FetchHTTPClient with config:', config);
      return new FetchHTTPClient({ baseUrl, defaultHeaders });
    case 'axios':
    default:
      return new AxiosHTTPClient(axiosInstance);
  }
} 