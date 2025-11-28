import { setupMockifyer } from '@sgedda/mockifyer';
import path from 'path';
import fs from 'fs';

// Initialize mockifyer if enabled
export function initializeMockifyer() {
  if (process.env.MOCKIFYER_ENABLED === 'true') {
    // Determine mock data path:
    // 1. Use MOCKIFYER_PATH if explicitly set (Railway volume path)
    // 2. Check for Railway volume at /data/mock-data (common Railway volume mount)
    // 3. Fall back to persisted/mock-data in project directory
    let mockPath: string;
    
    if (process.env.MOCKIFYER_PATH) {
      // Use explicitly set path (Railway volume path from env var)
      mockPath = path.isAbsolute(process.env.MOCKIFYER_PATH) 
        ? process.env.MOCKIFYER_PATH 
        : path.join(process.cwd(), process.env.MOCKIFYER_PATH);
    } else if (process.env.RAILWAY_ENVIRONMENT || fs.existsSync('/persisted/mock-data')) {
      // On Railway, check for volume at /persisted/mock-data
      const railwayVolumePath = '/persisted/mock-data';
      mockPath = railwayVolumePath;
      console.log('[Mockifyer] Detected Railway environment, using volume path:', railwayVolumePath);
      
      // Verify volume is accessible and show file count
      if (fs.existsSync(railwayVolumePath)) {
        try {
          const stats = fs.statSync(railwayVolumePath);
          if (stats.isDirectory()) {
            const files = fs.readdirSync(railwayVolumePath);
            console.log('[Mockifyer] ✅ Railway volume is accessible:', {
              path: railwayVolumePath,
              fileCount: files.length,
              isDirectory: true
            });
          } else {
            console.warn('[Mockifyer] ⚠️  Volume path exists but is not a directory:', railwayVolumePath);
          }
        } catch (e) {
          console.error('[Mockifyer] ❌ Error accessing Railway volume:', e);
        }
      } else {
        console.warn('[Mockifyer] ⚠️  Railway volume path does not exist:', railwayVolumePath);
        console.warn('[Mockifyer] ⚠️  Make sure the volume is mounted at /persisted/mock-data in Railway');
      }
    } else {
      // Local development fallback
      mockPath = path.join(process.cwd(), 'persisted', 'mock-data');
    }
    
    // Ensure directory exists
    if (!fs.existsSync(mockPath)) {
      fs.mkdirSync(mockPath, { recursive: true });
      console.log('[Mockifyer] Created mock data directory:', mockPath);
    } else {
      // Log existing directory info
      try {
        const files = fs.readdirSync(mockPath);
        console.log('[Mockifyer] Using existing mock data directory:', {
          path: mockPath,
          fileCount: files.length,
          files: files.slice(0, 5) // Show first 5 files
        });
      } catch (e) {
        console.warn('[Mockifyer] Could not read directory:', mockPath, e);
      }
    }
    
    // Set the environment variable for other parts of the application
    process.env.MOCKIFYER_PATH = mockPath;

    console.log('[Mockifyer] Initializing with config:', {
      recordMode: process.env.MOCKIFYER_RECORD === 'true',
      mockPath,
      cwd: process.cwd(),
      pathExists: fs.existsSync(mockPath),
      isDirectory: fs.existsSync(mockPath) ? fs.statSync(mockPath).isDirectory() : false,
      railwayEnv: !!process.env.RAILWAY_ENVIRONMENT
    });
    
    // Initialize mockifyer with absolute paths
    const instance = setupMockifyer({
      mockDataPath: mockPath,
      recordMode: process.env.MOCKIFYER_RECORD === 'true',
      failOnMissingMock: false, // Set to false in record mode
      useGlobalAxios: true
    });

    // Initialize Mockifyer for fetch
    const fetchInstance = setupMockifyer({
      mockDataPath: mockPath,
      recordMode: process.env.MOCKIFYER_RECORD === 'true',
      failOnMissingMock: false, // Set to false in record mode
      httpClientType: 'fetch',
      useGlobalFetch: true  // Patches global fetch
    });

    // Log the axios instance to verify it's properly configured
    console.log('[Mockifyer] Axios instance configured:', {
      hasMockifyer: !!(instance as any).__mockifyer
    });

    return {instance, fetchInstance};
  }
} 