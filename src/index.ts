import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosHeaders } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import fs from 'fs';
import path from 'path';
import { MockifyerConfig, MockData, StoredRequest, StoredResponse } from './types';
import { initializeDateManipulation } from './utils/date';
import { createHTTPClient, HTTPClientConfig } from './clients/http-client-factory';
import { HTTPClient, HTTPResponse } from './types/http-client';

interface CachedMockData {
  mockData: MockData;
  filename: string;
  filePath: string;
}

class MockifyerClass {
  private config: MockifyerConfig;
  private mockAdapter?: MockAdapter;
  private mockDataCache: Map<string, CachedMockData> = new Map();
  private httpClient: HTTPClient;

  constructor(config: MockifyerConfig) {
    // Validate and normalize conflicting settings
    if (config.recordMode && config.failOnMissingMock) {
      console.warn(
        '[Mockifyer] Warning: recordMode is true but failOnMissingMock is also set to true. ' +
        'failOnMissingMock is ignored in record mode (real API calls are made to record responses). ' +
        'Setting failOnMissingMock to false.'
      );
      config.failOnMissingMock = false;
    }
    
    this.config = config;
    this.ensureMockDataDirectory();
    
    // Create HTTP client based on configuration
    const httpClientConfig: HTTPClientConfig = {
      type: config.httpClientType || 'axios',
      baseUrl: config.baseUrl,
      defaultHeaders: config.defaultHeaders,
      axiosInstance: config.axiosInstance
    };
    
    this.httpClient = createHTTPClient(httpClientConfig);
    
    console.log('[Mockifyer] record mode:', config.recordMode);
    if(!config.recordSameEndpoints) {
      this.loadMockData();
    }
    if (!config.recordMode) {
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

  private async findBestMatchingMock(request: StoredRequest): Promise<CachedMockData | undefined> {
    const requestKey = this.generateRequestKey(request);
    console.log('[Mockifyer] requestKey:', requestKey);
    console.log('[Mockifyer] mockDataCache:', this.mockDataCache);
    
    // Try exact match first
    const exactMatch = this.mockDataCache.get(requestKey);
    if (exactMatch) {
      // Check if the file still exists - if not, remove from cache
      if (!fs.existsSync(exactMatch.filePath)) {
        console.log(`[Mockifyer] Cached mock file no longer exists: ${exactMatch.filePath}, removing from cache`);
        this.mockDataCache.delete(requestKey);
      } else {
      console.log(`[Mockifyer] Using exact mock match for ${requestKey}`);
      return exactMatch;
      }
    }

    console.log('[Mockifyer] useSimilarMatch:', this.config.useSimilarMatch);
    // If no exact match and useSimilarMatch is true, try to find a similar match
    if (this.config.useSimilarMatch) {
      const requestUrl = new URL(request.url);
      const requestPath = requestUrl.pathname;
      
      for (const [key, cachedMock] of this.mockDataCache.entries()) {
        // Check if the file still exists - if not, skip this cached entry
        if (!fs.existsSync(cachedMock.filePath)) {
          console.log(`[Mockifyer] Cached mock file no longer exists: ${cachedMock.filePath}, skipping`);
          continue;
        }
        
        const mockData = cachedMock.mockData;
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
              const response = await this.httpClient.request({
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
                return cachedMock;
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
            return cachedMock;
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
          const filePath = path.join(this.config.mockDataPath, file);
          const mockData: MockData = JSON.parse(
            fs.readFileSync(filePath, 'utf-8')
          );
          const key = this.generateRequestKey(mockData.request);
          console.log('[Mockifyer] Loading mock:', key, 'from file:', file);
          this.mockDataCache.set(key, {
            mockData,
            filename: file,
            filePath: filePath
          });
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
    // Add request interceptor to handle mock responses
    this.httpClient.interceptors.request.use(async (config) => {
      const request: StoredRequest = {
        method: config.method || 'GET',
        url: config.url || '',
        headers: config.headers || {},
        data: config.data,
        queryParams: config.params
      };

      const cachedMock = await this.findBestMatchingMock(request);
      if (cachedMock) {
        const { mockData, filename, filePath } = cachedMock;
        // Add mockifyer headers to indicate this is a mocked response
        const responseHeaders = {
          ...mockData.response.headers,
          'x-mockifyer': 'true',
          'x-mockifyer-timestamp': mockData.timestamp,
          'x-mockifyer-filename': filename,
          'x-mockifyer-filepath': filePath
        };

        // Return a mock response using adapter (axios-specific)
        // The adapter bypasses the actual HTTP call and returns a mock response
        // Use AxiosHeaders to ensure headers are properly preserved
        const axiosHeaders = new AxiosHeaders();
        Object.entries(responseHeaders).forEach(([key, value]) => {
          axiosHeaders.set(key, value);
        });
        
        const mockResponse: AxiosResponse = {
          data: mockData.response.data,
          status: mockData.response.status,
          statusText: 'OK',
          headers: axiosHeaders,
          config: config as any, // AxiosResponse expects InternalAxiosRequestConfig
          request: {}
        };
        
        console.log('[Mockifyer] Returning mock response with headers:', Object.keys(responseHeaders));
        console.log('[Mockifyer] Mock headers:', responseHeaders);
        console.log('[Mockifyer] AxiosHeaders keys:', Array.from(axiosHeaders.keys()));
        console.log('[Mockifyer] Checking x-mockifyer in AxiosHeaders:', axiosHeaders.get('x-mockifyer'));
        
        return {
          ...config,
          adapter: () => {
            console.log('[Mockifyer] Adapter called, returning mock response');
            console.log('[Mockifyer] Mock response headers type:', typeof mockResponse.headers);
            console.log('[Mockifyer] Mock response headers forEach:', typeof (mockResponse.headers as any).forEach);
            return Promise.resolve(mockResponse);
          }
        } as any;
      }

      if (this.config.failOnMissingMock) {
        throw new Error(`No mock data found for request: ${this.generateRequestKey(request)}`);
      }

      return config;
    });
  }

  private setupInterceptors(): void {
    // In record mode, only check for mocks if recordSameEndpoints is false
    // This allows re-recording when recordSameEndpoints is true
    // When recordSameEndpoints is false, use existing mocks to avoid unnecessary API calls
    if (this.config.recordSameEndpoints !== true) {
      this.httpClient.interceptors.request.use(async (config) => {
        const request: StoredRequest = {
          method: config.method || 'GET',
          url: config.url || '',
          headers: config.headers || {},
          data: config.data,
          queryParams: config.params
        };

        const cachedMock = await this.findBestMatchingMock(request);
        if (cachedMock) {
          // Use existing mock instead of making real API call
          // This is correct behavior - we have a mock, so use it
          const { mockData, filename, filePath } = cachedMock;
          const responseHeaders = {
            ...mockData.response.headers,
            'x-mockifyer': 'true',
            'x-mockifyer-timestamp': mockData.timestamp,
            'x-mockifyer-filename': filename,
            'x-mockifyer-filepath': filePath
          };

          const axiosHeaders = new AxiosHeaders();
          Object.entries(responseHeaders).forEach(([key, value]) => {
            axiosHeaders.set(key, value);
          });

          const mockResponse: AxiosResponse = {
            data: mockData.response.data,
            status: mockData.response.status,
            statusText: 'OK',
            headers: axiosHeaders,
            config: config as any,
            request: {}
          };

          console.log('[Mockifyer] Using existing mock in record mode (recordSameEndpoints=false), skipping real API call');
          
          return {
            ...config,
            adapter: () => {
              console.log('[Mockifyer] Adapter called in record mode, returning mock response');
              return Promise.resolve(mockResponse);
            }
          } as any;
        }
        
        // No mock found - will make real API call (this is correct)
        console.log('[Mockifyer] No mock found, will make real API call in record mode');
        return config;
      });
    } else {
      // recordSameEndpoints is true - always make real API calls, don't check for mocks
      console.log('[Mockifyer] recordSameEndpoints=true, will always make real API calls');
    }

    // Add response interceptor to record responses (only for real API calls)
    // Skip recording if this is a mocked response (has x-mockifyer header)
    this.httpClient.interceptors.response.use(
      (response) => {
        // Check if this is a mocked response - if so, don't record it
        const isMocked = response.headers && (
          (typeof (response.headers as any).get === 'function' && (response.headers as any).get('x-mockifyer') === 'true') ||
          (typeof response.headers === 'object' && !Array.isArray(response.headers) && (response.headers as any)['x-mockifyer'] === 'true')
        );
        
        if (isMocked) {
          console.log('[Mockifyer] Skipping recording - this is a mocked response');
          return response;
        }
        
        console.log('[Mockifyer] Recording response for:', {
          method: response.config.method?.toUpperCase() || 'GET',
          url: response.config.url
        });
        this.saveResponse(response as HTTPResponse);
        return response;
      },
      (error) => {
        if (error.response) {
          // Check if this is a mocked error response
          const isMocked = error.response.headers && (
            (typeof (error.response.headers as any).get === 'function' && (error.response.headers as any).get('x-mockifyer') === 'true') ||
            (typeof error.response.headers === 'object' && !Array.isArray(error.response.headers) && (error.response.headers as any)['x-mockifyer'] === 'true')
          );
          
          if (isMocked) {
            console.log('[Mockifyer] Skipping recording - this is a mocked error response');
            return Promise.reject(error);
          }
          
          console.log('[Mockifyer] Recording error response for:', {
            method: error.response.config.method?.toUpperCase() || 'GET',
            url: error.response.config.url,
            status: error.response.status
          });
          this.saveResponse(error.response as HTTPResponse);
        }
        return Promise.reject(error);
      }
    );
  }

  private async saveResponse(response: HTTPResponse): Promise<void> {
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
    const filePath = path.join(this.config.mockDataPath, filename);
    
    // Add to cache immediately
    const key = this.generateRequestKey(request);
    this.mockDataCache.set(key, {
      mockData,
      filename,
      filePath
    });
    console.log(`[Mockifyer] Added new mock to cache: ${key}`);
    console.log('[Mockifyer] mockDataCache:', this.mockDataCache);

    fs.writeFileSync(filePath, JSON.stringify(mockData, null, 2));
  }

  public getHTTPClient(): HTTPClient {
    return this.httpClient;
  }

  /**
   * Reload mock data from the filesystem, clearing the cache first
   * Useful when mock files are added, removed, or modified
   */
  public reloadMockData(): void {
    console.log('[Mockifyer] Reloading mock data...');
    this.mockDataCache.clear();
    this.loadMockData();
  }

  /**
   * Clear stale cache entries (remove entries where files no longer exist)
   * Returns the number of entries removed
   */
  public clearStaleCacheEntries(): number {
    let removedCount = 0;
    for (const [key, cachedMock] of this.mockDataCache.entries()) {
      if (!fs.existsSync(cachedMock.filePath)) {
        console.log(`[Mockifyer] Removing stale cache entry: ${key} (file: ${cachedMock.filename})`);
        this.mockDataCache.delete(key);
        removedCount++;
      }
    }
    if (removedCount > 0) {
      console.log(`[Mockifyer] Removed ${removedCount} stale cache entries`);
    }
    return removedCount;
  }
}

export interface MockifyerInstance extends HTTPClient {
  reloadMockData: () => void;
  clearStaleCacheEntries: () => number;
}

export function setupMockifyer(config: MockifyerConfig): MockifyerInstance {
  // Initialize date manipulation
  initializeDateManipulation(config);

  const mockifyer = new MockifyerClass(config);
  const httpClient = mockifyer.getHTTPClient();
  
  // Extend the HTTPClient with cache management methods
  return Object.assign(httpClient, {
    reloadMockData: () => mockifyer.reloadMockData(),
    clearStaleCacheEntries: () => mockifyer.clearStaleCacheEntries()
  }) as MockifyerInstance;
}

// Re-export date utilities and types
export * from './utils/date';
export * from './types';
export * from './clients/http-client-factory';
export * from './types/http-client'; 