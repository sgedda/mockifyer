jest.mock('@sgedda/mockifyer-axios', () => ({
  setupMockifyer: jest.fn(() => ({
    get: jest.fn(),
  })),
}));

import { WeatherService } from '../services/weather';
import { setupMockifyer } from '@sgedda/mockifyer-axios';

describe('WeatherService', () => {
  let weatherService: WeatherService;
  let mockClient: { get: jest.Mock };
  let previousMode: string | undefined;
  let previousApiKey: string | undefined;

  beforeEach(() => {
    previousMode = process.env.MOCKIFYER_MODE;
    previousApiKey = process.env.WEATHER_API_KEY;
    process.env.MOCKIFYER_MODE = 'on';
    process.env.WEATHER_API_KEY = 'test-key';

    mockClient = {
      get: jest.fn(),
    };

    (setupMockifyer as jest.Mock).mockReturnValue(mockClient);
    weatherService = new WeatherService();
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (previousMode === undefined) {
      delete process.env.MOCKIFYER_MODE;
    } else {
      process.env.MOCKIFYER_MODE = previousMode;
    }
    if (previousApiKey === undefined) {
      delete process.env.WEATHER_API_KEY;
    } else {
      process.env.WEATHER_API_KEY = previousApiKey;
    }
  });

  it('should fetch current weather', async () => {
    mockClient.get.mockResolvedValue({
      status: 200,
      data: {
        location: { name: 'London' },
        current: {
          temp_c: 18,
          condition: { text: 'Partly cloudy' },
          last_updated: '2024-03-16 12:00',
        },
      },
      headers: {},
    });

    const response = await weatherService.getCurrentWeather('London');

    expect(response.data).toEqual({
      location: 'London',
      temperature: 18,
      conditions: 'Partly cloudy',
      timestamp: '2024-03-16 12:00',
    });
  });

  it('should fetch weather forecast', async () => {
    mockClient.get.mockResolvedValue({
      status: 200,
      data: {
        location: { name: 'London' },
        forecast: {
          forecastday: [
            { date: '2024-03-16', day: { avgtemp_c: 18, condition: { text: 'Sunny' } } },
            { date: '2024-03-17', day: { avgtemp_c: 20, condition: { text: 'Clear' } } },
            { date: '2024-03-18', day: { avgtemp_c: 19, condition: { text: 'Cloudy' } } },
          ],
        },
      },
      headers: {},
    });

    const response = await weatherService.getForecast('London', 3);

    expect(response.data).toEqual([
      { location: 'London', temperature: 18, conditions: 'Sunny', timestamp: '2024-03-16' },
      { location: 'London', temperature: 20, conditions: 'Clear', timestamp: '2024-03-17' },
      { location: 'London', temperature: 19, conditions: 'Cloudy', timestamp: '2024-03-18' },
    ]);
  });
});
