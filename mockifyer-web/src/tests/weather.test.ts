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

    // Create mock data directory and default scenario directory
    const defaultScenarioPath = path.join(mockDataPath, 'default');
    if (!fs.existsSync(defaultScenarioPath)) {
      fs.mkdirSync(defaultScenarioPath, { recursive: true });
    }

    // Create mock data for current weather
    // Note: key parameter must be anonymized as Mockifyer anonymizes it when matching
    fs.writeFileSync(
      path.join(defaultScenarioPath, 'current_weather.json'),
      JSON.stringify({
        request: {
          method: 'GET',
          url: 'https://api.weatherapi.com/v1/current.json',
          queryParams: { key: '***ANONYMIZED***', q: 'London' },
          headers: {}
        },
        response: {
          status: 200,
          data: {
            location: {
              name: 'London'
            },
            current: {
              temp_c: 18,
              condition: { text: 'Partly cloudy' },
              last_updated: '2024-03-16 12:00'
            }
          },
          headers: {}
        },
        timestamp: '2024-03-16T12:00:00.000Z'
      })
    );

    // Create mock data for forecast
    // Note: key parameter must be anonymized as Mockifyer anonymizes it when matching
    fs.writeFileSync(
      path.join(defaultScenarioPath, 'forecast.json'),
      JSON.stringify({
        request: {
          method: 'GET',
          url: 'https://api.weatherapi.com/v1/forecast.json',
          queryParams: { key: '***ANONYMIZED***', q: 'London', days: '3' },
          headers: {}
        },
        response: {
          status: 200,
          data: {
            location: {
              name: 'London'
            },
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
          },
          headers: {}
        },
        timestamp: '2024-03-16T12:00:00.000Z'
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
    const response = await weatherService.getCurrentWeather('London');
    expect(response).toBeDefined();
    expect(response.data).toBeDefined();
    expect(response.data.location).toBe('London');
    expect(response.data.temperature).toBe(18);
    expect(response.data.conditions).toBe('Partly cloudy');
    expect(response.data.timestamp).toBe('2024-03-16 12:00');
  });

  it('should fetch weather forecast', async () => {
    const response = await weatherService.getForecast('London', 3);
    expect(response.data).toBeDefined();
    const forecast = response.data;
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