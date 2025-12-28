import { HTTPClient } from '@sgedda/mockifyer';
import { setupMockifyer } from '@sgedda/mockifyer';
import path from 'path';

export interface WeatherData {
  location: string;
  temperature: number;
  conditions: string;
  timestamp: string;
}

export class WeatherService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly httpClient: HTTPClient;

  constructor() {
    this.apiKey = process.env.WEATHER_API_KEY || '';
    this.baseUrl = 'https://api.weatherapi.com/v1';
    console.log('[WeatherService] API Key:', this.apiKey);
    console.log('[WeatherService] Base URL:', this.baseUrl);
    
    if (!this.apiKey) {
      console.warn('[WeatherService] WARNING: WEATHER_API_KEY is not set! API calls will fail.');
    }
    
    // Initialize mockifyer if enabled
    // Use the same path resolution logic as initializeMockifyer() to ensure consistency
    let mockDataPath: string;
    
    if (process.env.MOCKIFYER_PATH) {
      // Use explicitly set path (Railway volume path from env var)
      mockDataPath = path.isAbsolute(process.env.MOCKIFYER_PATH) 
        ? process.env.MOCKIFYER_PATH 
        : path.join(process.cwd(), process.env.MOCKIFYER_PATH);
    } else if (process.env.RAILWAY_ENVIRONMENT || require('fs').existsSync('/persisted/mock-data')) {
      // On Railway, check for volume at /persisted/mock-data
      mockDataPath = '/persisted/mock-data';
      console.log('[WeatherService] Detected Railway environment, using volume path:', mockDataPath);
    } else {
      // Local development fallback
      mockDataPath = path.join(process.cwd(), 'persisted', 'mock-data');
    }
    
    console.log('[WeatherService] Mock data path:', {
      envPath: process.env.MOCKIFYER_PATH,
      resolvedPath: mockDataPath,
      cwd: process.cwd(),
      pathExists: require('fs').existsSync(mockDataPath)
    });
    
    if (process.env.MOCKIFYER_ENABLED === 'true') {
      this.httpClient = setupMockifyer({
        mockDataPath: mockDataPath,
        recordMode: process.env.MOCKIFYER_RECORD === 'true',
        failOnMissingMock: false,
        recordSameEndpoints: process.env.MOCKIFYER_RECORD_SAME_ENDPOINTS === 'true',
        useSimilarMatch: process.env.MOCKIFYER_USE_SIMILAR_MATCH === 'true',
        useSimilarMatchCheckResponse: process.env.MOCKIFYER_USE_SIMILAR_MATCH_CHECK_RESPONSE === 'true',
        similarMatchRequiredParams: ['days'] // Require 'days' parameter to match for forecast requests
      });
    } else {
      this.httpClient = setupMockifyer({
        mockDataPath: mockDataPath,
        recordMode: false,
        failOnMissingMock: false
      });
    }

    console.log('[WeatherService] Initialized with:', {
      baseUrl: this.baseUrl,
      hasApiKey: !!this.apiKey,
      mockEnabled: process.env.MOCKIFYER_ENABLED,
      mockRecord: process.env.MOCKIFYER_RECORD,
      mockPath: process.env.MOCKIFYER_PATH,
      hasMockifyer: !!(this.httpClient as any).__mockifyer
    });
  }

  async getCurrentWeather(city: string, fullResponse: boolean = false): Promise<{ data: WeatherData | any; headers: Record<string, string> }> {
    try {
      console.log('[WeatherService] Making current weather request:', {
        url: `${this.baseUrl}/current.json`,
        city,
        mockEnabled: process.env.MOCKIFYER_ENABLED,
        mockRecord: process.env.MOCKIFYER_RECORD
      });

      const response = await this.httpClient.get(`${this.baseUrl}/current.json`, {
        params: {
          key: this.apiKey,
          q: city
        }
      });

      // Check for mockifyer header (case-insensitive)
      const isMocked = response.headers && (
        response.headers['x-mockifyer'] === 'true' ||
        response.headers['X-Mockifyer'] === 'true' ||
        response.headers['X-MOCKIFYER'] === 'true'
      );
      
      console.log('[WeatherService] Received response:', {
        status: response.status,
        hasData: !!response.data,
        mockInfo: (response as any).__mockifyer,
        isMocked: isMocked,
        headers: response.headers,
        headerKeys: Object.keys(response.headers || {}),
        xMockifyerHeader: response.headers?.['x-mockifyer'] || response.headers?.['X-Mockifyer'] || response.headers?.['X-MOCKIFYER']
      });

      // Return full response if requested, otherwise return transformed data
      if (fullResponse) {
        return {
          data: response.data,
          headers: response.headers as Record<string, string>
        };
      }

      const weatherData: WeatherData = {
        location: response.data.location?.name || city, // Use actual location name from API
        temperature: response.data.current?.temp_c,
        conditions: response.data.current?.condition?.text,
        timestamp: response.data.current?.last_updated
      };

      return {
        data: weatherData,
        headers: response.headers as Record<string, string>
      };
    } catch (error: any) {
      console.error('[WeatherService] Error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        mockEnabled: process.env.MOCKIFYER_ENABLED,
        mockRecord: process.env.MOCKIFYER_RECORD,
        config: error.config
      });
      throw new Error(`Failed to fetch weather data for ${city}`);
    }
  }

  async getForecast(city: string, days: number = 3, fullResponse: boolean = false): Promise<{ data: WeatherData[] | any; headers: Record<string, string> }> {
    try {
      console.log('[WeatherService] Making forecast request:', {
        url: `${this.baseUrl}/forecast.json`,
        city,
        days,
        mockEnabled: process.env.MOCKIFYER_ENABLED,
        mockRecord: process.env.MOCKIFYER_RECORD
      });

      const response = await this.httpClient.get(`${this.baseUrl}/forecast.json`, {
        params: {
          key: this.apiKey,
          q: city,
          days: days.toString()
        }
      });

      console.log('[WeatherService] Received forecast response:', {
        status: response.status,
        hasData: !!response.data,
        mockInfo: (response as any).__mockifyer,
        isMocked: response.headers?.['x-mockifyer'] === 'true'
      });

      // Return full response if requested, otherwise return transformed data
      if (fullResponse) {
        return {
          data: response.data,
          headers: response.headers as Record<string, string>
        };
      }

      const locationName = response.data.location?.name || city; // Use actual location name from API
      const forecastData: WeatherData[] = response.data.forecast.forecastday.map((day: any) => ({
        location: locationName,
        temperature: day.day.avgtemp_c,
        conditions: day.day.condition.text,
        timestamp: day.date
      }));

      return {
        data: forecastData,
        headers: response.headers as Record<string, string>
      };
    } catch (error: any) {
      console.error('[WeatherService] Forecast Error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        mockEnabled: process.env.MOCKIFYER_ENABLED,
        mockRecord: process.env.MOCKIFYER_RECORD,
        config: error.config
      });
      throw new Error(`Failed to fetch forecast data for ${city}`);
    }
  }
}

export const weatherService = new WeatherService(); 