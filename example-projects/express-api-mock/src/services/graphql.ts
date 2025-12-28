import { HTTPClient } from '@sgedda/mockifyer-core';
import { setupMockifyer } from '@sgedda/mockifyer-axios';
import path from 'path';

export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{ message: string; locations?: any[]; path?: any[] }>;
}

export class GraphQLService {
  private readonly baseUrl: string;
  private readonly httpClient: HTTPClient;

  constructor() {
    // Using Rick and Morty GraphQL API as a public example
    this.baseUrl = process.env.GRAPHQL_API_URL || 'https://rickandmortyapi.com/graphql';
    
    // Initialize mockifyer if enabled
    const mockDataPath = process.env.MOCKIFYER_PATH 
      ? (path.isAbsolute(process.env.MOCKIFYER_PATH) 
          ? process.env.MOCKIFYER_PATH 
          : path.join(process.cwd(), process.env.MOCKIFYER_PATH))
      : path.join(process.cwd(), 'mock-data');
    
    console.log('[GraphQLService] Mock data path:', {
      envPath: process.env.MOCKIFYER_PATH,
      resolvedPath: mockDataPath,
      cwd: process.cwd(),
      pathExists: require('fs').existsSync(mockDataPath)
    });
    
    if (process.env.MOCKIFYER_ENABLED === 'true') {
      this.httpClient = setupMockifyer({
        mockDataPath: mockDataPath,
        recordMode: process.env.MOCKIFYER_RECORD === 'true',
        failOnMissingMock: false,
        recordSameEndpoints: process.env.MOCKIFYER_RECORD_SAME_ENDPOINTS === 'true',
        useSimilarMatch: process.env.MOCKIFYER_USE_SIMILAR_MATCH === 'true',
        useSimilarMatchCheckResponse: process.env.MOCKIFYER_USE_SIMILAR_MATCH_CHECK_RESPONSE === 'true',
        // For GraphQL, we want to match based on the query string in the body
        similarMatchRequiredParams: []
      });
    } else {
      this.httpClient = setupMockifyer({
        mockDataPath: mockDataPath,
        recordMode: false,
        failOnMissingMock: false
      });
    }

    console.log('[GraphQLService] Initialized with:', {
      baseUrl: this.baseUrl,
      mockEnabled: process.env.MOCKIFYER_ENABLED,
      mockRecord: process.env.MOCKIFYER_RECORD,
      mockPath: process.env.MOCKIFYER_PATH
    });
  }

  async executeQuery<T = any>(
    query: string,
    variables?: Record<string, any>
  ): Promise<{ data: GraphQLResponse<T>; headers: Record<string, string> }> {
    try {
      console.log('[GraphQLService] Making GraphQL request:', {
        url: this.baseUrl,
        queryLength: query.length,
        hasVariables: !!variables,
        mockEnabled: process.env.MOCKIFYER_ENABLED,
        mockRecord: process.env.MOCKIFYER_RECORD
      });

      const response = await this.httpClient.post(
        this.baseUrl,
        {
          query,
          variables: variables || {}
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      // Check for mockifyer header (case-insensitive)
      const isMocked = response.headers && (
        response.headers['x-mockifyer'] === 'true' ||
        response.headers['X-Mockifyer'] === 'true' ||
        response.headers['X-MOCKIFYER'] === 'true'
      );
      
      console.log('[GraphQLService] Received response:', {
        status: response.status,
        hasData: !!response.data,
        isMocked: isMocked,
        hasErrors: !!response.data?.errors
      });

      return {
        data: response.data as GraphQLResponse<T>,
        headers: response.headers as Record<string, string>
      };
    } catch (error: any) {
      console.error('[GraphQLService] Error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        mockEnabled: process.env.MOCKIFYER_ENABLED,
        mockRecord: process.env.MOCKIFYER_RECORD
      });
      throw new Error(`Failed to execute GraphQL query: ${error.message}`);
    }
  }
}

export const graphqlService = new GraphQLService();

