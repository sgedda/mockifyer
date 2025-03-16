import axios, { AxiosInstance } from 'axios';
import { setupMockifyer } from './index';
import { ENV_VARS } from './types';
import path from 'path';

let isInitialized = false;

function createMockifyerInstance(baseConfig = {}) {
  const mockPath = process.env[ENV_VARS.MOCK_PATH] || path.join(process.cwd(), 'mock-data');
  const isRecordMode = process.env[ENV_VARS.MOCK_RECORD] === 'true';
  const scenario = process.env[ENV_VARS.MOCK_SCENARIO];

  return setupMockifyer({
    recordMode: isRecordMode,
    mockDataPath: mockPath,
    autoMock: true,
    scenarios: scenario ? {
      default: scenario
    } : undefined,
    ...baseConfig
  });
}

export function initializeMockifyer() {
  if (isInitialized) {
    return;
  }

  const isMockEnabled = process.env[ENV_VARS.MOCK_ENABLED] === 'true';
  if (!isMockEnabled) {
    return;
  }

  // Replace the default axios instance
  const mockedInstance = createMockifyerInstance();
  Object.assign(axios, mockedInstance);

  // Store the original create method
  const originalCreate = axios.create.bind(axios);

  // Replace axios.create
  axios.create = function mockedCreate(config = {}): AxiosInstance {
    return createMockifyerInstance(config);
  };

  isInitialized = true;
}

// Auto-initialize if environment variables are set
if (process.env[ENV_VARS.MOCK_ENABLED] === 'true') {
  initializeMockifyer();
} 