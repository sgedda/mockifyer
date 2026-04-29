import fs from 'fs';
import path from 'path';

/**
 * Detect the mock data path using multiple strategies:
 * 1. CLI argument (highest priority)
 * 2. Environment variable (MOCKIFYER_PATH)
 * 3. Auto-detect by walking up directory tree
 * 4. Check common example project locations
 * 5. Default fallback
 */
export function detectMockDataPath(cliPath?: string): string {
  // 1. CLI argument takes precedence
  if (cliPath) {
    return path.isAbsolute(cliPath) 
      ? cliPath 
      : path.join(process.cwd(), cliPath);
  }
  
  // 2. Environment variable
  if (process.env.MOCKIFYER_PATH) {
    return path.isAbsolute(process.env.MOCKIFYER_PATH)
      ? process.env.MOCKIFYER_PATH
      : path.join(process.cwd(), process.env.MOCKIFYER_PATH);
  }
  
  // 3. Auto-detect: walk up directory tree
  let currentDir = process.cwd();
  const rootPath = path.parse(currentDir).root;
  
  while (currentDir !== rootPath) {
    const mockDataPath = path.join(currentDir, 'mock-data');
    const persistedPath = path.join(currentDir, 'persisted', 'mock-data');
    const sqlitePath = path.join(currentDir, 'mock-data.db');
    
    // Check paths and verify they have files (not just empty directories)
    if (fs.existsSync(persistedPath)) {
      try {
        const files = fs.readdirSync(persistedPath).filter(f => f.endsWith('.json'));
        if (files.length > 0) return persistedPath;
      } catch (e) {
        // Continue checking other paths
      }
    }
    
    if (fs.existsSync(mockDataPath)) {
      try {
        const files = fs.readdirSync(mockDataPath).filter(f => f.endsWith('.json'));
        if (files.length > 0) return mockDataPath;
      } catch (e) {
        // Continue checking other paths
      }
    }
    
    if (fs.existsSync(sqlitePath)) {
      return sqlitePath;
    }
    
    currentDir = path.dirname(currentDir);
  }
  
  // 4. Check mockifyer-web directory in root (from monorepo root)
  const repoRoot = findRepoRoot();
  if (repoRoot) {
    // Check mockifyer-web directory first
    const mockifyerWebDir = path.join(repoRoot, 'mockifyer-web');
    if (fs.existsSync(mockifyerWebDir)) {
      // Check persisted/mock-data first (preferred location)
      const webPersistedPath = path.join(mockifyerWebDir, 'persisted', 'mock-data');
      if (fs.existsSync(webPersistedPath)) {
        try {
          const files = fs.readdirSync(webPersistedPath);
          if (files.length > 0) {
            return webPersistedPath;
          }
        } catch (e) {
          // Continue to next check
        }
      }
      
      // Check mock-data directory
      const webMockDataPath = path.join(mockifyerWebDir, 'mock-data');
      if (fs.existsSync(webMockDataPath)) {
        try {
          const files = fs.readdirSync(webMockDataPath);
          if (files.length > 0) {
            return webMockDataPath;
          }
        } catch (e) {
          // Continue to next check
        }
      }
    }
    
    // Check example-projects directories
    const exampleProjectsDir = path.join(repoRoot, 'example-projects');
    if (fs.existsSync(exampleProjectsDir)) {
      try {
        const exampleDirs = fs.readdirSync(exampleProjectsDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name);
        
        for (const exampleDir of exampleDirs) {
          // Check persisted/mock-data first (preferred location)
          const examplePersistedPath = path.join(exampleProjectsDir, exampleDir, 'persisted', 'mock-data');
          if (fs.existsSync(examplePersistedPath)) {
            // Verify it has files (not just empty directory)
            try {
              const files = fs.readdirSync(examplePersistedPath);
              if (files.length > 0) {
                return examplePersistedPath;
              }
            } catch (e) {
              // Continue to next check
            }
          }
          
          // Check mock-data directory
          const exampleMockDataPath = path.join(exampleProjectsDir, exampleDir, 'mock-data');
          if (fs.existsSync(exampleMockDataPath)) {
            // Verify it has files (not just empty directory)
            try {
              const files = fs.readdirSync(exampleMockDataPath);
              if (files.length > 0) {
                return exampleMockDataPath;
              }
            } catch (e) {
              // Continue to next check
            }
          }
        }
      } catch (error) {
        // Ignore errors reading example-projects directory
      }
    }
  }
  
  // 5. Default fallback
  return path.join(process.cwd(), 'mock-data');
}

/**
 * Find the repository root by looking for common markers (.git, package.json, etc.)
 */
function findRepoRoot(): string | null {
  let currentDir = process.cwd();
  const rootPath = path.parse(currentDir).root;
  
  while (currentDir !== rootPath) {
    // Check for common repo markers
    const gitDir = path.join(currentDir, '.git');
    const packageJson = path.join(currentDir, 'package.json');
    const hasPackagesDir = fs.existsSync(path.join(currentDir, 'packages'));
    
    if (fs.existsSync(gitDir) || (fs.existsSync(packageJson) && hasPackagesDir)) {
      return currentDir;
    }
    
    currentDir = path.dirname(currentDir);
  }
  
  return null;
}

/**
 * Detect provider type based on path
 */
export function detectProvider(dataPath: string): 'filesystem' | 'sqlite' | 'redis' {
  if (dataPath.endsWith('.db')) {
    return 'sqlite';
  }
  
  // Check environment variable
  if (process.env.MOCKIFYER_DB_PROVIDER === 'sqlite') {
    return 'sqlite';
  }

  if (process.env.MOCKIFYER_DB_PROVIDER === 'redis') {
    return 'redis';
  }
  
  return 'filesystem';
}

