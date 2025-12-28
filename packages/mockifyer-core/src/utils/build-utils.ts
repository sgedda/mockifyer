import fs from 'fs';
import path from 'path';
import { MockData } from '../types';

/**
 * Build-time utilities for using mock data during build processes.
 * Useful for static site generation, build-time data fetching, and embedding mock data.
 */

export interface BuildMockDataOptions {
  /** Path to mock data directory */
  mockDataPath: string;
  /** Filter function to select specific mock files */
  filter?: (filename: string, data: MockData) => boolean;
  /** Transform function to modify mock data before returning */
  transform?: (data: MockData, filename: string) => any;
  /** Whether to include request data */
  includeRequest?: boolean;
  /** Whether to include response data */
  includeResponse?: boolean;
  /** Whether to include metadata (timestamp, scenario, etc.) */
  includeMetadata?: boolean;
}

export interface BuildMockDataResult {
  /** Array of processed mock data */
  data: any[];
  /** Map of URL to mock data for quick lookup */
  byUrl: Map<string, any>;
  /** Map of method+URL to mock data */
  byMethodAndUrl: Map<string, any>;
  /** Total count of mock files */
  count: number;
}

/**
 * Load and process mock data files for use during build time.
 * 
 * @example
 * ```typescript
 * // In Next.js getStaticProps
 * import { loadMockDataForBuild } from '@sgedda/mockifyer-core/utils/build-utils';
 * 
 * export async function getStaticProps() {
 *   const mockData = loadMockDataForBuild({
 *     mockDataPath: './mock-data',
 *     filter: (filename, data) => data.request.method === 'GET',
 *     transform: (data) => data.response.data
 *   });
 *   
 *   return {
 *     props: {
 *       posts: mockData.data
 *     }
 *   };
 * }
 * ```
 */
export function loadMockDataForBuild(options: BuildMockDataOptions): BuildMockDataResult {
  const {
    mockDataPath,
    filter,
    transform,
    includeRequest = true,
    includeResponse = true,
    includeMetadata = false
  } = options;

  if (!fs.existsSync(mockDataPath)) {
    console.warn(`[BuildUtils] Mock data path does not exist: ${mockDataPath}`);
    return {
      data: [],
      byUrl: new Map(),
      byMethodAndUrl: new Map(),
      count: 0
    };
  }

  const files = fs.readdirSync(mockDataPath)
    .filter(file => file.endsWith('.json') && file !== 'date-config.json');

  const result: any[] = [];
  const byUrl = new Map<string, any>();
  const byMethodAndUrl = new Map<string, any>();

  for (const file of files) {
    try {
      const filePath = path.join(mockDataPath, file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const mockData: MockData = JSON.parse(fileContent);

      // Apply filter if provided
      if (filter && !filter(file, mockData)) {
        continue;
      }

      // Build the data object based on include options
      let processedData: any = {};

      if (includeRequest) {
        processedData.request = mockData.request;
      }

      if (includeResponse) {
        processedData.response = mockData.response;
      }

      if (includeMetadata) {
        processedData.timestamp = mockData.timestamp;
        processedData.scenario = mockData.scenario;
        processedData.sessionId = (mockData as any).sessionId;
        processedData.requestId = (mockData as any).requestId;
        processedData.parentRequestId = (mockData as any).parentRequestId;
        processedData.source = (mockData as any).source;
        processedData.duration = (mockData as any).duration;
      }

      processedData._filename = file;
      processedData._filePath = filePath;

      // Apply transform if provided
      const finalData = transform ? transform(processedData, file) : processedData;

      result.push(finalData);

      // Build lookup maps
      if (mockData.request?.url) {
        byUrl.set(mockData.request.url, finalData);
        
        const method = mockData.request.method || 'GET';
        const key = `${method}:${mockData.request.url}`;
        byMethodAndUrl.set(key, finalData);
      }
    } catch (error) {
      console.warn(`[BuildUtils] Failed to load mock file ${file}:`, error);
    }
  }

  return {
    data: result,
    byUrl,
    byMethodAndUrl,
    count: result.length
  };
}

/**
 * Get mock data for a specific URL.
 * 
 * @example
 * ```typescript
 * const mockData = getMockDataByUrl('./mock-data', 'https://api.example.com/posts');
 * ```
 */
export function getMockDataByUrl(mockDataPath: string, url: string): any | null {
  const result = loadMockDataForBuild({ mockDataPath });
  return result.byUrl.get(url) || null;
}

/**
 * Get mock data for a specific method and URL.
 * 
 * @example
 * ```typescript
 * const mockData = getMockDataByMethodAndUrl('./mock-data', 'GET', 'https://api.example.com/posts');
 * ```
 */
export function getMockDataByMethodAndUrl(
  mockDataPath: string,
  method: string,
  url: string
): any | null {
  const result = loadMockDataForBuild({ mockDataPath });
  const key = `${method.toUpperCase()}:${url}`;
  return result.byMethodAndUrl.get(key) || null;
}

/**
 * Generate a static data file from mock data.
 * Useful for embedding mock data into build output.
 * 
 * @example
 * ```typescript
 * // In build script
 * generateStaticDataFile({
 *   mockDataPath: './mock-data',
 *   outputPath: './public/static-data.json',
 *   transform: (data) => data.response.data
 * });
 * ```
 */
export function generateStaticDataFile(options: BuildMockDataOptions & {
  outputPath: string;
  format?: 'json' | 'typescript' | 'javascript';
  variableName?: string;
}): void {
  const {
    outputPath,
    format = 'json',
    variableName = 'mockData',
    ...loadOptions
  } = options;

  const result = loadMockDataForBuild(loadOptions);

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let content: string;

  switch (format) {
    case 'typescript':
      // Format TypeScript with proper handling of undefined values
      // Use a custom replacer to preserve undefined values as strings, then replace them
      const formattedData = JSON.stringify(result.data, (key, value) => {
        // Convert null to a special marker for optional fields that should be undefined
        if (value === null && (key === 'scenario' || key === 'sessionId' || 
            key === 'requestId' || key === 'parentRequestId' || key === 'source' || 
            key === 'callStack' || key === 'duration' || key === 'responseTime')) {
          return '__UNDEFINED__';
        }
        return value;
      }, 2)
        // Replace the marker with actual undefined
        .replace(/:\s*"__UNDEFINED__"/g, ': undefined')
        // Also handle null values that weren't caught (convert to undefined)
        .replace(/:\s*null(?=\s*[,}\n])/g, ': undefined');
      content = `export const ${variableName} = ${formattedData} as const;\n`;
      break;
    case 'javascript':
      content = `export const ${variableName} = ${JSON.stringify(result.data, null, 2)};\n`;
      break;
    case 'json':
    default:
      content = JSON.stringify(result.data, null, 2);
      break;
  }

  fs.writeFileSync(outputPath, content, 'utf-8');
  console.log(`[BuildUtils] Generated static data file: ${outputPath} (${result.count} items)`);
}

/**
 * Generate TypeScript types from mock data structure.
 * 
 * @example
 * ```typescript
 * generateTypesFromMockData({
 *   mockDataPath: './mock-data',
 *   outputPath: './types/mock-data.d.ts'
 * });
 * ```
 */
export function generateTypesFromMockData(options: {
  mockDataPath: string;
  outputPath: string;
  typeName?: string;
  filter?: (filename: string, data: MockData) => boolean;
}): void {
  const {
    mockDataPath,
    outputPath,
    typeName = 'MockDataItem',
    filter
  } = options;

  const result = loadMockDataForBuild({
    mockDataPath,
    filter,
    includeRequest: true,
    includeResponse: true,
    includeMetadata: true
  });

  if (result.data.length === 0) {
    console.warn('[BuildUtils] No mock data found to generate types from');
    return;
  }

  // Analyze the structure of the first item to generate types
  const sample = result.data[0];
  const typeDefinition = generateTypeDefinition(sample, typeName);

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const content = `// Auto-generated types from mock data
// Generated at: ${new Date().toISOString()}
// Total items: ${result.count}

export interface ${typeName} ${typeDefinition}

export type MockDataArray = ${typeName}[];

export interface MockDataIndex {
  byUrl: Record<string, ${typeName}>;
  byMethodAndUrl: Record<string, ${typeName}>;
}
`;

  fs.writeFileSync(outputPath, content, 'utf-8');
  console.log(`[BuildUtils] Generated types file: ${outputPath}`);
}

/**
 * Helper function to generate TypeScript type definition from a sample object
 */
function generateTypeDefinition(obj: any, typeName: string, depth = 0): string {
  if (depth > 5) {
    return 'any'; // Prevent infinite recursion
  }

  if (obj === null || obj === undefined) {
    return 'null';
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return 'any[]';
    }
    const itemType = generateTypeDefinition(obj[0], typeName, depth + 1);
    return `${itemType}[]`;
  }

  if (typeof obj !== 'object') {
    return typeof obj;
  }

  const entries = Object.entries(obj);
  if (entries.length === 0) {
    return 'Record<string, never>';
  }

  const properties = entries.map(([key, value]) => {
    const valueType = generateTypeDefinition(value, typeName, depth + 1);
    const optional = value === null || value === undefined ? '?' : '';
    // Quote property names that contain hyphens, spaces, or other special characters
    const quotedKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `"${key}"`;
    return `  ${quotedKey}${optional}: ${valueType};`;
  }).join('\n');

  return `{\n${properties}\n}`;
}

/**
 * Pre-process mock data for build-time use.
 * Useful for Next.js, Gatsby, or other static site generators.
 * 
 * @example
 * ```typescript
 * // In build script or getStaticProps
 * const processedData = preprocessMockDataForBuild({
 *   mockDataPath: './mock-data',
 *   groupBy: 'endpoint', // or 'method', 'scenario', etc.
 *   sortBy: 'timestamp'
 * });
 * ```
 */
export function preprocessMockDataForBuild(options: BuildMockDataOptions & {
  groupBy?: 'endpoint' | 'method' | 'scenario' | 'session';
  sortBy?: 'timestamp' | 'filename' | 'url';
  sortOrder?: 'asc' | 'desc';
}): any {
  const {
    groupBy,
    sortBy = 'timestamp',
    sortOrder = 'desc',
    ...loadOptions
  } = options;

  let result = loadMockDataForBuild(loadOptions);

  // Sort data
  if (sortBy) {
    result.data.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'timestamp':
          aValue = a.timestamp || a._filename || '';
          bValue = b.timestamp || b._filename || '';
          break;
        case 'filename':
          aValue = a._filename || '';
          bValue = b._filename || '';
          break;
        case 'url':
          aValue = a.request?.url || '';
          bValue = b.request?.url || '';
          break;
        default:
          return 0;
      }

      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  // Group data if requested
  if (groupBy) {
    const grouped: Record<string, any[]> = {};

    for (const item of result.data) {
      let key: string;

      switch (groupBy) {
        case 'endpoint':
          key = item.request?.url?.split('?')[0] || 'unknown';
          break;
        case 'method':
          key = item.request?.method || 'GET';
          break;
        case 'scenario':
          key = item.scenario || 'default';
          break;
        case 'session':
          key = item.sessionId || 'unknown';
          break;
        default:
          key = 'default';
      }

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    }

    return {
      ...result,
      grouped,
      data: result.data // Keep flat array as well
    };
  }

  return result;
}

