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

## Date Configuration

Mockifyer provides powerful date manipulation features that are especially useful for testing time-dependent functionality. Here are the different ways to configure date behavior:

### 1. Fixed Date

Set a specific date for all date operations:

```typescript
setupMockifyer({
  mockDataPath: './mock-data',
  dateManipulation: {
    fixedDate: '2024-12-25T12:00:00Z' // Christmas 2024
  }
});

console.log(getCurrentDate().toISOString()); // 2024-12-25T12:00:00.000Z
```

### 2. Date Offset

Set a relative offset from the current date:

```typescript
setupMockifyer({
  mockDataPath: './mock-data',
  dateManipulation: {
    offset: 2 * 24 * 60 * 60 * 1000 // 2 days in the future
  }
});

// If today is 2024-03-16, this will return 2024-03-18
console.log(getCurrentDate().toISOString());
```

### 3. Environment Variables

Control date behavior through environment variables:

```bash
# Set a fixed date
export MOCKIFYER_DATE="2025-01-01T00:00:00Z"

# Or set an offset (in milliseconds)
export MOCKIFYER_DATE_OFFSET="86400000" # 1 day in the future

# Or set a timezone
export MOCKIFYER_TIMEZONE="America/New_York"
```

### 4. Timezone Support

Handle dates in specific timezones:

```typescript
setupMockifyer({
  mockDataPath: './mock-data',
  dateManipulation: {
    timezone: 'America/New_York'
  }
});

// Returns date in New York timezone
console.log(getCurrentDate().toISOString());
```

### Priority Order

Date manipulation settings are applied in the following order:
1. Environment variables (highest priority)
2. Configuration options in `setupMockifyer`
3. System date (fallback)

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