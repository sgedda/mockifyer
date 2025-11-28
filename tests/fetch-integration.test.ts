import { setupMockifyer } from '../src';
import path from 'path';
import fs from 'fs';
import { HTTPClient } from '../src/types/http-client';

describe('Mockifyer Fetch Integration', () => {
  const testMockDataPath = path.join(__dirname, '../test-mock-data-fetch');
  let httpClient: HTTPClient;

  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(testMockDataPath)) {
      fs.readdirSync(testMockDataPath).forEach((file) => {
        fs.unlinkSync(path.join(testMockDataPath, file));
      });
    } else {
      fs.mkdirSync(testMockDataPath, { recursive: true });
    }

    // Setup Mockifyer with fetch client
    httpClient = setupMockifyer({
      mockDataPath: testMockDataPath,
      recordMode: false, // Use mocks, don't record
      httpClientType: 'fetch',
      useGlobalAxios: false
    });
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testMockDataPath)) {
      fs.readdirSync(testMockDataPath).forEach((file) => {
        fs.unlinkSync(path.join(testMockDataPath, file));
      });
    }
  });

  it('should return mock response when mock exists', async () => {
    // Create a mock file
    const mockData = {
      request: {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: {},
        queryParams: {}
      },
      response: {
        status: 200,
        data: {
          message: 'Hello from mock!',
          id: 123
        },
        headers: {
          'content-type': 'application/json'
        }
      },
      timestamp: new Date().toISOString()
    };

    const mockFileName = `test_GET_api_example_com_test.json`;
    const mockFilePath = path.join(testMockDataPath, mockFileName);
    fs.writeFileSync(mockFilePath, JSON.stringify(mockData, null, 2));

    // Reload mock data
    (httpClient as any).reloadMockData();

    // Make request using fetch client
    const response = await httpClient.get('https://api.example.com/test');

    // Verify response
    expect(response.status).toBe(200);
    expect(response.data).toEqual({
      message: 'Hello from mock!',
      id: 123
    });
    expect(response.headers['x-mockifyer']).toBe('true');
    expect(response.headers['content-type']).toBe('application/json');
  });

  it('should handle query parameters correctly', async () => {
    // Create a mock file with query params
    const mockData = {
      request: {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: {},
        queryParams: {
          id: '123',
          name: 'John'
        }
      },
      response: {
        status: 200,
        data: {
          user: {
            id: 123,
            name: 'John Doe'
          }
        },
        headers: {
          'content-type': 'application/json'
        }
      },
      timestamp: new Date().toISOString()
    };

    const mockFileName = `test_GET_api_example_com_users.json`;
    const mockFilePath = path.join(testMockDataPath, mockFileName);
    fs.writeFileSync(mockFilePath, JSON.stringify(mockData, null, 2));

    // Reload mock data
    (httpClient as any).reloadMockData();

    // Make request with query parameters
    const response = await httpClient.get('https://api.example.com/users', {
      params: {
        id: '123',
        name: 'John'
      }
    });

    // Verify response
    expect(response.status).toBe(200);
    expect(response.data.user.id).toBe(123);
    expect(response.data.user.name).toBe('John Doe');
    expect(response.headers['x-mockifyer']).toBe('true');
  });

  it('should attempt real request when mock does not exist and failOnMissingMock is false', async () => {
    // Mock global fetch to prevent actual HTTP calls
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    // Setup with failOnMissingMock: false (default)
    httpClient = setupMockifyer({
      mockDataPath: testMockDataPath,
      recordMode: false,
      failOnMissingMock: false,
      httpClientType: 'fetch',
      useGlobalAxios: false
    });

    // Try to make request without mock
    // Since failOnMissingMock is false, it will attempt real request
    await expect(
      httpClient.get('https://api.example.com/nonexistent')
    ).rejects.toThrow('Network error');

    // Restore original fetch
    global.fetch = originalFetch;
  });

  it('should throw error when mock does not exist and failOnMissingMock is true', async () => {
    // Setup with failOnMissingMock: true
    httpClient = setupMockifyer({
      mockDataPath: testMockDataPath,
      recordMode: false,
      failOnMissingMock: true,
      httpClientType: 'fetch',
      useGlobalAxios: false
    });

    // Try to make request without mock
    await expect(
      httpClient.get('https://api.example.com/nonexistent')
    ).rejects.toThrow(/No mock data found/);
  });

  it('should record mock, read it, and delete it', async () => {
    const testUrl = 'https://api.example.com/record-test';
    const testResponseData = {
      message: 'Recorded response',
      timestamp: Date.now()
    };

    // Step 1: Record mode - Mock global fetch to simulate real API call
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({
        'content-type': 'application/json'
      }),
      json: async () => testResponseData,
      text: async () => JSON.stringify(testResponseData)
    } as Response);

    // Setup Mockifyer in record mode
    const recordClient = setupMockifyer({
      mockDataPath: testMockDataPath,
      recordMode: true,
      httpClientType: 'fetch',
      useGlobalAxios: false
    });

    // Make request - this should record the response
    const recordedResponse = await recordClient.get(testUrl);
    
    // Verify the response
    expect(recordedResponse.status).toBe(200);
    expect(recordedResponse.data).toEqual(testResponseData);

    // Verify mock file was created
    const files = fs.readdirSync(testMockDataPath);
    expect(files.length).toBeGreaterThan(0);
    
    // Find the mock file for this URL (filename format: YYYY-MM-DD_HH-MM-SS_METHOD_url.json)
    // Note: URL sanitization replaces non-alphanumeric chars with underscores, so 'record-test' becomes 'record_test'
    const mockFile = files.find(file => 
      file.includes('GET') && file.includes('api_example_com_record_test')
    );
    expect(mockFile).toBeDefined();
    
    const mockFilePath = path.join(testMockDataPath, mockFile!);
    
    // Verify the content of the saved mock
    const savedMock = JSON.parse(fs.readFileSync(mockFilePath, 'utf-8'));
    expect(savedMock.request.method).toBe('GET');
    expect(savedMock.request.url).toBe(testUrl);
    expect(savedMock.response.data).toEqual(testResponseData);
    expect(savedMock.response.status).toBe(200);

    // Restore original fetch
    global.fetch = originalFetch;

    // Step 2: Read mode - Switch to non-record mode and verify mock is used
    const readClient = setupMockifyer({
      mockDataPath: testMockDataPath,
      recordMode: false,
      httpClientType: 'fetch',
      useGlobalAxios: false
    });

    // Reload mock data to ensure the recorded mock is loaded
    (readClient as any).reloadMockData();

    // Make request - should use the recorded mock
    const readResponse = await readClient.get(testUrl);
    
    // Verify it's using the mock (should have x-mockifyer header)
    expect(readResponse.status).toBe(200);
    expect(readResponse.data).toEqual(testResponseData);
    expect(readResponse.headers['x-mockifyer']).toBe('true');
    expect(readResponse.headers['x-mockifyer-filename']).toBe(mockFile);

    // Step 3: Delete the mock file
    expect(fs.existsSync(mockFilePath)).toBe(true);
    fs.unlinkSync(mockFilePath);
    expect(fs.existsSync(mockFilePath)).toBe(false);

    // Verify mock is no longer available
    (readClient as any).reloadMockData();
    
    // Try to use the deleted mock - should fail or attempt real request
    // Since failOnMissingMock is false by default, it will attempt real request
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    
    await expect(
      readClient.get(testUrl)
    ).rejects.toThrow('Network error');

    // Restore original fetch
    global.fetch = originalFetch;
  });
});

