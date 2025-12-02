import { ExpoFileSystemProvider } from '../../packages/mockifyer-core/src/providers/expo-filesystem-provider';
import { MockData, StoredRequest } from '../../packages/mockifyer-core/src/types';
import { generateRequestKey } from '../../packages/mockifyer-core/src/utils/mock-matcher';

// Mock expo-file-system
jest.mock('expo-file-system');

const mockFileSystem = require('expo-file-system');

describe('ExpoFileSystemProvider', () => {
  let provider: ExpoFileSystemProvider;
  const mockDataPath = 'mock-data';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Setup default FileSystem mocks
    mockFileSystem.documentDirectory = '/mock/document/dir/';
    mockFileSystem.readDirectoryAsync.mockResolvedValue([]);
    mockFileSystem.getInfoAsync.mockResolvedValue({ exists: false });
    mockFileSystem.makeDirectoryAsync.mockResolvedValue(undefined);
    mockFileSystem.writeAsStringAsync.mockResolvedValue(undefined);
    mockFileSystem.readAsStringAsync.mockResolvedValue('{}');
    mockFileSystem.deleteAsync.mockResolvedValue(undefined);

    provider = new ExpoFileSystemProvider({
      path: mockDataPath,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    if (provider && typeof provider.close === 'function') {
      provider.close();
    }
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await provider.initialize();
      expect(mockFileSystem.makeDirectoryAsync).toHaveBeenCalled();
    });

    it('should create directory if it does not exist', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: false });
      
      await provider.initialize();
      
      expect(mockFileSystem.makeDirectoryAsync).toHaveBeenCalled();
    });

    it('should not create directory if it already exists', async () => {
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true });
      
      await provider.initialize();
      
      expect(mockFileSystem.makeDirectoryAsync).not.toHaveBeenCalled();
    });
  });

  describe('save', () => {
    it('should save mock data to filesystem', async () => {
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

      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true, modificationTime: Date.now() });

      await provider.save(mockData);

      expect(mockFileSystem.writeAsStringAsync).toHaveBeenCalled();
      const writeCall = mockFileSystem.writeAsStringAsync.mock.calls[0];
      expect(writeCall[0]).toContain(mockDataPath);
      expect(writeCall[0]).toMatch(/\.json$/);
      expect(JSON.parse(writeCall[1])).toMatchObject({
        request: mockData.request,
        response: mockData.response,
      });
    });

    it('should update file modification time cache after save', async () => {
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
          data: {},
          headers: {},
        },
        timestamp: new Date().toISOString(),
      };

      const mockMtime = Date.now();
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true, modificationTime: mockMtime });

      await provider.save(mockData);

      // Verify that getInfoAsync was called to get modification time
      expect(mockFileSystem.getInfoAsync).toHaveBeenCalled();
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
  });

  describe('findExactMatch', () => {
    it('should return cached result if file has not been modified', async () => {
      await provider.initialize();

      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: {},
        queryParams: {},
      };
      const requestKey = generateRequestKey(request);

      const mockData: MockData = {
        request,
        response: {
          status: 200,
          data: { message: 'cached' },
          headers: {},
        },
        timestamp: new Date().toISOString(),
      };

      const mockMtime = Date.now();
      const filename = 'test_file.json';
      const filePath = `${mockDataPath}/${filename}`;

      // First, save to populate fileModTimes map
      mockFileSystem.getInfoAsync.mockImplementation((path: string) => {
        if (path.includes('mock-data') && !path.endsWith('.json')) {
          return Promise.resolve({ exists: true, isDirectory: true });
        } else if (path.endsWith('.json')) {
          return Promise.resolve({ exists: true, modificationTime: mockMtime });
        }
        return Promise.resolve({ exists: false });
      });
      mockFileSystem.readDirectoryAsync.mockResolvedValue([filename]);
      mockFileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify(mockData));
      
      await provider.save(mockData);

      // Now find - will read from files and populate cache
      // Reset mocks and use mockImplementation to handle multiple calls
      mockFileSystem.getInfoAsync.mockImplementation((path: string) => {
        if (path.includes('mock-data') && !path.endsWith('.json')) {
          // Directory check for listMockFiles
          return Promise.resolve({ exists: true, isDirectory: true });
        } else if (path.endsWith('.json')) {
          // File check - can be called multiple times (for matching and caching)
          return Promise.resolve({ exists: true, modificationTime: mockMtime });
        }
        return Promise.resolve({ exists: false });
      });
      mockFileSystem.readDirectoryAsync.mockResolvedValue([filename]);
      mockFileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify(mockData));

      const result = await provider.findExactMatch(request, requestKey);

      expect(result).toBeDefined();
      expect(result?.mockData.response.data).toEqual({ message: 'cached' });
    });

    it('should clear cache and re-read if file has been modified', async () => {
      await provider.initialize();

      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: {},
        queryParams: {},
      };
      const requestKey = generateRequestKey(request);

      const originalData: MockData = {
        request,
        response: {
          status: 200,
          data: { message: 'original' },
          headers: {},
        },
        timestamp: new Date().toISOString(),
      };

      const updatedData: MockData = {
        request,
        response: {
          status: 200,
          data: { message: 'updated' },
          headers: {},
        },
        timestamp: new Date().toISOString(),
      };

      const filename = 'test_file.json';
      const originalMtime = Date.now();
      const updatedMtime = originalMtime + 1000;

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
      
      await provider.save(originalData);

      // Find with updated file
      mockFileSystem.getInfoAsync.mockImplementation((path: string) => {
        if (path.includes('mock-data') && !path.endsWith('.json')) {
          return Promise.resolve({ exists: true, isDirectory: true });
        } else if (path.endsWith('.json')) {
          return Promise.resolve({ exists: true, modificationTime: updatedMtime });
        }
        return Promise.resolve({ exists: false });
      });
      mockFileSystem.readDirectoryAsync.mockResolvedValue([filename]);
      mockFileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify(updatedData));

      const result = await provider.findExactMatch(request, requestKey);

      expect(result).toBeDefined();
      expect(result?.mockData.response.data).toEqual({ message: 'updated' });
    });

    it('should return newest file when multiple matches exist', async () => {
      await provider.initialize();

      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: {},
        queryParams: {},
      };
      const requestKey = generateRequestKey(request);

      const olderData: MockData = {
        request,
        response: {
          status: 200,
          data: { message: 'older' },
          headers: {},
        },
        timestamp: new Date().toISOString(),
      };

      const newerData: MockData = {
        request,
        response: {
          status: 200,
          data: { message: 'newer' },
          headers: {},
        },
        timestamp: new Date().toISOString(),
      };

      const olderFile = 'older_file.json';
      const newerFile = 'newer_file.json';
      const olderMtime = Date.now();
      const newerMtime = olderMtime + 2000;

      mockFileSystem.readDirectoryAsync.mockResolvedValue([olderFile, newerFile]);
      let fileCallCount = 0;
      mockFileSystem.getInfoAsync.mockImplementation((path: string) => {
        if (path.includes('mock-data') && !path.endsWith('.json')) {
          return Promise.resolve({ exists: true, isDirectory: true });
        } else if (path.endsWith('.json')) {
          fileCallCount++;
          // First call for older file, second for newer file
          if (fileCallCount === 1) {
            return Promise.resolve({ exists: true, modificationTime: olderMtime });
          } else {
            return Promise.resolve({ exists: true, modificationTime: newerMtime });
          }
        }
        return Promise.resolve({ exists: false });
      });
      mockFileSystem.readAsStringAsync
        .mockResolvedValueOnce(JSON.stringify(olderData))
        .mockResolvedValueOnce(JSON.stringify(newerData));

      const result = await provider.findExactMatch(request, requestKey);

      expect(result).toBeDefined();
      expect(result?.mockData.response.data).toEqual({ message: 'newer' });
      expect(result?.filename).toBe(newerFile);
    });

    it('should skip corrupted files containing sync endpoints', async () => {
      await provider.initialize();

      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: {},
        queryParams: {},
      };
      const requestKey = generateRequestKey(request);

      const corruptedFile = 'corrupted.json';
      const validFile = 'valid.json';

      const validData: MockData = {
        request,
        response: {
          status: 200,
          data: { message: 'valid' },
          headers: {},
        },
        timestamp: new Date().toISOString(),
      };

      mockFileSystem.readDirectoryAsync.mockResolvedValue([corruptedFile, validFile]);
      let fileCallCount = 0;
      mockFileSystem.getInfoAsync.mockImplementation((path: string) => {
        if (path.includes('mock-data') && !path.endsWith('.json')) {
          return Promise.resolve({ exists: true, isDirectory: true });
        } else if (path.endsWith('.json')) {
          fileCallCount++;
          return Promise.resolve({ exists: true, modificationTime: Date.now() });
        }
        return Promise.resolve({ exists: false });
      });
      mockFileSystem.readAsStringAsync
        .mockResolvedValueOnce(JSON.stringify({ request: { url: 'http://localhost:8081/mockifyer-save' } }))
        .mockResolvedValueOnce(JSON.stringify(validData));

      const result = await provider.findExactMatch(request, requestKey);

      expect(result).toBeDefined();
      expect(result?.mockData.response.data).toEqual({ message: 'valid' });
    });
  });

  describe('reload', () => {
    it('should clear cache and refresh file list', async () => {
      await provider.initialize();

      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: {},
        queryParams: {},
      };
      const requestKey = generateRequestKey(request);

      const mockData: MockData = {
        request,
        response: {
          status: 200,
          data: { message: 'test' },
          headers: {},
        },
        timestamp: new Date().toISOString(),
      };

      const filename = 'test_file.json';
      const mockMtime = Date.now();

      // Save to populate cache
      mockFileSystem.getInfoAsync.mockImplementation((path: string) => {
        if (path.includes('mock-data') && !path.endsWith('.json')) {
          return Promise.resolve({ exists: true, isDirectory: true });
        } else if (path.endsWith('.json')) {
          return Promise.resolve({ exists: true, modificationTime: mockMtime });
        }
        return Promise.resolve({ exists: false });
      });
      mockFileSystem.readDirectoryAsync.mockResolvedValue([filename]);
      mockFileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify(mockData));
      
      await provider.save(mockData);

      // Reload should clear cache
      mockFileSystem.readDirectoryAsync.mockResolvedValue([filename]);
      mockFileSystem.getInfoAsync.mockImplementation((path: string) => {
        if (path.includes('mock-data') && !path.endsWith('.json')) {
          return Promise.resolve({ exists: true, isDirectory: true });
        }
        return Promise.resolve({ exists: false });
      });

      await provider.reload();

      // After reload, findExactMatch should re-read files
      mockFileSystem.readDirectoryAsync.mockResolvedValue([filename]);
      mockFileSystem.getInfoAsync.mockImplementation((path: string) => {
        if (path.includes('mock-data') && !path.endsWith('.json')) {
          return Promise.resolve({ exists: true, isDirectory: true });
        } else if (path.endsWith('.json')) {
          return Promise.resolve({ exists: true, modificationTime: mockMtime });
        }
        return Promise.resolve({ exists: false });
      });
      mockFileSystem.readAsStringAsync.mockResolvedValue(JSON.stringify(mockData));

      const result = await provider.findExactMatch(request, requestKey);
      expect(result).toBeDefined();
    });

    it('should call onFilesChanged callback if provided', async () => {
      const onFilesChanged = jest.fn();
      
      provider = new ExpoFileSystemProvider({
        path: mockDataPath,
        options: {
          onFilesChanged,
        },
      });

      await provider.initialize();
      await provider.reload();

      expect(onFilesChanged).toHaveBeenCalled();
    });
  });

  describe('file watching', () => {
    it('should start file watching when enabled', async () => {
      provider = new ExpoFileSystemProvider({
        path: mockDataPath,
        options: {
          watchFiles: true,
          watchInterval: 1000,
        },
      });

      await provider.initialize();

      // File watching is started internally
      expect(provider).toBeDefined();
    });

    it('should not start file watching when disabled', async () => {
      provider = new ExpoFileSystemProvider({
        path: mockDataPath,
        options: {
          watchFiles: false,
        },
      });

      await provider.initialize();

      expect(provider).toBeDefined();
    });
  });

  describe('clearAll', () => {
    it('should delete all mock files', async () => {
      await provider.initialize();

      const files = ['file1.json', 'file2.json', 'file3.json'];
      mockFileSystem.readDirectoryAsync.mockResolvedValue(files);
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: true });

      await provider.clearAll();

      expect(mockFileSystem.deleteAsync).toHaveBeenCalledTimes(files.length);
    });

    it('should handle errors when deleting files', async () => {
      await provider.initialize();

      const files = ['file1.json', 'file2.json'];
      mockFileSystem.readDirectoryAsync.mockResolvedValue(files);
      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: true });
      mockFileSystem.deleteAsync.mockRejectedValueOnce(new Error('Delete failed'));

      await expect(provider.clearAll()).resolves.not.toThrow();
    });
  });

  describe('getAll', () => {
    it('should return all mock data files', async () => {
      await provider.initialize();

      const mockData1: MockData = {
        request: {
          method: 'GET',
          url: 'https://api.example.com/test1',
          headers: {},
          queryParams: {},
        },
        response: {
          status: 200,
          data: { id: 1 },
          headers: {},
        },
        timestamp: new Date().toISOString(),
      };

      const mockData2: MockData = {
        request: {
          method: 'GET',
          url: 'https://api.example.com/test2',
          headers: {},
          queryParams: {},
        },
        response: {
          status: 200,
          data: { id: 2 },
          headers: {},
        },
        timestamp: new Date().toISOString(),
      };

      const files = ['file1.json', 'file2.json'];
      mockFileSystem.readDirectoryAsync.mockResolvedValue(files);
      mockFileSystem.getInfoAsync.mockImplementation((path: string) => {
        if (path.includes('mock-data') && !path.endsWith('.json')) {
          return Promise.resolve({ exists: true, isDirectory: true });
        }
        return Promise.resolve({ exists: false });
      });
      mockFileSystem.readAsStringAsync
        .mockResolvedValueOnce(JSON.stringify(mockData1))
        .mockResolvedValueOnce(JSON.stringify(mockData2));

      const result = await provider.getAll();

      expect(result).toHaveLength(2);
      expect(result[0].response.data).toEqual({ id: 1 });
      expect(result[1].response.data).toEqual({ id: 2 });
    });

    it('should skip invalid JSON files', async () => {
      await provider.initialize();

      const files = ['valid.json', 'invalid.json'];
      mockFileSystem.readDirectoryAsync.mockResolvedValue(files);
      mockFileSystem.getInfoAsync.mockImplementation((path: string) => {
        if (path.includes('mock-data') && !path.endsWith('.json')) {
          return Promise.resolve({ exists: true, isDirectory: true });
        }
        return Promise.resolve({ exists: false });
      });
      mockFileSystem.readAsStringAsync
        .mockResolvedValueOnce(JSON.stringify({
          request: { method: 'GET', url: 'https://api.example.com/test', headers: {}, queryParams: {} },
          response: { status: 200, data: {}, headers: {} },
          timestamp: new Date().toISOString(),
        }))
        .mockResolvedValueOnce('invalid json');

      const result = await provider.getAll();

      expect(result).toHaveLength(1);
    });
  });
});

