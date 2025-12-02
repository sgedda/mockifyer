import { setupMockifyer } from '../../packages/mockifyer-fetch/src';
import { HybridProvider } from '../../packages/mockifyer-core/src/providers/hybrid-provider';
import { ExpoFileSystemProvider } from '../../packages/mockifyer-core/src/providers/expo-filesystem-provider';
import path from 'path';
import fs from 'fs';

// Mock expo-file-system
jest.mock('expo-file-system');

const mockFileSystem = require('expo-file-system');

// Mock global fetch
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;
(global as any).__mockifyer_original_fetch = mockFetch;

describe('Reload with Sync Functionality', () => {
  const testMockDataPath = path.join(__dirname, '../../test-mock-data-reload');
  let httpClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Clean up test directory
    if (fs.existsSync(testMockDataPath)) {
      fs.readdirSync(testMockDataPath).forEach((file) => {
        fs.unlinkSync(path.join(testMockDataPath, file));
      });
    } else {
      fs.mkdirSync(testMockDataPath, { recursive: true });
    }

    // Setup default FileSystem mocks
    mockFileSystem.documentDirectory = '/mock/document/dir/';
    mockFileSystem.readDirectoryAsync.mockResolvedValue([]);
    mockFileSystem.getInfoAsync.mockResolvedValue({ exists: false });
    mockFileSystem.makeDirectoryAsync.mockResolvedValue(undefined);
    mockFileSystem.writeAsStringAsync.mockResolvedValue(undefined);
    mockFileSystem.readAsStringAsync.mockResolvedValue('{}');
    mockFileSystem.deleteAsync.mockResolvedValue(undefined);

    // Setup default fetch mock
    const mockHeaders = {
      forEach: jest.fn((callback: (value: string, key: string) => void) => {
        callback('application/json', 'content-type');
      }),
      get: jest.fn((name: string) => 'application/json'),
    };
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: mockHeaders,
      json: async () => ({ success: true }),
      text: async () => '',
    });

    // Setup Mockifyer with HybridProvider
    httpClient = setupMockifyer({
      mockDataPath: testMockDataPath,
      recordMode: false,
      useGlobalFetch: true,
      databaseProvider: {
        type: 'hybrid',
        path: 'mock-data',
        options: {
          metroPort: 8081,
        },
      } as any,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    // Clean up test directory
    if (fs.existsSync(testMockDataPath)) {
      fs.readdirSync(testMockDataPath).forEach((file) => {
        fs.unlinkSync(path.join(testMockDataPath, file));
      });
    }
  });

  describe('reloadMockData with sync', () => {
    it('should sync files from project folder before reloading', async () => {
      const mockFiles = [
        {
          filename: 'synced_file.json',
          content: {
            request: {
              method: 'GET',
              url: 'https://api.example.com/synced',
              headers: {},
              queryParams: {},
            },
            response: {
              status: 200,
              data: { message: 'synced from project' },
              headers: {},
            },
            timestamp: new Date().toISOString(),
          },
          modificationTime: Date.now(),
        },
      ];

      const mockHeadersForSync1 = {
        forEach: jest.fn((callback: (value: string, key: string) => void) => {
          callback('application/json', 'content-type');
        }),
        get: jest.fn((name: string) => 'application/json'),
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: mockHeadersForSync1,
        json: async () => ({
          success: true,
          files: mockFiles,
        }),
      });

      mockFileSystem.readDirectoryAsync.mockResolvedValue(['synced_file.json']);
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true, modificationTime: Date.now() });
      mockFileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify(mockFiles[0].content));

      await httpClient.reloadMockData(true);

      expect(mockFetch).toHaveBeenCalled();
      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toContain('/mockifyer-sync-to-device');
    });

    it('should skip sync when syncFromProject is false', async () => {
      await httpClient.reloadMockData(false);

      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/mockifyer-sync-to-device'),
        expect.anything()
      );
    });

    it('should reload cache after syncing', async () => {
      const mockFiles = [
        {
          filename: 'test.json',
          content: {
            request: {
              method: 'GET',
              url: 'https://api.example.com/test',
              headers: {},
              queryParams: {},
            },
            response: {
              status: 200,
              data: { message: 'test' },
              headers: {},
            },
            timestamp: new Date().toISOString(),
          },
          modificationTime: Date.now(),
        },
      ];

      const mockHeadersForSync2 = {
        forEach: jest.fn((callback: (value: string, key: string) => void) => {
          callback('application/json', 'content-type');
        }),
        get: jest.fn((name: string) => 'application/json'),
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: mockHeadersForSync2,
        json: async () => ({
          success: true,
          files: mockFiles,
        }),
      });

      mockFileSystem.readDirectoryAsync.mockResolvedValue(['test.json']);
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true, modificationTime: Date.now() });
      mockFileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify(mockFiles[0].content));

      await httpClient.reloadMockData(true);

      // Verify that files were synced and cache was reloaded
      expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalled();
    });

    it('should handle sync failure gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Sync failed'));

      await expect(httpClient.reloadMockData(true)).resolves.not.toThrow();
    });
  });

  describe('file modification time preservation', () => {
    it('should preserve modification times when syncing files', async () => {
      const originalMtime = Date.now() - 5000; // 5 seconds ago
      const mockFiles = [
        {
          filename: 'preserved_time.json',
          content: {
            request: {
              method: 'GET',
              url: 'https://api.example.com/test',
              headers: {},
              queryParams: {},
            },
            response: {
              status: 200,
              data: {},
              headers: {},
            },
            timestamp: new Date().toISOString(),
          },
          modificationTime: originalMtime,
        },
      ];

      const mockHeadersForSync3 = {
        forEach: jest.fn((callback: (value: string, key: string) => void) => {
          callback('application/json', 'content-type');
        }),
        get: jest.fn((name: string) => 'application/json'),
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: mockHeadersForSync3,
        json: async () => ({
          success: true,
          files: mockFiles,
        }),
      });

      mockFileSystem.readDirectoryAsync.mockResolvedValue(['preserved_time.json']);
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true, modificationTime: originalMtime });
      mockFileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify(mockFiles[0].content));

      await httpClient.reloadMockData(true);

      // Verify that the file was saved with the original modification time
      expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalled();
    });

    it('should use newest file when multiple files match same request', async () => {
      const olderMtime = Date.now() - 10000;
      const newerMtime = Date.now() - 1000;

      const olderFile = {
        filename: 'older.json',
        content: {
          request: {
            method: 'GET',
            url: 'https://api.example.com/test',
            headers: {},
            queryParams: {},
          },
          response: {
            status: 200,
            data: { version: 'old' },
            headers: {},
          },
          timestamp: new Date().toISOString(),
        },
        modificationTime: olderMtime,
      };

      const newerFile = {
        filename: 'newer.json',
        content: {
          request: {
            method: 'GET',
            url: 'https://api.example.com/test',
            headers: {},
            queryParams: {},
          },
          response: {
            status: 200,
            data: { version: 'new' },
            headers: {},
          },
          timestamp: new Date().toISOString(),
        },
        modificationTime: newerMtime,
      };

      const mockHeadersForSync4 = {
        forEach: jest.fn((callback: (value: string, key: string) => void) => {
          callback('application/json', 'content-type');
        }),
        get: jest.fn((name: string) => 'application/json'),
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: mockHeadersForSync4,
        json: async () => ({
          success: true,
          files: [olderFile, newerFile],
        }),
      });

      mockFileSystem.readDirectoryAsync.mockResolvedValue(['older.json', 'newer.json']);
      mockFileSystem.getInfoAsync
        .mockResolvedValueOnce({ exists: true, modificationTime: olderMtime })
        .mockResolvedValueOnce({ exists: true, modificationTime: newerMtime });
      mockFileSystem.readAsStringAsync
        .mockResolvedValueOnce(JSON.stringify(olderFile.content))
        .mockResolvedValueOnce(JSON.stringify(newerFile.content));

      await httpClient.reloadMockData(true);

      // Both files should be saved
      expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe('cache invalidation on reload', () => {
    it('should clear cache when reload is called', async () => {
      const request = {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: {},
        queryParams: {},
      };

      const originalData = {
        request,
        response: {
          status: 200,
          data: { message: 'original' },
          headers: {},
        },
        timestamp: new Date().toISOString(),
      };

      const updatedData = {
        request,
        response: {
          status: 200,
          data: { message: 'updated' },
          headers: {},
        },
        timestamp: new Date().toISOString(),
      };

      const filename = 'test.json';
      const originalMtime = Date.now();
      const updatedMtime = originalMtime + 5000;

      // Clear any previous mocks
      jest.clearAllMocks();

      // Save original
      mockFileSystem.getInfoAsync.mockImplementation((path: string) => {
        if (path.includes('mock-data') && !path.endsWith('.json')) {
          return Promise.resolve({ exists: true, isDirectory: true });
        } else if (path.endsWith('.json')) {
          return Promise.resolve({ exists: true, modificationTime: originalMtime });
        }
        return Promise.resolve({ exists: false });
      });
      mockFileSystem.readDirectoryAsync.mockResolvedValue([filename]);
      mockFileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify(originalData));

      // Reload with updated file
      const mockHeadersForSync = {
        forEach: jest.fn((callback: (value: string, key: string) => void) => {
          callback('application/json', 'content-type');
        }),
        get: jest.fn((name: string) => 'application/json'),
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: mockHeadersForSync,
        json: async () => ({
          success: true,
          files: [{
            filename,
            content: updatedData,
            modificationTime: updatedMtime,
          }],
        }),
      });

      await httpClient.reloadMockData(true);

      // Reset mocks for the request call - cache should be cleared, so it will re-read files
      // Clear previous mocks to avoid interference from other tests
      mockFileSystem.readAsStringAsync.mockReset();
      mockFileSystem.readDirectoryAsync.mockReset();
      mockFileSystem.getInfoAsync.mockReset();
      
      mockFileSystem.readDirectoryAsync.mockResolvedValue([filename]);
      mockFileSystem.getInfoAsync.mockImplementation((path: string) => {
        if (path.includes('mock-data') && !path.endsWith('.json')) {
          return Promise.resolve({ exists: true, isDirectory: true });
        } else if (path.endsWith('.json')) {
          return Promise.resolve({ exists: true, modificationTime: updatedMtime });
        }
        return Promise.resolve({ exists: false });
      });
      mockFileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify(updatedData));

      // Cache should be cleared, so next find should read updated file
      const result = await httpClient.request({
        method: 'GET',
        url: 'https://api.example.com/test',
      });

      expect(result.data).toEqual({ message: 'updated' });
    });
  });
});

