import { MockData, StoredRequest } from '../types';
import { CachedMockData, generateRequestKey } from '../utils/mock-matcher';
import { DatabaseProvider, DatabaseProviderConfig } from './types';

/**
 * SQLite-based provider for storing mock data
 * Uses better-sqlite3 for synchronous operations (better performance)
 */
export class SQLiteProvider implements DatabaseProvider {
  private dbPath: string;
  private db: any; // better-sqlite3 Database instance

  constructor(config: DatabaseProviderConfig) {
    if (!config.path) {
      throw new Error('SQLiteProvider requires a path in config');
    }
    this.dbPath = config.path;
  }

  initialize(): void {
    // Use require for synchronous initialization (better-sqlite3 is synchronous)
    // This will throw if better-sqlite3 is not installed
    let Database: any;
    try {
      Database = require('better-sqlite3');
    } catch (e) {
      throw new Error(
        'better-sqlite3 is required for SQLiteProvider. Install it with: npm install better-sqlite3'
      );
    }
    
    // Open database connection
    this.db = new Database(this.dbPath);
    
    // Enable JSON1 extension for JSON operations
    this.db.pragma('journal_mode = WAL');
    
    // Create tables if they don't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mock_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_key TEXT UNIQUE NOT NULL,
        request_method TEXT NOT NULL,
        request_url TEXT NOT NULL,
        request_path TEXT,
        request_data TEXT,
        request_query_params TEXT,
        request_headers TEXT,
        response_status INTEGER NOT NULL,
        response_data TEXT NOT NULL,
        response_headers TEXT,
        timestamp TEXT NOT NULL,
        scenario TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_request_key ON mock_data(request_key);
      CREATE INDEX IF NOT EXISTS idx_request_path_method ON mock_data(request_path, request_method);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON mock_data(timestamp);
    `);
    
    console.log(`[Mockifyer] SQLite database initialized at: ${this.dbPath}`);
  }

  save(mockData: MockData): void {
    if (!this.db) {
      throw new Error('SQLiteProvider not initialized. Call initialize() first.');
    }

    // Extract path from URL for indexing
    let requestPath: string | null = null;
    try {
      const url = new URL(mockData.request.url);
      requestPath = url.pathname;
    } catch (e) {
      // Invalid URL, leave path as null
    }

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO mock_data (
        request_key,
        request_method,
        request_url,
        request_path,
        request_data,
        request_query_params,
        request_headers,
        response_status,
        response_data,
        response_headers,
        timestamp,
        scenario
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Generate request key using shared utility
    const requestKey = generateRequestKey(mockData.request);

    stmt.run(
      requestKey,
      mockData.request.method,
      mockData.request.url,
      requestPath,
      JSON.stringify(mockData.request.data || null),
      JSON.stringify(mockData.request.queryParams || {}),
      JSON.stringify(mockData.request.headers || {}),
      mockData.response.status,
      JSON.stringify(mockData.response.data),
      JSON.stringify(mockData.response.headers || {}),
      mockData.timestamp,
      mockData.scenario || null
    );

    console.log(`[Mockifyer] Saved mock to SQLite database: ${requestKey.substring(0, 100)}...`);
  }

  findExactMatch(request: StoredRequest, requestKey: string): CachedMockData | undefined {
    if (!this.db) {
      return undefined;
    }

    const stmt = this.db.prepare('SELECT * FROM mock_data WHERE request_key = ?');
    const row = stmt.get(requestKey) as any;

    if (!row) {
      return undefined;
    }

    // Reconstruct MockData from database row
    const mockData: MockData = {
      request: {
        method: row.request_method,
        url: row.request_url,
        headers: JSON.parse(row.request_headers || '{}'),
        data: row.request_data ? JSON.parse(row.request_data) : undefined,
        queryParams: JSON.parse(row.request_query_params || '{}')
      },
      response: {
        status: row.response_status,
        data: JSON.parse(row.response_data),
        headers: JSON.parse(row.response_headers || '{}')
      },
      timestamp: row.timestamp,
      scenario: row.scenario || undefined
    };

    return {
      mockData,
      filename: `sqlite_${row.id}.json`, // Virtual filename for compatibility
      filePath: this.dbPath // Use db path as filePath
    };
  }

  findAllForSimilarMatch(request: StoredRequest): CachedMockData[] {
    if (!this.db) {
      return [];
    }

    // Extract path from URL
    let requestPath: string | null = null;
    try {
      const url = new URL(request.url);
      requestPath = url.pathname;
    } catch (e) {
      return [];
    }

    const method = (request.method || 'GET').toUpperCase();

    const stmt = this.db.prepare(`
      SELECT * FROM mock_data 
      WHERE request_path = ? AND request_method = ?
      ORDER BY timestamp DESC
    `);
    
    const rows = stmt.all(requestPath, method) as any[];

    return rows.map(row => {
      const mockData: MockData = {
        request: {
          method: row.request_method,
          url: row.request_url,
          headers: JSON.parse(row.request_headers || '{}'),
          data: row.request_data ? JSON.parse(row.request_data) : undefined,
          queryParams: JSON.parse(row.request_query_params || '{}')
        },
        response: {
          status: row.response_status,
          data: JSON.parse(row.response_data),
          headers: JSON.parse(row.response_headers || '{}')
        },
        timestamp: row.timestamp,
        scenario: row.scenario || undefined
      };

      return {
        mockData,
        filename: `sqlite_${row.id}.json`,
        filePath: this.dbPath
      };
    });
  }

  exists(requestKey: string): boolean {
    if (!this.db) {
      return false;
    }

    const stmt = this.db.prepare('SELECT 1 FROM mock_data WHERE request_key = ? LIMIT 1');
    const row = stmt.get(requestKey);
    return !!row;
  }

  getAll(): MockData[] {
    if (!this.db) {
      return [];
    }

    const stmt = this.db.prepare('SELECT * FROM mock_data ORDER BY timestamp DESC');
    const rows = stmt.all() as any[];

    return rows.map(row => ({
      request: {
        method: row.request_method,
        url: row.request_url,
        headers: JSON.parse(row.request_headers || '{}'),
        data: row.request_data ? JSON.parse(row.request_data) : undefined,
        queryParams: JSON.parse(row.request_query_params || '{}')
      },
      response: {
        status: row.response_status,
        data: JSON.parse(row.response_data),
        headers: JSON.parse(row.response_headers || '{}')
      },
      timestamp: row.timestamp,
      scenario: row.scenario || undefined
    }));
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

