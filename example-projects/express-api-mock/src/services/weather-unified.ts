import { HTTPClient } from '@sgedda/mockifyer-core';
import { setupMockifyer as setupMockifyerAxios } from '@sgedda/mockifyer-axios';
import { setupMockifyer as setupMockifyerFetch } from '@sgedda/mockifyer-fetch';
import axios from 'axios';
import path from 'path';

export interface WeatherData {
  location: string;
  temperature: number;
  conditions: string;
  timestamp: string;
}

// Cache for initialized Mockifyer instances (to avoid re-initializing)
const initializedCache = new Set<string>();

function getClientCacheKey(clientType: string, scope: string): string {
  return `${clientType}:${scope}`;
}

function ensureMockifyerInitialized(clientType: 'axios' | 'fetch', scope: 'local' | 'global'): void {
  const cacheKey = getClientCacheKey(clientType, scope);
  
  // Return if already initialized
  if (initializedCache.has(cacheKey)) {
    console.log(`[WeatherUnified] Mockifyer already initialized for ${cacheKey}`);
    return;
  }

  // Resolve mock data path
  let mockDataPath: string;
  
  if (process.env.MOCKIFYER_PATH) {
    mockDataPath = path.isAbsolute(process.env.MOCKIFYER_PATH) 
      ? process.env.MOCKIFYER_PATH 
      : path.join(process.cwd(), process.env.MOCKIFYER_PATH);
  } else if (process.env.RAILWAY_ENVIRONMENT || require('fs').existsSync('/persisted/mock-data')) {
    mockDataPath = '/persisted/mock-data';
  } else {
    mockDataPath = path.join(process.cwd(), 'persisted', 'mock-data');
  }

  console.log(`[WeatherUnified] Initializing Mockifyer:`, {
    clientType,
    scope,
    mockDataPath,
    mockEnabled: process.env.MOCKIFYER_ENABLED === 'true',
    mockRecord: process.env.MOCKIFYER_RECORD === 'true'
  });

  // Configure Mockifyer based on clientType and scope
  const config: any = {
    mockDataPath: mockDataPath,
    recordMode: process.env.MOCKIFYER_RECORD === 'true',
    failOnMissingMock: false,
    similarMatchRequiredParams: ['season', 'league', 'team','days', 'q'],
    // useSimilarMatch will be auto-enabled by Mockifyer when similarMatchRequiredParams is set
  };

  // Set global patching based on scope
  if (clientType === 'axios') {
    config.useGlobalAxios = scope === 'global';
    if (scope === 'global') {
      config.axiosInstance = axios; // Pass axios instance for global patching
      console.log('config.axiosInstance', config.axiosInstance);
    }
  } else if (clientType === 'fetch') {
    config.useGlobalFetch = scope === 'global';
  }

  // Add additional config options if Mockifyer is enabled
  if (process.env.MOCKIFYER_ENABLED === 'true') {
    config.recordSameEndpoints = process.env.MOCKIFYER_RECORD_SAME_ENDPOINTS === 'true';
    // useSimilarMatch will be auto-enabled by Mockifyer if similarMatchRequiredParams is set
    // Otherwise, use env var if explicitly set
    if (config.useSimilarMatch === undefined && process.env.MOCKIFYER_USE_SIMILAR_MATCH === 'true') {
      config.useSimilarMatch = true;
    }
    config.useSimilarMatchCheckResponse = process.env.MOCKIFYER_USE_SIMILAR_MATCH_CHECK_RESPONSE === 'true';
    // Don't overwrite similarMatchRequiredParams if already set above
    if (!config.similarMatchRequiredParams || config.similarMatchRequiredParams.length === 0) {
      config.similarMatchRequiredParams = ['days'];
    }
  }

  // Initialize Mockifyer (this patches global axios/fetch if scope is global)
  if (clientType === 'axios') {
    console.log('setupMockifyerAxios', config);
    setupMockifyerAxios(config);
  } else if (clientType === 'fetch') {
    setupMockifyerFetch(config);
  } else {
    throw new Error(`Unsupported clientType: ${clientType}`);
  }
  
  // Mark as initialized
  initializedCache.add(cacheKey);
  
  console.log(`[WeatherUnified] Mockifyer initialized for ${cacheKey}`);
}

// Cache for HTTP clients (only used for local scope)
const clientCache = new Map<string, HTTPClient>();

function getHTTPClient(clientType: 'axios' | 'fetch'): HTTPClient {
  const cacheKey = getClientCacheKey(clientType, 'local');
  
  // Return cached client if available
  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey)!;
  }

  // Resolve mock data path
  let mockDataPath: string;
  
  if (process.env.MOCKIFYER_PATH) {
    mockDataPath = path.isAbsolute(process.env.MOCKIFYER_PATH) 
      ? process.env.MOCKIFYER_PATH 
      : path.join(process.cwd(), process.env.MOCKIFYER_PATH);
  } else if (process.env.RAILWAY_ENVIRONMENT || require('fs').existsSync('/persisted/mock-data')) {
    mockDataPath = '/persisted/mock-data';
  } else {
    mockDataPath = path.join(process.cwd(), 'persisted', 'mock-data');
  }

  // Configure Mockifyer for local HTTP client
  const config: any = {
    mockDataPath: mockDataPath,
    recordMode: process.env.MOCKIFYER_RECORD === 'true',
    failOnMissingMock: false,
    useGlobalAxios: false,
    useGlobalFetch: false,
    similarMatchRequiredParams: ['season', 'league', 'team', 'days', 'q'],
    // useSimilarMatch will be auto-enabled by Mockifyer when similarMatchRequiredParams is set
  };

  // Add additional config options if Mockifyer is enabled
  if (process.env.MOCKIFYER_ENABLED === 'true') {
    config.recordSameEndpoints = process.env.MOCKIFYER_RECORD_SAME_ENDPOINTS === 'true';
    // useSimilarMatch will be auto-enabled by Mockifyer if similarMatchRequiredParams is set
    // Otherwise, use env var if explicitly set
    if (config.useSimilarMatch === undefined && process.env.MOCKIFYER_USE_SIMILAR_MATCH === 'true') {
      config.useSimilarMatch = true;
    }
    config.useSimilarMatchCheckResponse = process.env.MOCKIFYER_USE_SIMILAR_MATCH_CHECK_RESPONSE === 'true';
    // Don't overwrite similarMatchRequiredParams if already set above
    if (!config.similarMatchRequiredParams || config.similarMatchRequiredParams.length === 0) {
      config.similarMatchRequiredParams = ['days'];
    }
  }

  // Create HTTP client for local scope
  let httpClient: HTTPClient;
  if (clientType === 'axios') {
    httpClient = setupMockifyerAxios(config);
  } else if (clientType === 'fetch') {
    httpClient = setupMockifyerFetch(config);
  } else {
    throw new Error(`Unsupported clientType: ${clientType}`);
  }
  
  // Cache the client
  clientCache.set(cacheKey, httpClient);
  
  return httpClient;
}

export async function getCurrentWeatherUnified(
  city: string, 
  fullResponse: boolean = false,
  clientType: 'axios' | 'fetch' = 'axios',
  scope: 'local' | 'global' = 'local'
): Promise<{ data: WeatherData | any; headers: Record<string, string> }> {
  try {
    const apiKey = process.env.WEATHER_API_KEY || '';
    const baseUrl = 'https://api.weatherapi.com/v1';

    if (!apiKey) {
      console.warn('[WeatherUnified] WARNING: WEATHER_API_KEY is not set! API calls will fail.');
    }

    // Ensure Mockifyer is initialized (patches global axios/fetch if scope is global)
    ensureMockifyerInitialized(clientType, scope);

    console.log('[WeatherUnified] Making current weather request:', {
      url: `${baseUrl}/current.json`,
      city,
      clientType,
      scope,
      mockEnabled: process.env.MOCKIFYER_ENABLED === 'true',
      mockRecord: process.env.MOCKIFYER_RECORD === 'true'
    });

    let response: any;
    
    if (scope === 'global') {
      // Use global axios or fetch directly
      if (clientType === 'axios') {
        const axiosResponse = await axios(`${baseUrl}/current.json`, {
          params: {
            key: apiKey,
            q: city
          }
        });

        console.log('axiosResponse', axiosResponse);
        
        // CRITICAL: Check config first - this is the most reliable way
        // The adapter sets __mockifyer_isMock on the config, which survives axios transformations
        const isMockedFromConfig = !!(axiosResponse.config as any).__mockifyer_isMock;
        const preservedHeaders = (axiosResponse.config as any).__mockifyer_headers as Record<string, string> | undefined;
        
        console.log('[WeatherUnified] Mock detection from config:', {
          hasConfig: !!axiosResponse.config,
          __mockifyer_isMock: (axiosResponse.config as any).__mockifyer_isMock,
          isMocked: isMockedFromConfig,
          hasPreservedHeaders: !!preservedHeaders,
          preservedHeadersCount: preservedHeaders ? Object.keys(preservedHeaders).length : 0
        });
        
        const respHeaders = axiosResponse.headers as any;
        
        // Debug: Check what methods are available
        console.log('[WeatherUnified] Headers debug:', {
          headersType: typeof respHeaders,
          hasGet: typeof respHeaders?.get === 'function',
          hasForEach: typeof respHeaders?.forEach === 'function',
          hasToJSON: typeof respHeaders?.toJSON === 'function',
          hasKeys: typeof respHeaders?.keys === 'function',
          constructorName: respHeaders?.constructor?.name,
        });
        
        // Try multiple methods to extract headers
        // Axios may transform AxiosHeaders, so we need to try different approaches
        // Start with config value - this is the most reliable
        let isMockedFromResponse = isMockedFromConfig;
        const headers: Record<string, string> = {};
        
        // Method 1: Try toJSON() first (most reliable if available)
        if (respHeaders && typeof respHeaders.toJSON === 'function') {
          try {
            const headersObj = respHeaders.toJSON();
            console.log('[WeatherUnified] toJSON() returned:', {
              type: typeof headersObj,
              isArray: Array.isArray(headersObj),
              keys: Object.keys(headersObj || {}).slice(0, 10),
              totalKeys: Object.keys(headersObj || {}).length,
              sample: Object.keys(headersObj || {}).slice(0, 3).reduce((acc: any, key) => {
                acc[key] = headersObj[key];
                return acc;
              }, {})
            });
            
            if (headersObj && typeof headersObj === 'object' && !Array.isArray(headersObj)) {
              Object.entries(headersObj).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                  const lowerKey = key.toLowerCase();
                  headers[lowerKey] = String(value);
                  if (lowerKey === 'x-mockifyer') {
                    isMockedFromResponse = String(value) === 'true';
                  }
                }
              });
              if (Object.keys(headers).length > 0) {
                console.log('[WeatherUnified] ✅ Extracted', Object.keys(headers).length, 'headers using toJSON()');
              }
            }
          } catch (e) {
            console.warn('[WeatherUnified] toJSON() failed:', e);
          }
        }
        
        // Method 2: Try forEach if toJSON didn't work
        if (Object.keys(headers).length === 0 && respHeaders && typeof respHeaders.forEach === 'function') {
          respHeaders.forEach((value: string, key: string) => {
            if (value !== undefined && value !== null) {
              const lowerKey = key.toLowerCase();
              headers[lowerKey] = String(value);
              if (lowerKey === 'x-mockifyer') {
                isMockedFromResponse = String(value) === 'true';
              }
            }
          });
          if (Object.keys(headers).length > 0) {
            console.log('[WeatherUnified] ✅ Extracted', Object.keys(headers).length, 'headers using forEach()');
          }
        }
        
        // Method 3: Try get() method for specific headers
        if (!isMockedFromResponse && respHeaders && typeof respHeaders.get === 'function') {
          try {
            const mockHeader = respHeaders.get('x-mockifyer');
            console.log('[WeatherUnified] get("x-mockifyer") returned:', {
              value: mockHeader,
              type: typeof mockHeader,
              isUndefined: mockHeader === undefined,
              isNull: mockHeader === null
            });
            if (mockHeader !== undefined && mockHeader !== null) {
              isMockedFromResponse = String(mockHeader) === 'true' || mockHeader === true;
              headers['x-mockifyer'] = String(mockHeader);
              console.log('[WeatherUnified] ✅ Found x-mockifyer using get():', mockHeader);
            }
          } catch (e) {
            console.warn('[WeatherUnified] get() failed:', e);
          }
        }
        
        // Method 4: Try Object.entries as last resort (but skip if it's AxiosHeaders - won't work)
        if (Object.keys(headers).length === 0 && respHeaders && typeof respHeaders === 'object' && respHeaders.constructor?.name !== 'AxiosHeaders') {
          try {
            const entries = Object.entries(respHeaders);
            console.log('[WeatherUnified] Object.entries() returned', entries.length, 'entries');
            entries.forEach(([key, value]) => {
              if (value !== undefined && value !== null && typeof value === 'string') {
                const lowerKey = key.toLowerCase();
                headers[lowerKey] = String(value);
                if (lowerKey === 'x-mockifyer') {
                  isMockedFromResponse = String(value) === 'true';
                }
              }
            });
            if (Object.keys(headers).length > 0) {
              console.log('[WeatherUnified] ✅ Extracted', Object.keys(headers).length, 'headers using Object.entries()');
            }
          } catch (e) {
            console.warn('[WeatherUnified] Object.entries() failed:', e);
          }
        }
        
        // If headers are empty but we have preserved headers from config, use those
        // This handles the case where axios strips headers from the response
        if (Object.keys(headers).length === 0 && preservedHeaders && Object.keys(preservedHeaders).length > 0) {
          console.log('[WeatherUnified] ⚠️ Response headers empty, using preserved headers from config');
          Object.assign(headers, preservedHeaders);
          if (headers['x-mockifyer']) {
            isMockedFromResponse = headers['x-mockifyer'] === 'true';
          }
        }
        
        // Ensure x-mockifyer is set if we detected it's mocked
        if (isMockedFromResponse && !headers['x-mockifyer']) {
          headers['x-mockifyer'] = 'true';
          console.log('[WeatherUnified] Added x-mockifyer header because isMockedFromResponse=true');
        }
        
        console.log('[WeatherUnified] Extracted headers:', {
          hasXMockifyer: 'x-mockifyer' in headers,
          xMockifyerValue: headers['x-mockifyer'],
          isMockedFromResponse: isMockedFromResponse,
          totalHeaders: Object.keys(headers).length,
          allMockHeaders: Object.keys(headers).filter(k => k.includes('mock')),
          usedPreservedHeaders: Object.keys(headers).length > 0 && preservedHeaders && Object.keys(preservedHeaders).length > 0
        });
        
        response = {
          data: axiosResponse.data,
          status: axiosResponse.status,
          statusText: axiosResponse.statusText,
          headers: headers,
          __isMocked: isMockedFromResponse // Store mock status
        } as any;
      } else {
        // Use global fetch
        const url = new URL(`${baseUrl}/current.json`);
        url.searchParams.set('key', apiKey);
        url.searchParams.set('q', city);
        
        const fetchResponse = await fetch(url.toString());
        const data = await fetchResponse.json();
        
        // Convert fetch response to HTTPResponse format
        const headers: Record<string, string> = {};
        fetchResponse.headers.forEach((value, key) => {
          headers[key] = value;
        });
        
        response = {
          data,
          status: fetchResponse.status,
          statusText: fetchResponse.statusText,
          headers: headers
        };
      }
    } else {
      // Use HTTPClient instance for local scope
      const httpClient = getHTTPClient(clientType);
      response = await httpClient.get(`${baseUrl}/current.json`, {
        params: {
          key: apiKey,
          q: city
        }
      });
    }

    // Check for mockifyer header (case-insensitive)
    // First check __isMocked flag (set from config detection), then fall back to headers
    let isMocked = !!(response as any).__isMocked;
    if (!isMocked && response.headers) {
      isMocked = (
        response.headers['x-mockifyer'] === 'true' ||
        response.headers['X-Mockifyer'] === 'true' ||
        response.headers['X-MOCKIFYER'] === 'true'
      );
    }
    
    console.log('[WeatherUnified] Received response:', {
      status: response.status,
      hasData: !!response.data,
      isMocked: isMocked,
      clientType,
      scope
    });

    // Ensure x-mockifyer is set in final headers if mocked
    const finalHeaders: Record<string, string> = { ...(response.headers || {}) };
    if (isMocked && !finalHeaders['x-mockifyer']) {
      finalHeaders['x-mockifyer'] = 'true';
    }

    // Check if this is a limit response - if so, return it as-is
    const isLimitReached = response.status === 429 || 
                          finalHeaders['x-mockifyer-limit-reached'] === 'true' ||
                          response.data?.limitReached === true ||
                          response.data?.error?.includes('Maximum') ||
                          response.data?.message?.includes('Maximum');
    
    if (isLimitReached) {
      // Return limit error response as-is (don't transform)
      return {
        data: response.data,
        headers: finalHeaders
      };
    }

    // Return full response if requested, otherwise return transformed data
    if (fullResponse) {
      return {
        data: response.data,
        headers: finalHeaders
      };
    }

    const weatherData: WeatherData = {
      location: response.data.location?.name || city,
      temperature: response.data.current?.temp_c,
      conditions: response.data.current?.condition?.text,
      timestamp: response.data.current?.last_updated
    };

    return {
      data: weatherData,
      headers: finalHeaders
    };
  } catch (error: any) {
    console.error('[WeatherUnified] Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      clientType,
      scope
    });
    throw new Error(`Failed to fetch weather data for ${city}`);
  }
}

export async function getForecastUnified(
  city: string, 
  days: number = 3, 
  fullResponse: boolean = false,
  clientType: 'axios' | 'fetch' = 'axios',
  scope: 'local' | 'global' = 'local'
): Promise<{ data: WeatherData[] | any; headers: Record<string, string> }> {
  try {
    console.log("DDAAAAYS",days)
    const apiKey = process.env.WEATHER_API_KEY || '';
    const baseUrl = 'https://api.weatherapi.com/v1';

    if (!apiKey) {
      console.warn('[WeatherUnified] WARNING: WEATHER_API_KEY is not set! API calls will fail.');
    }

    // Ensure Mockifyer is initialized (patches global axios/fetch if scope is global)
    ensureMockifyerInitialized(clientType, scope);

    console.log('[WeatherUnified] Making forecast request:', {
      url: `${baseUrl}/forecast.json`,
      city,
      days,
      clientType,
      scope
    });

    let response: any;
    
    if (scope === 'global') {
      // Use global axios or fetch directly
      if (clientType === 'axios') {
        const axiosResponse = await axios.get(`${baseUrl}/forecast.json`, {
          params: {
            key: apiKey,
            q: city,
            days: days.toString()
          }
        });
        
        // CRITICAL: Check config first - this is the most reliable way
        // The adapter sets __mockifyer_isMock on the config, which survives axios transformations
        const isMockedFromConfig = !!(axiosResponse.config as any).__mockifyer_isMock;
        const preservedHeaders = (axiosResponse.config as any).__mockifyer_headers as Record<string, string> | undefined;
        
        const respHeaders = axiosResponse.headers as any;
        
        // Try multiple methods to extract headers
        // Start with config value - this is the most reliable
        let isMockedFromResponse = isMockedFromConfig;
        const headers: Record<string, string> = {};
        
        // Method 1: Try toJSON() first (most reliable if available)
        if (respHeaders && typeof respHeaders.toJSON === 'function') {
          try {
            const headersObj = respHeaders.toJSON();
            if (headersObj && typeof headersObj === 'object' && !Array.isArray(headersObj)) {
              Object.entries(headersObj).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                  const lowerKey = key.toLowerCase();
                  headers[lowerKey] = String(value);
                  if (lowerKey === 'x-mockifyer') {
                    isMockedFromResponse = String(value) === 'true';
                  }
                }
              });
            }
          } catch (e) {
            console.warn('[WeatherUnified] toJSON() failed:', e);
          }
        }
        
        // Method 2: Try forEach if toJSON didn't work
        if (Object.keys(headers).length === 0 && respHeaders && typeof respHeaders.forEach === 'function') {
          respHeaders.forEach((value: string, key: string) => {
            if (value !== undefined && value !== null) {
              const lowerKey = key.toLowerCase();
              headers[lowerKey] = String(value);
              if (lowerKey === 'x-mockifyer') {
                isMockedFromResponse = String(value) === 'true';
              }
            }
          });
        }
        
        // Method 3: Try get() method for specific headers
        if (!isMockedFromResponse && respHeaders && typeof respHeaders.get === 'function') {
          try {
            const mockHeader = respHeaders.get('x-mockifyer');
            if (mockHeader !== undefined && mockHeader !== null) {
              isMockedFromResponse = String(mockHeader) === 'true' || mockHeader === true;
              headers['x-mockifyer'] = String(mockHeader);
            }
          } catch (e) {
            console.warn('[WeatherUnified] get() failed:', e);
          }
        }
        
        // Method 4: Try Object.entries as last resort
        if (Object.keys(headers).length === 0 && respHeaders && typeof respHeaders === 'object' && respHeaders.constructor?.name !== 'AxiosHeaders') {
          try {
            Object.entries(respHeaders).forEach(([key, value]) => {
              if (value !== undefined && value !== null && typeof value === 'string') {
                const lowerKey = key.toLowerCase();
                headers[lowerKey] = String(value);
                if (lowerKey === 'x-mockifyer') {
                  isMockedFromResponse = String(value) === 'true';
                }
              }
            });
          } catch (e) {
            console.warn('[WeatherUnified] Object.entries() failed:', e);
          }
        }
        
        // If headers are empty but we have preserved headers from config, use those
        if (Object.keys(headers).length === 0 && preservedHeaders && Object.keys(preservedHeaders).length > 0) {
          Object.assign(headers, preservedHeaders);
          if (headers['x-mockifyer']) {
            isMockedFromResponse = headers['x-mockifyer'] === 'true';
          }
        }
        
        // Ensure x-mockifyer is set if we detected it's mocked
        if (isMockedFromResponse && !headers['x-mockifyer']) {
          headers['x-mockifyer'] = 'true';
        }
        
        response = {
          data: axiosResponse.data,
          status: axiosResponse.status,
          statusText: axiosResponse.statusText,
          headers: headers,
          __isMocked: isMockedFromResponse // Store mock status
        } as any;
      } else {
        // Use global fetch
        const url = new URL(`${baseUrl}/forecast.json`);
        url.searchParams.set('key', apiKey);
        url.searchParams.set('q', city);
        url.searchParams.set('days', days.toString());
        
        const fetchResponse = await fetch(url.toString());
        const data = await fetchResponse.json();
        
        // Convert fetch response to HTTPResponse format
        const headers: Record<string, string> = {};
        fetchResponse.headers.forEach((value, key) => {
          headers[key] = value;
        });
        
        response = {
          data: data,
          status: fetchResponse.status,
          statusText: fetchResponse.statusText,
          headers: headers
        };
      }
    } else {
      // Use HTTPClient instance for local scope
      const httpClient = getHTTPClient(clientType);
      response = await httpClient.get(`${baseUrl}/forecast.json`, {
        params: {
          key: apiKey,
          q: city,
          days: days.toString()
        }
      });
    }

    // Check for mockifyer header (case-insensitive)
    // First check __isMocked flag (set from config detection), then fall back to headers
    let isMocked = !!(response as any).__isMocked;
    if (!isMocked && response.headers) {
      isMocked = (
        response.headers['x-mockifyer'] === 'true' ||
        response.headers['X-Mockifyer'] === 'true' ||
        response.headers['X-MOCKIFYER'] === 'true'
      );
    }
    
    console.log('[WeatherUnified] Received forecast response:', {
      status: response.status,
      hasData: !!response.data,
      isMocked: isMocked,
      clientType,
      scope,
      requestedDays: days,
      actualForecastDays: response.data?.forecast?.forecastday?.length || 0,
      forecastDayCount: response.data?.forecast?.forecastday?.length
    });

    // Ensure x-mockifyer is set in final headers if mocked
    const finalHeaders: Record<string, string> = { ...(response.headers || {}) };
    if (isMocked && !finalHeaders['x-mockifyer']) {
      finalHeaders['x-mockifyer'] = 'true';
    }
    
    // Check if this is a limit response - if so, return it as-is
    const isLimitReached = response.status === 429 || 
                          finalHeaders['x-mockifyer-limit-reached'] === 'true' ||
                          response.data?.limitReached === true ||
                          response.data?.error?.includes('Maximum') ||
                          response.data?.message?.includes('Maximum');
    
    if (isLimitReached) {
      // Return limit error response as-is (don't transform)
      return {
        data: response.data,
        headers: finalHeaders
      };
    }
    
    // Return full response if requested, otherwise return transformed data
    if (fullResponse) {
      return {
        data: response.data,
        headers: finalHeaders
      };
    }

    const locationName = response.data.location?.name || city;
    const forecastDays = response.data.forecast?.forecastday || [];
    console.log('[WeatherUnified] Processing forecast data:', {
      requestedDays: days,
      actualForecastDays: forecastDays.length,
      isMocked: isMocked,
      forecastDayDates: forecastDays.map((d: any) => d.date),
      note: days > 3 && forecastDays.length === 3 ? 'Weather API free tier limited to 3 days maximum' : undefined
    });
    
    if (days > 3 && forecastDays.length === 3) {
      console.warn(`[WeatherUnified] ⚠️ Requested ${days} days but Weather API free tier only returns 3 days maximum`);
    }
    
    const forecastData: WeatherData[] = forecastDays.map((day: any) => ({
      location: locationName,
      temperature: day.day.avgtemp_c,
      conditions: day.day.condition.text,
      timestamp: day.date
    }));

    return {
      data: forecastData,
      headers: finalHeaders
    };
  } catch (error: any) {
    console.error('[WeatherUnified] Forecast Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      clientType,
      scope
    });
    throw new Error(`Failed to fetch forecast data for ${city}`);
  }
}

