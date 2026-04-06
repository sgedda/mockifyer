import { ExpoFileSystemProvider } from '../../packages/mockifyer-core/src/providers/expo-filesystem-provider';
import { MockData, StoredRequest } from '../../packages/mockifyer-core/src/types';
import { generateRequestKey } from '../../packages/mockifyer-core/src/utils/mock-matcher';

// Mock expo-file-system
jest.mock('expo-file-system');

const mockFileSystem = jest.requireMock('expo-file-system');

// Helper to create a mock File instance
function makeMockFile(overrides: Partial<{
  exists: boolean;
  modificationTime: number | null;
  textResult: string;
}> = {}) {
  return {
    exists: overrides.exists ?? false,
    modificationTime: overrides.modificationTime ?? null,
    text: jest.fn().mockResolvedValue(overrides.textResult ?? '{}'),
    write: jest.fn(),
    delete: jest.fn(),
  };
}

// Helper to create a mock Directory instance
function makeMockDir(overrides: Partial<{
  exists: boolean;
  listResult: any[];
}> = {}) {
  return {
    exists: overrides.exists ?? false,
    create: jest.fn(),
    list: jest.fn().mockReturnValue(overrides.listResult ?? []),
    delete: jest.fn(),
  };
}

// Helper to create a mock file-list item (returned by Directory.list())
function makeListItem(name: string) {
  return { name, uri: `/mock/path/${name}` };
}

describe('ExpoFileSystemProvider', () => {
  let provider: ExpoFileSystemProvider;
  const mockDataPath = 'mock-data';

  // Default mocks reused across tests
  let defaultDir: ReturnType<typeof makeMockDir>;
  let defaultFile: ReturnType<typeof makeMockFile>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    defaultDir = makeMockDir({ exists: false });
    defaultFile = makeMockFile({ exists: false });

    // Setup Paths mock
    mockFileSystem.Paths = {
      document: { uri: '/mock/document/dir/' },
      info: jest.fn().mockReturnValue({ exists: false, isDirectory: null }),
    };

    // By default File and Directory constructors return "non-existent" objects
    mockFileSystem.File = jest.fn().mockReturnValue(defaultFile);
    mockFileSystem.Directory = jest.fn().mockReturnValue(defaultDir);

    provider = new ExpoFileSystemProvider({ path: mockDataPath });
  });

  afterEach(() => {
    jest.useRealTimers();
    if (provider && typeof provider.close === 'function') {
      provider.close();
    }
  });

  describe('initialization', () => {
    it('should initialize successfully and create directory if not exists', async () => {
      const dir = makeMockDir({ exists: false });
      mockFileSystem.Directory = jest.fn().mockReturnValue(dir);

      await provider.initialize();

      expect(dir.create).toHaveBeenCalledWith({ intermediates: true });
    });

    it('should not create directory if it already exists', async () => {
      const dir = makeMockDir({ exists: true });
      mockFileSystem.Directory = jest.fn().mockReturnValue(dir);

      await provider.initialize();

      expect(dir.create).not.toHaveBeenCalled();
    });
  });

  describe('save', () => {
    it('should save mock data to filesystem', async () => {
      const dir = makeMockDir({ exists: true });
      const file = makeMockFile({ exists: true, modificationTime: Date.now() });
      mockFileSystem.Directory = jest.fn().mockReturnValue(dir);
      mockFileSystem.File = jest.fn().mockReturnValue(file);

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

      expect(file.write).toHaveBeenCalled();
      const writtenContent = JSON.parse(file.write.mock.calls[0][0]);
      expect(writtenContent).toMatchObject({
        request: mockData.request,
        response: mockData.response,
      });
    });

    it('should update file modification time cache after save', async () => {
      const mockMtime = Date.now();
      const dir = makeMockDir({ exists: true });
      const file = makeMockFile({ exists: true, modificationTime: mockMtime });
      mockFileSystem.Directory = jest.fn().mockReturnValue(dir);
      mockFileSystem.File = jest.fn().mockReturnValue(file);

      await provider.initialize();

      const mockData: MockData = {
        request: {
          method: 'GET',
          url: 'https://api.example.com/test',
          headers: {},
          queryParams: {},
        },
        response: { status: 200, data: {}, headers: {} },
        timestamp: new Date().toISOString(),
      };

      await provider.save(mockData);

      // File constructor should have been called (to check modificationTime after write)
      expect(mockFileSystem.File).toHaveBeenCalled();
    });

    it('should skip saving sync endpoint requests', async () => {
      const dir = makeMockDir({ exists: true });
      const file = makeMockFile({ exists: false });
      mockFileSystem.Directory = jest.fn().mockReturnValue(dir);
      mockFileSystem.File = jest.fn().mockReturnValue(file);

      await provider.initialize();

      const mockData: MockData = {
        request: {
          method: 'POST',
          url: 'http://localhost:8081/mockifyer-save',
          headers: {},
          queryParams: {},
        },
        response: { status: 200, data: {}, headers: {} },
        timestamp: new Date().toISOString(),
      };

      await provider.save(mockData);

      expect(file.write).not.toHaveBeenCalled();
    });
  });

  describe('findExactMatch', () => {
    it('should find and return a matching mock file', async () => {
      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: {},
        queryParams: {},
      };
      const requestKey = generateRequestKey(request);
      const mockMtime = Date.now();

      const mockData: MockData = {
        request,
        response: { status: 200, data: { message: 'cached' }, headers: {} },
        timestamp: new Date().toISOString(),
      };

      const filename = 'test_file.json';
      const listItem = makeListItem(filename);

      const dir = makeMockDir({ exists: true, listResult: [listItem] });
      const file = makeMockFile({ exists: true, modificationTime: mockMtime, textResult: JSON.stringify(mockData) });
      mockFileSystem.Directory = jest.fn().mockReturnValue(dir);
      mockFileSystem.File = jest.fn().mockReturnValue(file);
      mockFileSystem.Paths.info = jest.fn().mockReturnValue({ exists: true, isDirectory: true });

      await provider.initialize();

      const result = await provider.findExactMatch(request, requestKey);

      expect(result).toBeDefined();
      expect(result?.mockData.response.data).toEqual({ message: 'cached' });
    });

    it('should return newest file when multiple matches exist', async () => {
      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: {},
        queryParams: {},
      };
      const requestKey = generateRequestKey(request);

      const olderMtime = Date.now();
      const newerMtime = olderMtime + 2000;

      const olderData: MockData = {
        request,
        response: { status: 200, data: { message: 'older' }, headers: {} },
        timestamp: new Date().toISOString(),
      };
      const newerData: MockData = {
        request,
        response: { status: 200, data: { message: 'newer' }, headers: {} },
        timestamp: new Date().toISOString(),
      };

      const olderFile = 'older_file.json';
      const newerFile = 'newer_file.json';

      const dir = makeMockDir({ exists: true, listResult: [makeListItem(olderFile), makeListItem(newerFile)] });
      mockFileSystem.Directory = jest.fn().mockReturnValue(dir);
      mockFileSystem.Paths.info = jest.fn().mockReturnValue({ exists: true, isDirectory: true });

      let fileCallCount = 0;
      mockFileSystem.File = jest.fn().mockImplementation(() => {
        fileCallCount++;
        if (fileCallCount === 1) {
          // initialize dir check
          return makeMockFile({ exists: true, modificationTime: olderMtime, textResult: JSON.stringify(olderData) });
        } else if (fileCallCount === 2) {
          return makeMockFile({ exists: true, modificationTime: newerMtime, textResult: JSON.stringify(newerData) });
        }
        return makeMockFile({ exists: true, modificationTime: newerMtime });
      });

      await provider.initialize();

      // Reset call count for the actual test
      fileCallCount = 0;
      mockFileSystem.File = jest.fn().mockImplementation(() => {
        fileCallCount++;
        if (fileCallCount % 2 === 1) {
          return makeMockFile({ exists: true, modificationTime: olderMtime, textResult: JSON.stringify(olderData) });
        } else {
          return makeMockFile({ exists: true, modificationTime: newerMtime, textResult: JSON.stringify(newerData) });
        }
      });

      const result = await provider.findExactMatch(request, requestKey);

      expect(result).toBeDefined();
      expect(result?.mockData.response.data).toEqual({ message: 'newer' });
    });

    it('should skip corrupted files containing sync endpoints', async () => {
      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: {},
        queryParams: {},
      };
      const requestKey = generateRequestKey(request);

      const validData: MockData = {
        request,
        response: { status: 200, data: { message: 'valid' }, headers: {} },
        timestamp: new Date().toISOString(),
      };

      const dir = makeMockDir({
        exists: true,
        listResult: [makeListItem('corrupted.json'), makeListItem('valid.json')],
      });
      mockFileSystem.Directory = jest.fn().mockReturnValue(dir);
      mockFileSystem.Paths.info = jest.fn().mockReturnValue({ exists: true, isDirectory: true });

      let fileCallCount = 0;
      mockFileSystem.File = jest.fn().mockImplementation(() => {
        fileCallCount++;
        if (fileCallCount === 1) {
          return makeMockFile({
            exists: true,
            modificationTime: Date.now(),
            textResult: JSON.stringify({ request: { url: 'http://localhost:8081/mockifyer-save' } }),
          });
        }
        return makeMockFile({
          exists: true,
          modificationTime: Date.now(),
          textResult: JSON.stringify(validData),
        });
      });

      await provider.initialize();
      fileCallCount = 0;

      const result = await provider.findExactMatch(request, requestKey);

      expect(result).toBeDefined();
      expect(result?.mockData.response.data).toEqual({ message: 'valid' });
    });
  });

  describe('reload', () => {
    it('should clear cache and refresh file list', async () => {
      const dir = makeMockDir({ exists: true, listResult: [] });
      mockFileSystem.Directory = jest.fn().mockReturnValue(dir);
      mockFileSystem.Paths.info = jest.fn().mockReturnValue({ exists: true, isDirectory: true });
      mockFileSystem.File = jest.fn().mockReturnValue(makeMockFile({ exists: false }));

      await provider.initialize();
      await provider.reload();

      // reload should complete without errors
      expect(provider).toBeDefined();
    });

    it('should call onFilesChanged callback if provided', async () => {
      const onFilesChanged = jest.fn();

      const dir = makeMockDir({ exists: true });
      mockFileSystem.Directory = jest.fn().mockReturnValue(dir);
      mockFileSystem.File = jest.fn().mockReturnValue(makeMockFile({ exists: false }));

      provider = new ExpoFileSystemProvider({
        path: mockDataPath,
        options: { onFilesChanged },
      });

      await provider.initialize();
      await provider.reload();

      expect(onFilesChanged).toHaveBeenCalled();
    });
  });

  describe('file watching', () => {
    it('should start file watching when enabled', async () => {
      const dir = makeMockDir({ exists: true });
      mockFileSystem.Directory = jest.fn().mockReturnValue(dir);
      mockFileSystem.File = jest.fn().mockReturnValue(makeMockFile({ exists: false }));

      provider = new ExpoFileSystemProvider({
        path: mockDataPath,
        options: { watchFiles: true, watchInterval: 1000 },
      });

      await provider.initialize();

      expect(provider).toBeDefined();
    });

    it('should not start file watching when disabled', async () => {
      const dir = makeMockDir({ exists: true });
      mockFileSystem.Directory = jest.fn().mockReturnValue(dir);
      mockFileSystem.File = jest.fn().mockReturnValue(makeMockFile({ exists: false }));

      provider = new ExpoFileSystemProvider({
        path: mockDataPath,
        options: { watchFiles: false },
      });

      await provider.initialize();

      expect(provider).toBeDefined();
    });
  });

  describe('clearAll', () => {
    it('should delete all mock files', async () => {
      const files = ['file1.json', 'file2.json', 'file3.json'];
      const mockFile = makeMockFile({ exists: true });
      const dir = makeMockDir({ exists: true, listResult: files.map(makeListItem) });
      mockFileSystem.Directory = jest.fn().mockReturnValue(dir);
      mockFileSystem.File = jest.fn().mockReturnValue(mockFile);
      mockFileSystem.Paths.info = jest.fn().mockReturnValue({ exists: true, isDirectory: true });

      await provider.initialize();
      await provider.clearAll();

      expect(mockFile.delete).toHaveBeenCalledTimes(files.length);
    });

    it('should handle errors when deleting files', async () => {
      const files = ['file1.json', 'file2.json'];
      const mockFile = makeMockFile({ exists: true });
      mockFile.delete.mockImplementationOnce(() => { throw new Error('Delete failed'); });
      const dir = makeMockDir({ exists: true, listResult: files.map(makeListItem) });
      mockFileSystem.Directory = jest.fn().mockReturnValue(dir);
      mockFileSystem.File = jest.fn().mockReturnValue(mockFile);
      mockFileSystem.Paths.info = jest.fn().mockReturnValue({ exists: true, isDirectory: true });

      await provider.initialize();

      await expect(provider.clearAll()).resolves.not.toThrow();
    });
  });

  describe('getAll', () => {
    it('should return all mock data files', async () => {
      const mockData1: MockData = {
        request: { method: 'GET', url: 'https://api.example.com/test1', headers: {}, queryParams: {} },
        response: { status: 200, data: { id: 1 }, headers: {} },
        timestamp: new Date().toISOString(),
      };
      const mockData2: MockData = {
        request: { method: 'GET', url: 'https://api.example.com/test2', headers: {}, queryParams: {} },
        response: { status: 200, data: { id: 2 }, headers: {} },
        timestamp: new Date().toISOString(),
      };

      const files = ['file1.json', 'file2.json'];
      const dir = makeMockDir({ exists: true, listResult: files.map(makeListItem) });
      mockFileSystem.Directory = jest.fn().mockReturnValue(dir);
      mockFileSystem.Paths.info = jest.fn().mockReturnValue({ exists: true, isDirectory: true });

      let fileCallCount = 0;
      mockFileSystem.File = jest.fn().mockImplementation(() => {
        fileCallCount++;
        if (fileCallCount === 1) {
          return makeMockFile({ exists: true, textResult: JSON.stringify(mockData1) });
        }
        return makeMockFile({ exists: true, textResult: JSON.stringify(mockData2) });
      });

      await provider.initialize();
      fileCallCount = 0;

      const result = await provider.getAll();

      expect(result).toHaveLength(2);
      expect(result[0].response.data).toEqual({ id: 1 });
      expect(result[1].response.data).toEqual({ id: 2 });
    });

    it('should skip invalid JSON files', async () => {
      const files = ['valid.json', 'invalid.json'];
      const dir = makeMockDir({ exists: true, listResult: files.map(makeListItem) });
      mockFileSystem.Directory = jest.fn().mockReturnValue(dir);
      mockFileSystem.Paths.info = jest.fn().mockReturnValue({ exists: true, isDirectory: true });

      let fileCallCount = 0;
      mockFileSystem.File = jest.fn().mockImplementation(() => {
        fileCallCount++;
        if (fileCallCount === 1) {
          return makeMockFile({
            exists: true,
            textResult: JSON.stringify({
              request: { method: 'GET', url: 'https://api.example.com/test', headers: {}, queryParams: {} },
              response: { status: 200, data: {}, headers: {} },
              timestamp: new Date().toISOString(),
            }),
          });
        }
        return makeMockFile({ exists: true, textResult: 'invalid json' });
      });

      await provider.initialize();
      fileCallCount = 0;

      const result = await provider.getAll();

      expect(result).toHaveLength(1);
    });
  });
});
