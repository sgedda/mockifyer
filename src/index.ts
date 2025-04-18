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
    console.log('[Mockifyer] record mode:', config.recordMode);
    if(!config.recordSameEndpoints) {
      this.loadMockData();
    }
    if (!config.recordMode) {
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
    const normalizedUrl = request.url.toLowerCase();
    const normalizedMethod = request.method.toUpperCase();
    const queryString = request.queryParams ? new URLSearchParams(request.queryParams).toString() : '';
    return `${normalizedMethod}:${normalizedUrl}${queryString ? '?' + queryString : ''}`;
  }

  private async findBestMatchingMock(request: StoredRequest): Promise<MockData | undefined> {
    const requestKey = this.generateRequestKey(request);
    console.log('[Mockifyer] requestKey:', requestKey);
    console.log('[Mockifyer] mockDataCache:', this.mockDataCache);
    
    // Try exact match first
    const exactMatch = this.mockDataCache.get(requestKey);
    if (exactMatch) {
      console.log(`[Mockifyer] Using exact mock match for ${requestKey}`);
      return exactMatch;
    }

    console.log('[Mockifyer] useSimilarMatch:', this.config.useSimilarMatch);
    // If no exact match and useSimilarMatch is true, try to find a similar match
    if (this.config.useSimilarMatch) {
      const requestUrl = new URL(request.url);
      const requestPath = requestUrl.pathname;
      
      for (const [key, mockData] of this.mockDataCache.entries()) {
        const mockUrl = new URL(mockData.request.url);
        const mockPath = mockUrl.pathname;
        
        console.log('[Mockifyer] mockPath:', mockPath);
        console.log('[Mockifyer] requestPath:', requestPath);
        
        // Only match on path and method, ignore query parameters
        if (mockPath === requestPath && mockData.request.method === request.method) {
          // If useSimilarMatchCheckResponse is true, make the actual request and compare
          if (this.config.useSimilarMatchCheckResponse) {
            const requestParams = request.queryParams || {};
            const mockParams = mockData.request.queryParams || {};
            
            console.log('[Mockifyer] requestParams:', requestParams);
            console.log('[Mockifyer] mockParams:', mockParams);
            
            try {
              // Make the actual request
              const response = await this.axiosInstance.request({
                method: request.method,
                url: request.url,
                params: requestParams
              });
              
              // Compare the actual response with mock data
              const actualResponseStr = JSON.stringify(response.data);
              const mockResponseStr = JSON.stringify(mockData.response.data);
              
              console.log('[Mockifyer] Comparing responses:', {
                actual: actualResponseStr,
                mock: mockResponseStr
              });
              
              if (actualResponseStr === mockResponseStr) {
                console.log(`[Mockifyer] Using similar mock match for ${requestKey} (matched path: ${mockPath})`);
                return mockData;
              } else {
                console.log(`[Mockifyer] Similar path match found but response content differs: ${key}`);
                continue;
              }
            } catch (error) {
              console.error('[Mockifyer] Error making request for comparison:', error);
              continue;
            }
          } else {
            console.log(`[Mockifyer] Using similar mock match for ${requestKey} (matched path: ${mockPath})`);
            return mockData;
          }
        }
      }
    }

    return undefined;
  }

  private loadMockData(): void {
    console.log('[Mockifyer] Loading mock data from:', this.config.mockDataPath);
    if (fs.existsSync(this.config.mockDataPath)) {
      const files = fs.readdirSync(this.config.mockDataPath);
      console.log('[Mockifyer] Found files:', files);
      
      let loadedCount = 0;
      files.forEach(file => {
        if (file.endsWith('.json')) {
          const mockData: MockData = JSON.parse(
            fs.readFileSync(path.join(this.config.mockDataPath, file), 'utf-8')
          );
          const key = this.generateRequestKey(mockData.request);
          console.log('[Mockifyer] Loading mock:', key);
          this.mockDataCache.set(key, mockData);
          loadedCount++;
        }
      });
      console.log('[Mockifyer] Loaded', loadedCount, 'mock files into cache');
      console.log('[Mockifyer] Cache size:', this.mockDataCache.size);
    } else {
      console.log('[Mockifyer] Mock data directory does not exist:', this.config.mockDataPath);
    }
  }

  private setupMockResponses(): void {
    if (!this.mockAdapter) {
      throw new Error('MockAdapter not initialized');
    }

    this.mockAdapter.onAny().reply(async (config: AxiosRequestConfig) => {
      const request: StoredRequest = {
        method: config.method?.toUpperCase() || 'GET',
        url: config.url || '',
        headers: config.headers as Record<string, string>,
        data: config.data,
        queryParams: config.params
      };

      const mockData = await this.findBestMatchingMock(request);
      console.log('[Mockifyer] mockData:', mockData);
      if (mockData) {
        // Add mockifyer headers to indicate this is a mocked response
        const responseHeaders = {
          ...mockData.response.headers,
          'x-mockifyer': 'true',
          'x-mockifyer-timestamp': mockData.timestamp
        };

        return [
          mockData.response.status,
          mockData.response.data,
          responseHeaders
        ];
      }

      console.log('[Mockifyer] autoMock:', this.config.autoMock);
      // If autoMock is true, we should fail when no mock is found
      if (this.config.autoMock) {
        const errorMessage = `No mock data found for request: ${this.generateRequestKey(request)}`;
        console.error(`[Mockifyer] ${errorMessage}`);
        throw new Error(errorMessage);
      }

      console.log(`[Mockifyer] No mock found for ${this.generateRequestKey(request)}, passing through to real API`);
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
        console.log('[Mockifyer] öööööö Recording response for:', {
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

  private async saveResponse(response: AxiosResponse): Promise<void> {
    const request: StoredRequest = {
      method: response.config.method?.toUpperCase() || 'GET',
      url: response.config.url || '',
      headers: response.config.headers as Record<string, string>,
      data: response.config.data,
      queryParams: response.config.params || {}
    };

    // Always check cache first, unless recordSameEndpoints is true
    if (this.config.recordSameEndpoints !== true) {
      const existingMock = await this.findBestMatchingMock(request);
      if (existingMock) {
        console.log(`[Mockifyer] Using existing mock for endpoint: ${request.url}`);
        return;
      }
    }

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

    // Add to cache immediately
    const key = this.generateRequestKey(request);
    this.mockDataCache.set(key, mockData);
    console.log(`[Mockifyer] Added new mock to cache: ${key}`);
    console.log('[Mockifyer] mockDataCache:', this.mockDataCache);

    // Format the datetime to be readable
    const now = new Date();
    const dateStr = now.toISOString()
      .replace(/T/, '_')
      .replace(/\..+/, '')
      .replace(/:/g, '-');

    // Create a safe filename from the URL
    const urlSafe = request.url
      .replace(/^https?:\/\//, '')
      .replace(/[^a-zA-Z0-9]/g, '_');

    const filename = `${dateStr}_${request.method}_${urlSafe}.json`;
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