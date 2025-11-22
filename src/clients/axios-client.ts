import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { BaseHTTPClient } from './base-http-client';
import { HTTPRequestConfig, HTTPResponse } from '../types/http-client';

export class AxiosHTTPClient extends BaseHTTPClient<any, HTTPResponse<any>> {
  private instance: AxiosInstance;

  constructor(instance?: AxiosInstance) {
    super();
    this.instance = instance || axios.create();
  }

  protected async performRequest<D = any>(config: HTTPRequestConfig<D>): Promise<HTTPResponse<any>> {
    const axiosConfig: AxiosRequestConfig = {
      ...config,
      headers: config.headers,
      params: config.params,
      data: config.data,
      timeout: config.timeout
    };
    
    const response = await this.instance.request(axiosConfig);
    
    // Convert Axios response to generic HTTPResponse
    // Handle both AxiosHeaders object and plain object formats
    const headers: Record<string, string> = {};
    
    // Check if headers is an AxiosHeaders instance (has forEach method) or plain object
    if (response.headers && typeof response.headers === 'object') {
      if (typeof (response.headers as any).forEach === 'function') {
        // It's an AxiosHeaders instance - iterate using forEach
        (response.headers as any).forEach((value: string, key: string) => {
          if (value !== undefined && value !== null) {
            // Preserve original case for custom headers, lowercase standard headers
            const headerKey = key.toLowerCase();
            headers[headerKey] = String(value);
          }
        });
      } else {
        // It's a plain object - use Object.entries
    Object.entries(response.headers).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            headers[key.toLowerCase()] = String(value);
      }
    });
      }
    }

    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers,
      config
    };
  }

  protected getDefaultHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const commonHeaders = this.instance.defaults.headers.common;
    if (commonHeaders) {
      Object.entries(commonHeaders).forEach(([key, value]) => {
        if (value !== undefined) {
          headers[key] = String(value);
        }
      });
    }
    return headers;
  }

  protected getDefaultConfig(): Record<string, any> {
    return {
      ...this.instance.defaults,
      headers: undefined // We handle headers separately
    };
  }
} 