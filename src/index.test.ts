import { setupMockifyer } from './index';
import path from 'path';
import fs from 'fs';
import axios, { AxiosInstance, AxiosResponse, AxiosHeaders } from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Mockifyer', () => {
  const mockDataPath = path.join(__dirname, '../test-mock-data');

  beforeEach(() => {
    // Clean up mock data directory before each test
    if (fs.existsSync(mockDataPath)) {
      fs.rmSync(mockDataPath, { recursive: true });
    }
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should record API calls in record mode', async () => {
    const testData = { message: 'Hello, World!' };
    const mockServerResponse: AxiosResponse = {
      data: testData,
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      config: {
        method: 'get',
        url: 'https://api.example.com/test',
        headers: new AxiosHeaders(),
        params: {}
      }
    };

    // Setup the mock axios instance
    const mockAxiosInstance = {
      get: jest.fn().mockResolvedValueOnce(mockServerResponse),
      request: jest.fn(),
      defaults: {
        adapter: jest.fn()
      },
      interceptors: {
        request: {
          use: jest.fn().mockReturnValue(1),
          eject: jest.fn(),
          clear: jest.fn()
        },
        response: {
          use: jest.fn().mockImplementation((successFn) => {
            if (successFn) {
              successFn(mockServerResponse);
            }
            return 1;
          }),
          eject: jest.fn(),
          clear: jest.fn()
        }
      }
    } as unknown as AxiosInstance;

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    // Initialize mockifyer in record mode
    const axiosInstance = setupMockifyer({
      recordMode: true,
      mockDataPath
    });

    // Make a test API call
    const response = await axiosInstance.get('https://api.example.com/test');

    // Verify the response
    expect(response).toEqual(mockServerResponse);

    // Verify that the mock data was saved
    const files = fs.readdirSync(mockDataPath);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^\d+_GET_https___api_example_com_test\.json$/);

    // Verify the content of the saved mock
    const savedMock = JSON.parse(
      fs.readFileSync(path.join(mockDataPath, files[0]), 'utf-8')
    );
    expect(savedMock.request.method).toBe('GET');
    expect(savedMock.request.url).toBe('https://api.example.com/test');
    expect(savedMock.response.data).toEqual(testData);

    // Log the location of the mock data file for inspection
    console.log('Mock data file created at:', path.join(mockDataPath, files[0]));
  });

  it('should replay recorded API calls in mock mode', async () => {
    // First record the mock data
    const testData = { message: 'Hello, World!' };
    const mockServerResponse: AxiosResponse = {
      data: testData,
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      config: {
        method: 'get',
        url: 'https://api.example.com/test',
        headers: new AxiosHeaders(),
        params: {}
      }
    };

    // Setup the mock axios instance for recording
    const mockAxiosInstance = {
      get: jest.fn().mockResolvedValueOnce(mockServerResponse),
      request: jest.fn(),
      defaults: {
        adapter: jest.fn()
      },
      interceptors: {
        request: {
          use: jest.fn().mockReturnValue(1),
          eject: jest.fn(),
          clear: jest.fn()
        },
        response: {
          use: jest.fn().mockImplementation((successFn) => {
            if (successFn) {
              successFn(mockServerResponse);
            }
            return 1;
          }),
          eject: jest.fn(),
          clear: jest.fn()
        }
      }
    } as unknown as AxiosInstance;

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    // Initialize mockifyer in record mode and record the mock data
    const recordAxios = setupMockifyer({
      recordMode: true,
      mockDataPath
    });

    await recordAxios.get('https://api.example.com/test');

    // Reset the mock for the mock mode test
    jest.clearAllMocks();

    // Setup the mock axios instance for mock mode
    const mockAxiosInstanceForMockMode = {
      get: jest.fn().mockResolvedValueOnce(mockServerResponse),
      request: jest.fn(),
      defaults: {
        adapter: jest.fn()
      },
      interceptors: {
        request: {
          use: jest.fn().mockReturnValue(1),
          eject: jest.fn(),
          clear: jest.fn()
        },
        response: {
          use: jest.fn().mockReturnValue(1),
          eject: jest.fn(),
          clear: jest.fn()
        }
      }
    } as unknown as AxiosInstance;

    mockedAxios.create.mockReturnValue(mockAxiosInstanceForMockMode);

    // Now create a new instance in mock mode
    const mockAxios = setupMockifyer({
      recordMode: false,
      mockDataPath
    });

    // Make the same API call
    const response = await mockAxios.get('https://api.example.com/test');

    // Verify that we get the same response
    expect(response.data).toEqual(testData);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/json');
  });
}); 