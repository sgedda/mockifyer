import { setupMockifyer } from '@sgedda/mockifyer';
import path from 'path';

// Initialize mockifyer if enabled
export function initializeMockifyer() {
  if (process.env.MOCKIFYER_ENABLED === 'true') {
    // Ensure we have an absolute path for mock data
    const mockPath = process.env.MOCKIFYER_PATH || path.join(process.cwd(), '/persisted/mock-data');
    
    // Set the environment variable for other parts of the application
    process.env.MOCKIFYER_PATH = mockPath;

    console.log('[Mockifyer] Initializing with config:', {
      recordMode: process.env.MOCKIFYER_RECORD === 'true',
      mockPath,
      cwd: process.cwd()
    });
    
    // Initialize mockifyer with absolute paths
    const instance = setupMockifyer({
      mockDataPath: mockPath,
      recordMode: process.env.MOCKIFYER_RECORD === 'true',
      failOnMissingMock: false, // Set to false in record mode
      useGlobalAxios: true
    });

    // Log the axios instance to verify it's properly configured
    console.log('[Mockifyer] Axios instance configured:', {
      hasMockifyer: !!(instance as any).__mockifyer
    });

    return instance;
  }
} 