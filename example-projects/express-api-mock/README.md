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

2. Create a `.env` file in the root directory with your WeatherAPI key:
   ```
   WEATHER_API_KEY=your_api_key_here
   PORT=3000
   ```

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

### Get Current Weather
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