import { HybridProvider } from '../../packages/mockifyer-core/src/providers/hybrid-provider';
import { ExpoFileSystemProvider } from '../../packages/mockifyer-core/src/providers/expo-filesystem-provider';
import { MockData, StoredRequest } from '../../packages/mockifyer-core/src/types';
import { generateRequestKey } from '../../packages/mockifyer-core/src/utils/mock-matcher';

// Mock expo-file-system
jest.mock('expo-file-system');

const mockFileSystem = require('expo-file-system');

// Mock global fetch
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;
(global as any).__mockifyer_original_fetch = mockFetch;

describe('HybridProvider', () => {
  let provider: HybridProvider;
  const mockDataPath = 'mock-data';
  const mockMetroPort = 8081;
  const mockMetroUrl = `http://localhost:${mockMetroPort}`;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default FileSystem mocks
    mockFileSystem.documentDirectory = '/mock/document/dir/';
    mockFileSystem.readDirectoryAsync.mockResolvedValue([]);
    mockFileSystem.getInfoAsync.mockResolvedValue({ exists: false });
    mockFileSystem.makeDirectoryAsync.mockResolvedValue(undefined);
    mockFileSystem.writeAsStringAsync.mockResolvedValue(undefined);
    
    // Setup default fetch mock
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
      text: async () => '',
    });

    provider = new HybridProvider({
      path: mockDataPath,
      metroPort: mockMetroPort,
    } as any);
  });

  afterEach(() => {
    if (provider && typeof provider.close === 'function') {
      provider.close();
    }
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await provider.initialize();
      expect(mockFileSystem.makeDirectoryAsync).toHaveBeenCalled();
    });

    it('should use default metro port if not specified', () => {
      const defaultProvider = new HybridProvider({
        path: mockDataPath,
      });
      expect((defaultProvider as any).metroPort).toBe(8081);
    });

    it('should use custom metro port if specified', () => {
      const customProvider = new HybridProvider({
        path: mockDataPath,
        metroPort: 8082,
      } as any);
      expect((customProvider as any).metroPort).toBe(8082);
    });
  });

  describe('save', () => {
    it('should save to device filesystem', async () => {
      await provider.initialize();

      const mockData: MockData = {
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
      };

      await provider.save(mockData);

      expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalled();
    });

    it('should skip saving sync endpoint requests', async () => {
      await provider.initialize();

      const mockData: MockData = {
        request: {
          method: 'POST',
          url: 'http://localhost:8081/mockifyer-save',
          headers: {},
          queryParams: {},
        },
        response: {
          status: 200,
          data: {},
          headers: {},
        },
        timestamp: new Date().toISOString(),
      };

      await provider.save(mockData);

      expect(mockFileSystem.writeAsStringAsync).not.toHaveBeenCalled();
    });

    it('should skip saving when response contains Metro rejection message', async () => {
      await provider.initialize();

      const mockData: MockData = {
        request: {
          method: 'GET',
          url: 'https://api.example.com/test',
          headers: {},
          queryParams: {},
        },
        response: {
          status: 200,
          data: { error: 'Cannot save Mockifyer sync endpoint requests' },
          headers: {},
        },
        timestamp: new Date().toISOString(),
      };

      await provider.save(mockData);

      expect(mockFileSystem.writeAsStringAsync).not.toHaveBeenCalled();
    });

    it('should attempt to save to project folder via Metro', async () => {
      await provider.initialize();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, filename: 'test.json' }),
        text: async () => '',
      });

      const mockData: MockData = {
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
      };

      await provider.save(mockData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/mockifyer-save'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should continue even if Metro save fails', async () => {
      await provider.initialize();

      mockFetch.mockRejectedValueOnce(new Error('Metro unavailable'));

      const mockData: MockData = {
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
      };

      // Should not throw
      await expect(provider.save(mockData)).resolves.not.toThrow();
      expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalled();
    });
  });

  describe('reload', () => {
    it('should reload device provider cache', async () => {
      await provider.initialize();

      const deviceProvider = (provider as any).deviceProvider;
      const reloadSpy = jest.spyOn(deviceProvider, 'reload');
      
      await provider.reload(false);
      
      expect(reloadSpy).toHaveBeenCalled();
      reloadSpy.mockRestore();
    });

    it('should sync from project folder before reload when syncFromProject is true', async () => {
      await provider.initialize();

      const fileContent = {
        request: { method: 'GET', url: 'https://api.example.com/test', headers: {}, queryParams: {} },
        response: { status: 200, data: {}, headers: {} },
        timestamp: new Date().toISOString(),
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            files: [{ filename: 'test.json', modificationTime: Date.now() }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            filename: 'test.json',
            content: fileContent,
          }),
        });

      await provider.reload(true);

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockMetroUrl}/mockifyer-sync-to-device-manifest`
      );
    });

    it('should skip sync when syncFromProject is false', async () => {
      await provider.initialize();

      await provider.reload(false);

      // Should not call sync endpoint
      const syncCalls = mockFetch.mock.calls.filter(call =>
        call[0] &&
        typeof call[0] === 'string' &&
        (call[0].includes('/mockifyer-sync-to-device-manifest') ||
          call[0].includes('/mockifyer-sync-to-device-file'))
      );
      expect(syncCalls.length).toBe(0);
    });

    it('should continue reload even if sync fails', async () => {
      await provider.initialize();

      mockFetch.mockRejectedValueOnce(new Error('Sync failed'));

      await expect(provider.reload(true)).resolves.not.toThrow();
    });
  });

  describe('syncFromProjectFolder', () => {
    it('should fetch files from Metro endpoint and save to device', async () => {
      await provider.initialize();

      const mockFiles = [
        {
          filename: 'test1.json',
          content: {
            request: { method: 'GET', url: 'https://api.example.com/test1', headers: {}, queryParams: {} },
            response: { status: 200, data: { id: 1 }, headers: {} },
            timestamp: new Date().toISOString(),
          },
          modificationTime: Date.now(),
        },
        {
          filename: 'test2.json',
          content: {
            request: { method: 'GET', url: 'https://api.example.com/test2', headers: {}, queryParams: {} },
            response: { status: 200, data: { id: 2 }, headers: {} },
            timestamp: new Date().toISOString(),
          },
          modificationTime: Date.now(),
        },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            files: mockFiles.map((f) => ({ filename: f.filename, modificationTime: f.modificationTime })),
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            filename: mockFiles[0].filename,
            content: mockFiles[0].content,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            filename: mockFiles[1].filename,
            content: mockFiles[1].content,
          }),
        });

      await (provider as any).syncFromProjectFolder();

      expect(mockFetch).toHaveBeenCalledWith(`${mockMetroUrl}/mockifyer-sync-to-device-manifest`);
      // Files should be saved to device
      expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalled();
    });

    it('should handle empty file list', async () => {
      await provider.initialize();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          files: [],
        }),
      });

      await (provider as any).syncFromProjectFolder();

      expect(mockFileSystem.writeAsStringAsync).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(`${mockMetroUrl}/mockifyer-sync-to-device-manifest`);
    });

    it('should throw error when Metro endpoint fails', async () => {
      await provider.initialize();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({}),
      });

      await expect((provider as any).syncFromProjectFolder()).rejects.toThrow();
    });

    it('should handle individual file save failures gracefully', async () => {
      await provider.initialize();

      const mockFiles = [
        {
          filename: 'test1.json',
          content: {
            request: { method: 'GET', url: 'https://api.example.com/test1', headers: {}, queryParams: {} },
            response: { status: 200, data: {}, headers: {} },
            timestamp: new Date().toISOString(),
          },
          modificationTime: Date.now(),
        },
        {
          filename: 'test2.json',
          content: {
            request: { method: 'GET', url: 'https://api.example.com/test2', headers: {}, queryParams: {} },
            response: { status: 200, data: {}, headers: {} },
            timestamp: new Date().toISOString(),
          },
          modificationTime: Date.now(),
        },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            files: mockFiles.map((f) => ({ filename: f.filename, modificationTime: f.modificationTime })),
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            filename: mockFiles[0].filename,
            content: mockFiles[0].content,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            filename: mockFiles[1].filename,
            content: mockFiles[1].content,
          }),
        });

      mockFileSystem.writeAsStringAsync
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Save failed'));

      await (provider as any).syncFromProjectFolder();

      expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe('findExactMatch', () => {
    it('should delegate to device provider', async () => {
      await provider.initialize();

      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: {},
        queryParams: {},
      };
      const requestKey = generateRequestKey(request);

      mockFileSystem.readDirectoryAsync.mockResolvedValue([]);
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: false });

      const result = await provider.findExactMatch(request, requestKey);

      // Should have attempted to find the match (may return undefined if not found)
      expect(result).toBeUndefined();
    });
  });

  describe('clearAll', () => {
    it('should clear device provider and Metro endpoint', async () => {
      await provider.initialize();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '',
      });

      await provider.clearAll();

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockMetroUrl}/mockifyer-clear`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should handle Metro clear failure gracefully', async () => {
      await provider.initialize();

      mockFetch.mockRejectedValueOnce(new Error('Clear failed'));

      await expect(provider.clearAll()).resolves.not.toThrow();
    });
  });
});

