import { setupMockifyer, MockifyerConfig } from '@sgedda/mockifyer-fetch';
import path from 'path';
import fs from 'fs';

let mockifyerInstance: any;
let mockDataPath: string;

/**
 * Auto-detects mock data path from common locations
 */
function detectMockDataPath(): string {
  // Try multiple common locations
  const possiblePaths = [
    process.env.MOCKIFYER_PATH,
    process.env.MOCKIFYER_MOCK_DATA_PATH,
    path.join(process.cwd(), 'mock-data'),
    path.join(process.cwd(), 'test-mock-data'),
    path.join(process.cwd(), '__tests__', 'mock-data'),
    path.join(process.cwd(), 'tests', 'mock-data'),
    path.join(__dirname, '../mock-data'),
    path.join(__dirname, '../../mock-data'),
  ].filter(Boolean) as string[];

  for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
      return testPath;
    }
  }

  // Default fallback
  return path.join(process.cwd(), 'mock-data');
}

export interface TestConfig {
  scenario?: string;
  autoSetup?: boolean;
  mockDataPath?: string;
  httpClientType?: 'fetch' | 'axios';
  additionalConfig?: Partial<MockifyerConfig>;
}

function setScenarioEnv(scenario: string | undefined): void {
  if (!scenario) return;
  if (typeof process !== 'undefined' && process.env) {
    process.env.MOCKIFYER_SCENARIO = scenario;
  }
}

/**
 * Sets up Mockifyer for testing with automatic configuration
 */
export function setupTestMocks(config: TestConfig = {}): any {
  if (!mockDataPath) {
    mockDataPath = config.mockDataPath || detectMockDataPath();
  }

  if (!mockifyerInstance) {
    setScenarioEnv(config.scenario || process.env.MOCKIFYER_SCENARIO);

    const mockifyerConfig: MockifyerConfig = {
      mockDataPath,
      recordMode: false,
      useGlobalFetch: config.httpClientType !== 'axios',
      useGlobalAxios: config.httpClientType === 'axios',
      ...config.additionalConfig
    };

    mockifyerInstance = setupMockifyer(mockifyerConfig);
  }

  if (config.scenario) {
    setScenarioEnv(config.scenario);
    mockifyerInstance.setScenario?.(config.scenario);
  }

  return mockifyerInstance;
}

/**
 * Auto-setup for Jest
 */
export function jestSetup(config: TestConfig = {}) {
  const g = globalThis as unknown as { beforeAll?: (fn: () => void) => void };
  g.beforeAll?.(() => setupTestMocks(config));
}

/**
 * Auto-setup for Vitest
 */
export function vitestSetup(config: TestConfig = {}) {
  const g = globalThis as unknown as { beforeAll?: (fn: () => void) => void };
  g.beforeAll?.(() => setupTestMocks(config));
}

/**
 * Auto-setup for Mocha
 */
export function mochaSetup(config: TestConfig = {}) {
  const g = globalThis as unknown as { before?: (fn: () => void) => void };
  g.before?.(() => setupTestMocks(config));
}

/**
 * Switch to a different scenario
 */
export function useScenario(scenario: string): void {
  if (!mockifyerInstance) {
    setupTestMocks({ scenario });
  } else {
    mockifyerInstance.setScenario?.(scenario);
  }
}

/**
 * Get realistic mock data for an endpoint
 */
export async function getRealisticMockData(endpoint: string, method: string = 'GET'): Promise<any> {
  // This would require loading mocks from files
  // For now, just return null - can be enhanced later
  return null;
}

/**
 * Reset the mockifyer instance (useful for test cleanup)
 */
export function resetMockifyer(): void {
  mockifyerInstance = undefined;
  mockDataPath = '';
}

