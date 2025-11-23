import {
  generateRequestKey,
  isExactMatch,
  isSimilarPathMatch,
  doRequiredParamsMatch,
  findBestMatchingMock,
  CachedMockData,
  MockMatchingConfig
} from '../src/utils/mock-matcher';
import { StoredRequest, MockData } from '../src/types';

describe('mock-matcher', () => {
  describe('generateRequestKey', () => {
    it('should generate key for GET request without query params', () => {
      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: {},
        queryParams: {}
      };
      
      const key = generateRequestKey(request);
      expect(key).toBe('GET:https://api.example.com/users');
    });

    it('should generate key with query parameters', () => {
      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: {},
        queryParams: { id: '123', status: 'active' }
      };
      
      const key = generateRequestKey(request);
      expect(key).toContain('GET:https://api.example.com/users?');
      expect(key).toContain('id=123');
      expect(key).toContain('status=active');
    });

    it('should normalize method to uppercase', () => {
      const request: StoredRequest = {
        method: 'get',
        url: 'https://api.example.com/users',
        headers: {},
        queryParams: {}
      };
      
      const key = generateRequestKey(request);
      expect(key).toBe('GET:https://api.example.com/users');
    });

    it('should handle POST requests', () => {
      const request: StoredRequest = {
        method: 'POST',
        url: 'https://api.example.com/users',
        headers: {},
        queryParams: {}
      };
      
      const key = generateRequestKey(request);
      expect(key).toBe('POST:https://api.example.com/users');
    });

    it('should handle requests without method', () => {
      const request: StoredRequest = {
        method: undefined as any,
        url: 'https://api.example.com/users',
        headers: {},
        queryParams: {}
      };
      
      const key = generateRequestKey(request);
      expect(key).toBe('GET:https://api.example.com/users');
    });
  });

  describe('isExactMatch', () => {
    it('should return true for exact matches', () => {
      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: {},
        queryParams: { id: '123' }
      };
      
      const mockRequest: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: {},
        queryParams: { id: '123' }
      };
      
      expect(isExactMatch(request, mockRequest)).toBe(true);
    });

    it('should return false for different query params', () => {
      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: {},
        queryParams: { id: '123' }
      };
      
      const mockRequest: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: {},
        queryParams: { id: '456' }
      };
      
      expect(isExactMatch(request, mockRequest)).toBe(false);
    });

    it('should return false for different URLs', () => {
      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: {},
        queryParams: {}
      };
      
      const mockRequest: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/posts',
        headers: {},
        queryParams: {}
      };
      
      expect(isExactMatch(request, mockRequest)).toBe(false);
    });

    it('should return false for different methods', () => {
      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: {},
        queryParams: {}
      };
      
      const mockRequest: StoredRequest = {
        method: 'POST',
        url: 'https://api.example.com/users',
        headers: {},
        queryParams: {}
      };
      
      expect(isExactMatch(request, mockRequest)).toBe(false);
    });
  });

  describe('isSimilarPathMatch', () => {
    it('should return true for same path and method', () => {
      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/users?page=1',
        headers: {},
        queryParams: { page: '1' }
      };
      
      const mockRequest: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/users?page=2',
        headers: {},
        queryParams: { page: '2' }
      };
      
      expect(isSimilarPathMatch(request, mockRequest)).toBe(true);
    });

    it('should return false for different paths', () => {
      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: {},
        queryParams: {}
      };
      
      const mockRequest: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/posts',
        headers: {},
        queryParams: {}
      };
      
      expect(isSimilarPathMatch(request, mockRequest)).toBe(false);
    });

    it('should return false for different methods', () => {
      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: {},
        queryParams: {}
      };
      
      const mockRequest: StoredRequest = {
        method: 'POST',
        url: 'https://api.example.com/users',
        headers: {},
        queryParams: {}
      };
      
      expect(isSimilarPathMatch(request, mockRequest)).toBe(false);
    });

    it('should handle invalid URLs gracefully', () => {
      const request: StoredRequest = {
        method: 'GET',
        url: 'invalid-url',
        headers: {},
        queryParams: {}
      };
      
      const mockRequest: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: {},
        queryParams: {}
      };
      
      expect(isSimilarPathMatch(request, mockRequest)).toBe(false);
    });
  });

  describe('doRequiredParamsMatch', () => {
    it('should return true when all required params match', () => {
      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: {},
        queryParams: { season: '2022', league: '39' }
      };
      
      const mockRequest: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: {},
        queryParams: { season: '2022', league: '39' }
      };
      
      expect(doRequiredParamsMatch(request, mockRequest, ['season', 'league'])).toBe(true);
    });

    it('should return false when required params differ', () => {
      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: {},
        queryParams: { season: '2022', league: '39' }
      };
      
      const mockRequest: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: {},
        queryParams: { season: '2023', league: '39' }
      };
      
      expect(doRequiredParamsMatch(request, mockRequest, ['season', 'league'])).toBe(false);
    });

    it('should return true when both params are absent', () => {
      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: {},
        queryParams: {}
      };
      
      const mockRequest: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: {},
        queryParams: {}
      };
      
      expect(doRequiredParamsMatch(request, mockRequest, ['season', 'league'])).toBe(true);
    });

    it('should return false when one param is present and other is absent', () => {
      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: {},
        queryParams: { season: '2022' }
      };
      
      const mockRequest: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: {},
        queryParams: {}
      };
      
      expect(doRequiredParamsMatch(request, mockRequest, ['season'])).toBe(false);
    });

    it('should return true when no required params specified', () => {
      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: {},
        queryParams: { season: '2022' }
      };
      
      const mockRequest: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: {},
        queryParams: { season: '2023' }
      };
      
      expect(doRequiredParamsMatch(request, mockRequest, [])).toBe(true);
    });

    it('should handle string conversion for number params', () => {
      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: {},
        queryParams: { season: '2022' }
      };
      
      const mockRequest: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: {},
        queryParams: { season: 2022 as any } // Number as string
      };
      
      expect(doRequiredParamsMatch(request, mockRequest, ['season'])).toBe(true);
    });
  });

  describe('findBestMatchingMock', () => {
    const createMockData = (
      method: string,
      url: string,
      queryParams?: Record<string, string>
    ): CachedMockData => {
      return {
        mockData: {
          request: {
            method,
            url,
            headers: {},
            queryParams: queryParams || {}
          },
          response: {
            status: 200,
            data: {},
            headers: {}
          },
          timestamp: new Date().toISOString()
        },
        filename: 'test.json',
        filePath: '/test/test.json'
      };
    };

    it('should find exact match', () => {
      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: {},
        queryParams: { id: '123' }
      };

      const mockCache = new Map<string, CachedMockData>();
      const mock = createMockData('GET', 'https://api.example.com/users', { id: '123' });
      mockCache.set(generateRequestKey(mock.mockData.request), mock);

      const result = findBestMatchingMock(request, mockCache, {});
      expect(result).toBe(mock);
    });

    it('should return undefined when no exact match found and similar match disabled', () => {
      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: {},
        queryParams: { id: '123' }
      };

      const mockCache = new Map<string, CachedMockData>();
      const mock = createMockData('GET', 'https://api.example.com/users', { id: '456' });
      mockCache.set(generateRequestKey(mock.mockData.request), mock);

      const result = findBestMatchingMock(request, mockCache, { useSimilarMatch: false });
      expect(result).toBeUndefined();
    });

    it('should find similar match when enabled', () => {
      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/users?page=1',
        headers: {},
        queryParams: { page: '1' }
      };

      const mockCache = new Map<string, CachedMockData>();
      const mock = createMockData('GET', 'https://api.example.com/users?page=2', { page: '2' });
      mockCache.set(generateRequestKey(mock.mockData.request), mock);

      const result = findBestMatchingMock(request, mockCache, { useSimilarMatch: true });
      expect(result).toBe(mock);
    });

    it('should respect required params for similar match', () => {
      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/standings?season=2022&league=39',
        headers: {},
        queryParams: { season: '2022', league: '39' }
      };

      const mockCache = new Map<string, CachedMockData>();
      // Mock with different season
      const mock = createMockData(
        'GET',
        'https://api.example.com/standings?season=2021&league=39',
        { season: '2021', league: '39' }
      );
      mockCache.set(generateRequestKey(mock.mockData.request), mock);

      const config: MockMatchingConfig = {
        useSimilarMatch: true,
        similarMatchRequiredParams: ['season', 'league']
      };

      const result = findBestMatchingMock(request, mockCache, config);
      expect(result).toBeUndefined(); // Should not match because season differs
    });

    it('should match when required params match for similar match', () => {
      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/standings?season=2022&league=39&page=1',
        headers: {},
        queryParams: { season: '2022', league: '39', page: '1' }
      };

      const mockCache = new Map<string, CachedMockData>();
      // Mock with same season and league but different page
      const mock = createMockData(
        'GET',
        'https://api.example.com/standings?season=2022&league=39&page=2',
        { season: '2022', league: '39', page: '2' }
      );
      mockCache.set(generateRequestKey(mock.mockData.request), mock);

      const config: MockMatchingConfig = {
        useSimilarMatch: true,
        similarMatchRequiredParams: ['season', 'league']
      };

      const result = findBestMatchingMock(request, mockCache, config);
      expect(result).toBe(mock); // Should match because season and league match
    });

    it('should return undefined for invalid request URL', () => {
      const request: StoredRequest = {
        method: 'GET',
        url: 'invalid-url',
        headers: {},
        queryParams: {}
      };

      const mockCache = new Map<string, CachedMockData>();
      const result = findBestMatchingMock(request, mockCache, { useSimilarMatch: true });
      expect(result).toBeUndefined();
    });

    it('should handle empty cache', () => {
      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: {},
        queryParams: {}
      };

      const mockCache = new Map<string, CachedMockData>();
      const result = findBestMatchingMock(request, mockCache, {});
      expect(result).toBeUndefined();
    });

    it('should prioritize exact match over similar match', () => {
      const request: StoredRequest = {
        method: 'GET',
        url: 'https://api.example.com/users?id=123',
        headers: {},
        queryParams: { id: '123' }
      };

      const mockCache = new Map<string, CachedMockData>();
      
      // Exact match
      const exactMock = createMockData('GET', 'https://api.example.com/users', { id: '123' });
      mockCache.set(generateRequestKey(exactMock.mockData.request), exactMock);
      
      // Similar match (different query param)
      const similarMock = createMockData('GET', 'https://api.example.com/users', { id: '456' });
      mockCache.set(generateRequestKey(similarMock.mockData.request), similarMock);

      const result = findBestMatchingMock(request, mockCache, { useSimilarMatch: true });
      expect(result).toBe(exactMock);
    });
  });
});

