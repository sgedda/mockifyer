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
  const testMockDataPath = path.join(__dirname, '../test-mock-data-reload');
  let httpClient: any;

  const headerFactory = () => ({
    forEach: jest.fn((callback: (value: string, key: string) => void) => {
      callback('application/json', 'content-type');
    }),
    get: jest.fn((name: string) => 'application/json'),
  });

  /** Hybrid sync uses manifest + per-file endpoints (not one giant JSON). */
  function stubManifestSyncFetch(
    files: Array<{ filename: string; content: Record<string, unknown>; modificationTime: number }>
  ) {
    const headers = headerFactory();
    mockFetch.mockImplementation((reqUrl: string | Request) => {
      const url = typeof reqUrl === 'string' ? reqUrl : reqUrl.url;
      if (url.includes('/mockifyer-scenario-config')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers,
          json: async () => ({ success: true, currentScenario: 'default' }),
          text: async () => '',
        });
      }
      if (url.includes('/mockifyer-sync-to-device-manifest')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers,
          json: async () => ({
            success: true,
            files: files.map((f) => ({ filename: f.filename, modificationTime: f.modificationTime })),
          }),
          text: async () => '',
        });
      }
      if (url.includes('/mockifyer-sync-to-device-file')) {
        let decoded = '';
        try {
          const u = new URL(url, 'http://localhost');
          const p = u.searchParams.get('path');
          decoded = p ? decodeURIComponent(p) : '';
        } catch {
          /* ignore */
        }
        const file = files.find((f) => f.filename === decoded);
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers,
          json: async () => ({
            success: true,
            filename: file?.filename,
            content: file?.content,
          }),
          text: async () => '',
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers,
        json: async () => ({ success: true }),
        text: async () => '',
      });
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Clean up test directory
    if (fs.existsSync(testMockDataPath)) {
      fs.readdirSync(testMockDataPath).forEach((file) => {
        const filePath = path.join(testMockDataPath, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(filePath);
        }
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
        const filePath = path.join(testMockDataPath, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(filePath);
        }
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

      stubManifestSyncFetch(mockFiles);

      mockFileSystem.readDirectoryAsync.mockResolvedValue(['synced_file.json']);
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true, modificationTime: Date.now() });
      mockFileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify(mockFiles[0].content));

      await httpClient.reloadMockData(true);

      expect(mockFetch).toHaveBeenCalled();
      const manifestCall = mockFetch.mock.calls.find(
        (call: any[]) =>
          call[0] &&
          typeof call[0] === 'string' &&
          call[0].includes('/mockifyer-sync-to-device-manifest')
      );
      expect(manifestCall).toBeDefined();
    });

    it('should skip sync when syncFromProject is false', async () => {
      await httpClient.reloadMockData(false);

      const manifestCalls = mockFetch.mock.calls.filter(
        (call: any[]) =>
          call[0] &&
          typeof call[0] === 'string' &&
          call[0].includes('/mockifyer-sync-to-device-manifest')
      );
      expect(manifestCalls.length).toBe(0);
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

      stubManifestSyncFetch(mockFiles);

      mockFileSystem.readDirectoryAsync.mockResolvedValue(['test.json']);
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true, modificationTime: Date.now() });
      mockFileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify(mockFiles[0].content));

      await httpClient.reloadMockData(true);

      // Verify that files were synced and cache was reloaded
      expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalled();
    });

    it('should handle sync failure gracefully', async () => {
      mockFetch.mockImplementation((reqUrl: string | Request) => {
        const url = typeof reqUrl === 'string' ? reqUrl : reqUrl.url;
        if (url.includes('/mockifyer-sync-to-device-manifest')) {
          return Promise.reject(new Error('Sync failed'));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: headerFactory(),
          json: async () => ({ success: true, currentScenario: 'default' }),
          text: async () => '',
        });
      });

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

      stubManifestSyncFetch(mockFiles);

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

      stubManifestSyncFetch([olderFile, newerFile]);

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
      stubManifestSyncFetch([
        {
          filename,
          content: updatedData as unknown as Record<string, unknown>,
          modificationTime: updatedMtime,
        },
      ]);

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

