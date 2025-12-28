# Request Flow Enhancement Guide

This document describes the enhanced fields that can be added to mock data for better request flow visualization and tracking.

## Enhanced MockData Structure

The `MockData` interface can be extended with the following optional fields:

```typescript
export interface MockData {
  request: StoredRequest;
  response: StoredResponse;
  timestamp: string;
  scenario?: string;
  
  // Request Flow Enhancement Fields
  sessionId?: string;           // Unique identifier for grouping related requests
  requestId?: string;            // Unique identifier for this specific request
  parentRequestId?: string;      // ID of the request that triggered this one (for dependency tracking)
  sequence?: number;             // Order within the session (1, 2, 3, ...)
  source?: string;               // Source file location (e.g., "src/services/api.ts:45")
  callStack?: string[];          // Stack trace showing where the request was initiated
  duration?: number;             // Request duration in milliseconds
  responseTime?: number;        // Alternative name for duration
}
```

## Field Descriptions

### sessionId
- **Purpose**: Groups related requests that are part of the same user action or workflow
- **Example**: `"session-1704123456-abc123"`
- **Usage**: Requests within the same session are displayed together in the timeline view
- **Auto-generation**: If not provided, requests within 5 minutes of each other are automatically grouped

### requestId
- **Purpose**: Unique identifier for each request
- **Example**: `"req-1704123456-def456"`
- **Usage**: Used for tracking parent-child relationships between requests

### parentRequestId
- **Purpose**: Links a request to its parent (the request that triggered it)
- **Example**: `"req-1704123456-def456"`
- **Usage**: Shows request dependencies and call chains
- **Visualization**: Displays "🔗 Parent: req-..." or "🌱 Root request"

### sequence
- **Purpose**: Order of requests within a session
- **Example**: `1`, `2`, `3`
- **Usage**: Shows chronological order within a session
- **Auto-generation**: Automatically assigned based on timestamp if not provided

### source
- **Purpose**: File location where the request was made
- **Example**: `"src/services/userService.ts:45"`
- **Usage**: Helps developers trace where API calls originate
- **Visualization**: Displayed in the request metadata

### callStack
- **Purpose**: Full stack trace showing the call chain
- **Example**: `["at fetchUsers (src/services/userService.ts:45:12)", "at UserList.loadUsers (src/components/UserList.tsx:23:8)"]`
- **Usage**: Detailed debugging information
- **Fallback**: First item can be used as `source` if `source` field is not provided

### duration / responseTime
- **Purpose**: How long the request took to complete
- **Example**: `120` (milliseconds)
- **Usage**: Performance analysis and identifying slow requests
- **Visualization**: Displayed as "⏱ 120ms"

## Implementation Recommendations

### When Recording Mocks

1. **Generate sessionId**: Create a session ID at the start of a user workflow or test
2. **Track requestId**: Generate unique ID for each request
3. **Capture parentRequestId**: If a request triggers another request, pass the parent's requestId
4. **Record source**: Use stack trace to identify source file and line number
5. **Measure duration**: Track time from request initiation to response

### Example Implementation

```typescript
// When saving a mock response
const mockData: MockData = {
  request,
  response: storedResponse,
  timestamp: new Date().toISOString(),
  scenario: this.config.scenarios?.default,
  
  // Request flow fields
  sessionId: this.getCurrentSessionId(),
  requestId: this.generateRequestId(),
  parentRequestId: this.getParentRequestId(),
  sequence: this.getNextSequence(),
  source: this.getSourceLocation(),
  callStack: new Error().stack?.split('\n') || [],
  duration: Date.now() - requestStartTime
};
```

## Benefits

1. **Better Visualization**: Requests are grouped by session, making it easier to understand workflows
2. **Dependency Tracking**: See which requests trigger other requests
3. **Debugging**: Source locations help identify where API calls originate
4. **Performance Analysis**: Duration tracking helps identify bottlenecks
5. **Test Analysis**: Session grouping helps analyze test flows

## Backward Compatibility

All request flow fields are optional. Existing mock files without these fields will:
- Be automatically assigned session IDs based on timestamp proximity
- Have sequence numbers generated automatically
- Display "Unknown" for source if not available
- Show "N/A" for duration if not available

