/**
 * Development-only HTTP server to sync mock files from device to project folder
 * 
 * This server runs in the React Native app (development mode only) and serves
 * mock files stored via expo-filesystem so they can be synced to the project folder.
 * 
 * Usage: This is automatically started when the app initializes in __DEV__ mode
 */

import * as FileSystem from 'expo-file-system';

const MOCK_SYNC_PORT = 8080;
const MOCK_DATA_PATH = 'mock-data';

let serverStarted = false;

/**
 * Start the mock sync server (development only)
 */
export async function startMockSyncServer(): Promise<void> {
  if (!__DEV__ || serverStarted) {
    return;
  }

  try {
    // Check if we can access expo-file-system
    if (!FileSystem.documentDirectory) {
      console.warn('[MockSync] Cannot start sync server: documentDirectory not available');
      return;
    }

    // For React Native, we'll use a simple approach:
    // Create an endpoint that can be called via fetch from Node.js
    // Since we can't run Express in React Native easily, we'll use a different approach
    
    console.log('[MockSync] Mock sync server would start on port', MOCK_SYNC_PORT);
    console.log('[MockSync] Use the sync script: npm run sync:mocks');
    
    // Note: In React Native, we can't easily run an HTTP server
    // Instead, we'll create a helper function that can be called via React Native Debugger
    // or we'll use the sync script that reads directly from simulator paths
    
    serverStarted = true;
  } catch (error) {
    console.error('[MockSync] Error starting sync server:', error);
  }
}

/**
 * Get all mock files as JSON (for sync)
 */
export async function getAllMockFiles(): Promise<Array<{ filename: string; content: any }>> {
  try {
    const mockDir = FileSystem.documentDirectory + MOCK_DATA_PATH;
    
    // Check if directory exists
    const dirInfo = await FileSystem.getInfoAsync(mockDir);
    if (!dirInfo.exists) {
      return [];
    }

    // List all files
    const files = await FileSystem.readDirectoryAsync(mockDir);
    const mocks: Array<{ filename: string; content: any }> = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const fileUri = mockDir + '/' + file;
          const content = await FileSystem.readAsStringAsync(fileUri);
          mocks.push({
            filename: file,
            content: JSON.parse(content),
          });
        } catch (error) {
          console.warn(`[MockSync] Failed to read ${file}:`, error);
        }
      }
    }

    return mocks;
  } catch (error) {
    console.error('[MockSync] Error getting mock files:', error);
    return [];
  }
}

// Auto-start in development
if (__DEV__) {
  startMockSyncServer();
}




