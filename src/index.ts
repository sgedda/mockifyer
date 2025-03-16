import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import fs from 'fs';
import path from 'path';
import { MockifyerConfig, MockData, StoredRequest, StoredResponse } from './types';
import { initializeDateManipulation } from './utils/date';

class MockifyerClass {
  private config: MockifyerConfig;
  private mockAdapter?: MockAdapter;
  private mockDataCache: Map<string, MockData> = new Map();
  private axiosInstance: AxiosInstance;

  constructor(config: MockifyerConfig) {
    this.config = config;
    this.ensureMockDataDirectory();
    
    // If autoMock is true and we're using the default axios instance
    if (config.autoMock && config.useGlobalAxios) {
      this.axiosInstance = axios;
    } else {
      // Create a new instance for non-global usage
      this.axiosInstance = axios.create();
    }
    
    if (!config.recordMode) {
      this.loadMockData();
      this.mockAdapter = new MockAdapter(this.axiosInstance, { onNoMatch: 'passthrough' });
      this.setupMockResponses();
    } else {
      this.setupInterceptors();
    }
  }

  private ensureMockDataDirectory(): void {
    if (!fs.existsSync(this.config.mockDataPath)) {
      fs.mkdirSync(this.config.mockDataPath, { recursive: true });
    }
  }

  private generateRequestKey(request: StoredRequest): string {
    const { method, url, data, queryParams } = request;
    const relevantHeaders = this.filterRelevantHeaders(request.headers);
    return JSON.stringify({
      method,
      url,
      data,
      queryParams: this.filterQueryParams(queryParams || {}),
      headers: relevantHeaders
    });
  }

  private filterRelevantHeaders(headers: Record<string, string>): Record<string, string> {
    if (!this.config.requestMatching?.headers) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(headers).filter(([key]) => 
        this.config.requestMatching!.headers!.includes(key.toLowerCase())
      )
    );
  }

  private filterQueryParams(params: Record<string, string>): Record<string, string> {
    if (!this.config.requestMatching?.ignoreQueryParams) {
      return params;
    }
    return Object.fromEntries(
      Object.entries(params).filter(([key]) => 
        !this.config.requestMatching!.ignoreQueryParams!.includes(key)
      )
    );
  }

  private loadMockData(): void {
    if (fs.existsSync(this.config.mockDataPath)) {
      const files = fs.readdirSync(this.config.mockDataPath);
      files.forEach(file => {
        if (file.endsWith('.json')) {
          const mockData: MockData = JSON.parse(
            fs.readFileSync(path.join(this.config.mockDataPath, file), 'utf-8')
          );
          const key = this.generateRequestKey(mockData.request);
          this.mockDataCache.set(key, mockData);
        }
      });
    }
  }

  private setupMockResponses(): void {
    if (!this.mockAdapter) {
      throw new Error('MockAdapter not initialized');
    }

    this.mockAdapter.onAny().reply((config: AxiosRequestConfig) => {
      const request: StoredRequest = {
        method: config.method?.toUpperCase() || 'GET',
        url: config.url || '',
        headers: config.headers as Record<string, string>,
        data: config.data,
        queryParams: config.params
      };

      const key = this.generateRequestKey(request);
      const mockData = this.mockDataCache.get(key);

      if (mockData) {
        return [
          mockData.response.status,
          mockData.response.data,
          mockData.response.headers
        ];
      }

      // If autoMock is true, we should fail when no mock is found
      if (this.config.autoMock) {
        throw new Error(`No mock data found for request: ${key}`);
      }

      // For non-autoMock mode, the onNoMatch: 'passthrough' option will handle this
      return [404, { error: 'No mock data found' }];
    });
  }

  private setupInterceptors(): void {
    // Add mockifyer flag to identify mocked instances
    (this.axiosInstance as any).__mockifyer = true;

    // Add response interceptor to record responses
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        console.log('[Mockifyer] Recording response for:', {
          method: response.config.method?.toUpperCase() || 'GET',
          url: response.config.url
        });
        this.saveResponse(response);
        return response;
      },
      (error) => {
        if (error.response) {
          console.log('[Mockifyer] Recording error response for:', {
            method: error.response.config.method?.toUpperCase() || 'GET',
            url: error.response.config.url,
            status: error.response.status
          });
          this.saveResponse(error.response);
        }
        return Promise.reject(error);
      }
    );
  }

  private saveResponse(response: AxiosResponse): void {
    const request: StoredRequest = {
      method: response.config.method?.toUpperCase() || 'GET',
      url: response.config.url || '',
      headers: response.config.headers as Record<string, string>,
      data: response.config.data,
      queryParams: response.config.params
    };

    const storedResponse: StoredResponse = {
      status: response.status,
      data: response.data,
      headers: response.headers as Record<string, string>
    };

    const mockData: MockData = {
      request,
      response: storedResponse,
      timestamp: new Date().toISOString(),
      scenario: this.config.scenarios?.default
    };

    const filename = `${Date.now()}_${request.method}_${request.url.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    fs.writeFileSync(
      path.join(this.config.mockDataPath, filename),
      JSON.stringify(mockData, null, 2)
    );
  }

  public getAxiosInstance(): AxiosInstance {
    return this.axiosInstance;
  }
}

export function setupMockifyer(config: MockifyerConfig): AxiosInstance {
  // Initialize date manipulation
  initializeDateManipulation(config);

  const mockifyer = new MockifyerClass(config);
  return mockifyer.getAxiosInstance();
}

// Re-export date utilities and types
export * from './utils/date';
export * from './types'; 