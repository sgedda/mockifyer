import { HTTPClient } from '@sgedda/mockifyer';
import { setupMockifyer } from '@sgedda/mockifyer';

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
    
    // Initialize mockifyer if enabled
    if (process.env.MOCKIFYER_ENABLED === 'true') {
      this.httpClient = setupMockifyer({
        mockDataPath: process.env.MOCKIFYER_PATH || './mock-data',
        recordMode: process.env.MOCKIFYER_RECORD === 'true',
        failOnMissingMock: false,
        recordSameEndpoints: process.env.MOCKIFYER_RECORD_SAME_ENDPOINTS === 'true',
        useSimilarMatch: process.env.MOCKIFYER_USE_SIMILAR_MATCH === 'true',
        useSimilarMatchCheckResponse: process.env.MOCKIFYER_USE_SIMILAR_MATCH_CHECK_RESPONSE === 'true'
      });
    } else {
      this.httpClient = setupMockifyer({
        mockDataPath: process.env.MOCKIFYER_PATH || './mock-data',
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

  async getCurrentWeather(city: string): Promise<{ data: WeatherData; headers: Record<string, string> }> {
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

      const weatherData: WeatherData = {
        location: city,
        temperature: response.data.current.temp_c,
        conditions: response.data.current.condition.text,
        timestamp: response.data.current.last_updated
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

  async getForecast(city: string, days: number = 3): Promise<{ data: WeatherData[]; headers: Record<string, string> }> {
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

      const forecastData: WeatherData[] = response.data.forecast.forecastday.map((day: any) => ({
        location: city,
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