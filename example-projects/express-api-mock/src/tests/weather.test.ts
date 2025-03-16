import { setupMockifyer } from '@sgedda/mockifyer';
import { WeatherService } from '../services/weather';
import fs from 'fs';
import path from 'path';

describe('WeatherService', () => {
  let weatherService: WeatherService;
  const mockDataPath = './mock-data';

  beforeEach(() => {
    // Setup mockifyer for tests
    process.env.MOCKIFYER_ENABLED = 'true';
    process.env.MOCKIFYER_PATH = mockDataPath;
    process.env.MOCKIFYER_RECORD = 'false';
    process.env.WEATHER_API_KEY = 'test-key';

    // Create mock data directory
    if (!fs.existsSync(mockDataPath)) {
      fs.mkdirSync(mockDataPath, { recursive: true });
    }

    // Create mock data for current weather
    fs.writeFileSync(
      path.join(mockDataPath, 'current_weather.json'),
      JSON.stringify({
        request: {
          method: 'GET',
          url: 'https://api.weatherapi.com/v1/current.json',
          queryParams: { key: 'test-key', q: 'London' }
        },
        response: {
          status: 200,
          data: {
            current: {
              temp_c: 18,
              condition: { text: 'Partly cloudy' },
              last_updated: '2024-03-16 12:00'
            }
          }
        }
      })
    );

    // Create mock data for forecast
    fs.writeFileSync(
      path.join(mockDataPath, 'forecast.json'),
      JSON.stringify({
        request: {
          method: 'GET',
          url: 'https://api.weatherapi.com/v1/forecast.json',
          queryParams: { key: 'test-key', q: 'London', days: 3 }
        },
        response: {
          status: 200,
          data: {
            forecast: {
              forecastday: [
                {
                  date: '2024-03-16',
                  day: { avgtemp_c: 18, condition: { text: 'Sunny' } }
                },
                {
                  date: '2024-03-17',
                  day: { avgtemp_c: 20, condition: { text: 'Clear' } }
                },
                {
                  date: '2024-03-18',
                  day: { avgtemp_c: 19, condition: { text: 'Cloudy' } }
                }
              ]
            }
          }
        }
      })
    );
    
    weatherService = new WeatherService();
  });

  afterEach(() => {
    // Clean up mock data
    if (fs.existsSync(mockDataPath)) {
      fs.rmSync(mockDataPath, { recursive: true });
    }

    delete process.env.MOCKIFYER_ENABLED;
    delete process.env.MOCKIFYER_PATH;
    delete process.env.MOCKIFYER_RECORD;
    delete process.env.WEATHER_API_KEY;
  });

  it('should fetch current weather', async () => {
    const weather = await weatherService.getCurrentWeather('London');
    expect(weather).toBeDefined();
    expect(weather.location).toBe('London');
    expect(weather.temperature).toBe(18);
    expect(weather.conditions).toBe('Partly cloudy');
    expect(weather.timestamp).toBe('2024-03-16 12:00');
  });

  it('should fetch weather forecast', async () => {
    const forecast = await weatherService.getForecast('London', 3);
    expect(forecast).toHaveLength(3);
    expect(forecast[0]).toEqual({
      location: 'London',
      temperature: 18,
      conditions: 'Sunny',
      timestamp: '2024-03-16'
    });
    expect(forecast[1]).toEqual({
      location: 'London',
      temperature: 20,
      conditions: 'Clear',
      timestamp: '2024-03-17'
    });
    expect(forecast[2]).toEqual({
      location: 'London',
      temperature: 19,
      conditions: 'Cloudy',
      timestamp: '2024-03-18'
    });
  });
}); 