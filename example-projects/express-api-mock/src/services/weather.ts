import axios, { AxiosInstance } from 'axios';
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
  private readonly axios: AxiosInstance;

  constructor() {
    this.apiKey = process.env.WEATHER_API_KEY || '';
    this.baseUrl = 'https://api.weatherapi.com/v1';
    
    // Initialize mockifyer if enabled
    if (process.env.MOCKIFYER_ENABLED === 'true') {
      this.axios = setupMockifyer({
        mockDataPath: process.env.MOCKIFYER_PATH || './mock-data',
        recordMode: process.env.MOCKIFYER_RECORD === 'true',
        autoMock: false
      });
    } else {
      this.axios = axios;
    }

    console.log('[WeatherService] Initialized with:', {
      baseUrl: this.baseUrl,
      hasApiKey: !!this.apiKey,
      mockEnabled: process.env.MOCKIFYER_ENABLED,
      mockRecord: process.env.MOCKIFYER_RECORD,
      mockPath: process.env.MOCKIFYER_PATH,
      hasMockifyer: !!(this.axios as any).__mockifyer
    });
  }

  async getCurrentWeather(city: string): Promise<WeatherData> {
    try {
      console.log('[WeatherService] Making current weather request:', {
        url: `${this.baseUrl}/current.json`,
        city,
        mockEnabled: process.env.MOCKIFYER_ENABLED,
        mockRecord: process.env.MOCKIFYER_RECORD
      });

      const response = await this.axios.get(`${this.baseUrl}/current.json`, {
        params: {
          key: this.apiKey,
          q: city
        }
      });

      console.log('[WeatherService] Received response:', {
        status: response.status,
        hasData: !!response.data,
        mockInfo: (response as any).__mockifyer
      });

      return {
        location: city,
        temperature: response.data.current.temp_c,
        conditions: response.data.current.condition.text,
        timestamp: response.data.current.last_updated
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

  async getForecast(city: string, days: number = 3): Promise<WeatherData[]> {
    try {
      console.log('[WeatherService] Making forecast request:', {
        url: `${this.baseUrl}/forecast.json`,
        city,
        days,
        mockEnabled: process.env.MOCKIFYER_ENABLED,
        mockRecord: process.env.MOCKIFYER_RECORD
      });

      const response = await this.axios.get(`${this.baseUrl}/forecast.json`, {
        params: {
          key: this.apiKey,
          q: city,
          days
        }
      });

      console.log('[WeatherService] Received forecast response:', {
        status: response.status,
        hasData: !!response.data,
        mockInfo: (response as any).__mockifyer
      });

      return response.data.forecast.forecastday.map((day: any) => ({
        location: city,
        temperature: day.day.avgtemp_c,
        conditions: day.day.condition.text,
        timestamp: day.date
      }));
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