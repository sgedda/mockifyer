import { BaseHTTPClient } from './base-http-client';
import { HTTPRequestConfig, HTTPResponse } from '../types/http-client';

export class FetchHTTPClient extends BaseHTTPClient<any, HTTPResponse<any>> {
  private baseUrl?: string;
  private defaultHeaders: Record<string, string>;

  constructor(config?: { baseUrl?: string; defaultHeaders?: Record<string, string> }) {
    super();
    this.baseUrl = config?.baseUrl;
    this.defaultHeaders = config?.defaultHeaders || {};
  }

  protected async performRequest<D = any>(config: HTTPRequestConfig<D>): Promise<HTTPResponse<any>> {
    const url = this.baseUrl ? new URL(config.url || '', this.baseUrl).toString() : config.url;
    if (!url) {
      throw new Error('URL is required');
    }

    const headers = new Headers({
      ...this.defaultHeaders,
      ...config.headers
    });

    const requestConfig: RequestInit = {
      method: config.method || 'GET',
      headers,
      body: config.data ? JSON.stringify(config.data) : undefined
    };

    const response = await fetch(url, requestConfig);
    const data = await response.json();

    // Convert response Headers to Record<string, string>
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      config
    };
  }

  protected getDefaultHeaders(): Record<string, string> {
    return this.defaultHeaders;
  }

  protected getDefaultConfig(): Record<string, any> {
    return {
      baseUrl: this.baseUrl
    };
  }
} 