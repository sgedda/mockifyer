# mockifyer

A Node.js package for mocking and recording API calls, with special support for date manipulation in tests.

## Features

- Record and replay HTTP requests
- Automatic request interception based on environment settings
- Date manipulation utilities for testing
- Support for timezone handling
- Environment variable configuration

## Installation

```bash
npm install mockifyer
```

## Usage

```typescript
import { setupMockifyer, getCurrentDate } from 'mockifyer';

// Setup mockifyer with configuration
setupMockifyer({
  mockDataPath: './mock-data',
  dateManipulation: {
    fixedDate: '2024-01-01T00:00:00.000Z'
  }
});

// Your API calls will now be intercepted and mocked
const response = await axios.get('https://api.example.com/data');

// Use date manipulation in tests
const currentDate = getCurrentDate();
console.log(currentDate.toISOString()); // 2024-01-01T00:00:00.000Z
```

## Environment Variables

- `MOCKIFYER_ENABLED`: Enable/disable mocking (true/false)
- `MOCKIFYER_RECORD`: Enable/disable recording mode (true/false)
- `MOCKIFYER_PATH`: Path to store mock data
- `MOCKIFYER_DATE`: Set a fixed date for testing
- `MOCKIFYER_DATE_OFFSET`: Set a date offset in milliseconds
- `MOCKIFYER_TIMEZONE`: Set a specific timezone for date manipulation

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT 