# Simple Axios Example with Mockifyer

A minimal example demonstrating how to use Mockifyer with axios to mock 3 different API endpoints.

## What This Example Does

This example makes simple axios calls to 3 different public APIs:
1. **JSONPlaceholder** - Fetches a blog post
2. **GitHub API** - Fetches user information
3. **Dog API** - Fetches a random dog image

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build Mockifyer (if using local development):
```bash
cd ../../
npm run build
cd example-projects/simple-axios-example
```

## Usage

### Record Mode (Save Real API Responses)

Run with recording enabled to save real API responses as mock data:

```bash
npm run record
```

or

```bash
MOCKIFYER_ENABLED=true MOCKIFYER_RECORD=true npm start
```

This will:
- Make real API calls to all 3 endpoints
- Save the responses to `mock-data/` directory
- Display the results

### Mock Mode (Use Saved Mocks)

Run with mocking enabled to use saved mock data instead of making real API calls:

```bash
npm run mock
```

or

```bash
MOCKIFYER_ENABLED=true MOCKIFYER_RECORD=false npm start
```

This will:
- Use saved mock data from `mock-data/` directory
- Skip real API calls
- Display the mocked results

### Without Mockifyer

Run without Mockifyer (makes real API calls):

```bash
npm start
```

## Environment Variables

- `MOCKIFYER_ENABLED` - Set to `true` to enable Mockifyer
- `MOCKIFYER_RECORD` - Set to `true` to record real API responses, `false` to use mocks
- `MOCKIFYER_PATH` - Optional path to mock data directory (defaults to `./mock-data`)

## Project Structure

```
simple-axios-example/
├── src/
│   └── index.ts          # Main example file
├── mock-data/            # Mock data directory (created automatically)
├── package.json
├── tsconfig.json
└── README.md
```

## How It Works

1. **Setup**: Mockifyer is initialized with `useGlobalAxios: true`, which patches the global `axios` instance
2. **Interception**: All `axios.get()` calls are automatically intercepted
3. **Recording**: In record mode, responses are saved to JSON files
4. **Mocking**: In mock mode, saved responses are returned instead of making real API calls

## Key Features Demonstrated

- ✅ Simple axios calls (no need to change your code)
- ✅ Global axios patching (`useGlobalAxios: true`)
- ✅ Multiple endpoints from different APIs
- ✅ Record and replay functionality

