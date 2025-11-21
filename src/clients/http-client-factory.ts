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
  const { type = 'axios', baseUrl, defaultHeaders, axiosInstance } = config;

  switch (type) {
    case 'fetch':
      return new FetchHTTPClient({ baseUrl, defaultHeaders });
    case 'axios':
    default:
      return new AxiosHTTPClient(axiosInstance);
  }
} 