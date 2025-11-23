# Express API Mock Example

This example project demonstrates how to use `mockifyer` to mock external API calls and manipulate dates in your tests. The project implements a simple weather API service that fetches data from a third-party weather API.

## Features

- Express.js REST API
- TypeScript implementation
- External API integration with WeatherAPI
- Comprehensive test suite using Jest and mockifyer
- Examples of:
  - API call mocking
  - Date manipulation
  - Error handling
  - Type-safe implementations

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in the root directory with your API keys:
   ```
   WEATHER_API_KEY=your_weather_api_key_here
   FOOTBALL_API_KEY=your_football_api_key_here
   PORT=3000
   ```

   **Getting API Keys:**
   - **WeatherAPI**: Sign up at https://www.weatherapi.com/ (free tier available)
   - **Football API**: 
     1. Go to https://rapidapi.com/api-sports/api/api-football
     2. Sign up or log in to RapidAPI
     3. Subscribe to the "Basic" plan (free tier with 100 requests/day)
     4. Copy your API key from the dashboard
     5. Add it to your `.env` file as `FOOTBALL_API_KEY`

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open the web dashboard:
   - Navigate to `http://localhost:3000` in your browser
   - The dashboard provides a user-friendly interface to test all API endpoints
   - It displays whether responses are mocked or from the real API with cute visual indicators 🎭

5. Run tests:
   ```bash
   npm test
   ```

## API Endpoints

### Weather Endpoints

#### Get Current Weather
```
GET /api/weather/current/:city
```

Example response:
```json
{
  "location": "London",
  "temperature": 18,
  "conditions": "Partly cloudy",
  "timestamp": "2024-03-16 12:00"
}
```

### Get Weather Forecast
```
GET /api/weather/forecast/:city?days=3
```

Example response:
```json
[
  {
    "location": "London",
    "temperature": 20,
    "conditions": "Sunny",
    "timestamp": "2024-03-16"
  },
  {
    "location": "London",
    "temperature": 22,
    "conditions": "Clear",
    "timestamp": "2024-03-17"
  }
]
```

### Football Endpoints

#### Get Fixtures
```
GET /api/football/fixtures?league=39&team=33&date=2024-03-16
```

Query parameters (all optional):
- `league`: League ID (e.g., 39 for Premier League)
- `team`: Team ID (e.g., 33 for Manchester United)
- `date`: Date in YYYY-MM-DD format

#### Get League Standings
```
GET /api/football/standings/:leagueId?season=2024
```

Example: `GET /api/football/standings/39?season=2024`

#### Get Team Information
```
GET /api/football/team/:teamId
```

Example: `GET /api/football/team/33`

**Note**: Football endpoints require a valid `FOOTBALL_API_KEY` from RapidAPI. Without it, you'll get 403 errors. You can still use mock mode to test without an API key.

## Web Dashboard

The project includes a beautiful web dashboard for testing endpoints interactively:

- **Visual Interface**: Modern, gradient-styled UI with card-based layout
- **Mock Detection**: Automatically detects and displays when responses are mocked vs real API calls
- **Mock Information**: Shows mock timestamp and other mockifyer metadata
- **Real-time Testing**: Test all endpoints directly from the browser
- **Cute Indicators**: 🎭 badges for mocked responses, 🌐 badges for real API calls

Access the dashboard at `http://localhost:3000` when the server is running.

## Testing with mockifyer

The test suite demonstrates several key features of mockifyer:

1. API Mocking:
   ```typescript
   mockApi({
     url: 'https://api.weatherapi.com/v1/current.json',
     method: 'GET',
     params: {
       key: expect.any(String),
       q: 'London'
     },
     response: {
       // ... mock response data
     }
   });
   ```

2. Date Manipulation:
   ```typescript
   mockDate('2024-03-16T12:00:00Z');
   ```

3. Error Handling:
   ```typescript
   mockApi({
     // ... mock configuration
     error: {
       status: 404,
       message: 'City not found'
     }
   });
   ```

## Project Structure

```
src/
├── index.ts           # Main application entry point
├── routes/
│   └── weather.ts     # Weather API routes
├── services/
│   └── weather.ts     # Weather service with external API integration
└── tests/
    ├── setup.ts       # Test setup with mockifyer configuration
    └── weather.test.ts # Weather service tests
```

## Learn More

- [mockifyer Documentation](https://github.com/sgedda/mockifyer)
- [Express.js Documentation](https://expressjs.com/)
- [WeatherAPI Documentation](https://www.weatherapi.com/docs/) 