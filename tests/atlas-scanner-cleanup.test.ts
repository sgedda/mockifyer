/**
 * Test Atlas code scanner URL resolution and cleanup.
 * Covers WanderWeird patterns: env fallbacks, zero-arg functions, {param} collapse.
 */

import { scanCodeForEndpoints } from '../packages/mockifyer-core/src/utils/atlas-code-scanner';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Atlas code scanner URL cleanup', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scanner-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function writeTestFile(filename: string, content: string): string {
    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
  }

  test('resolves process.env with ?? fallback', () => {
    const code = `
      const BASE_URL = process.env.API_URL ?? 'http://localhost:4200';
      fetch(BASE_URL + '/graphql');
    `;
    writeTestFile('test.ts', code);
    
    const result = scanCodeForEndpoints(tempDir);
    expect(result.endpoints.length).toBe(1);
    expect(result.endpoints[0].urlTemplate).toBe('http://localhost:4200/graphql');
  });

  test('resolves process.env with || fallback', () => {
    const code = `
      const BASE_URL = process.env.API_URL || 'http://localhost:4200';
      fetch(BASE_URL + '/discover');
    `;
    writeTestFile('test.ts', code);
    
    const result = scanCodeForEndpoints(tempDir);
    expect(result.endpoints.length).toBe(1);
    expect(result.endpoints[0].urlTemplate).toBe('http://localhost:4200/discover');
  });

  test('resolves zero-arg function that returns literal', () => {
    const code = `
      function defaultGatewayOrigin() {
        return 'http://127.0.0.1:4200';
      }
      
      const GATEWAY_BASE = defaultGatewayOrigin();
      fetch(GATEWAY_BASE + '/graphql');
    `;
    writeTestFile('test.ts', code);
    
    const result = scanCodeForEndpoints(tempDir);
    expect(result.endpoints.length).toBe(1);
    expect(result.endpoints[0].urlTemplate).toBe('http://127.0.0.1:4200/graphql');
  });

  test('resolves zero-arg function with conditional', () => {
    const code = `
      function defaultUrl() {
        if (process.env.NODE_ENV === 'production') {
          return 'https://api.example.com';
        }
        return 'http://localhost:4200';
      }
      
      const BASE = defaultUrl();
      fetch(BASE + '/api/data');
    `;
    writeTestFile('test.ts', code);
    
    const result = scanCodeForEndpoints(tempDir);
    expect(result.endpoints.length).toBe(1);
    // Should resolve to one of the return values
    expect(['https://api.example.com/api/data', 'http://localhost:4200/api/data'])
      .toContain(result.endpoints[0].urlTemplate);
  });

  test('collapses consecutive {param} placeholders', () => {
    const code = `
      const userId = 123;
      const tripId = 456;
      fetch('http://localhost:4200/' + userId + tripId);
    `;
    writeTestFile('test.ts', code);
    
    const result = scanCodeForEndpoints(tempDir);
    expect(result.endpoints.length).toBe(1);
    // Should collapse {param}{param} to single {param}
    expect(result.endpoints[0].urlTemplate).toBe('http://localhost:4200/{param}');
  });

  test('handles unresolvable variables in URL path', () => {
    const code = `
      const BASE_URL = 'http://localhost:4200';
      const userId = externalFunc();  // Can't resolve
      fetch(BASE_URL + '/users/' + userId);
    `;
    writeTestFile('test.ts', code);
    
    const result = scanCodeForEndpoints(tempDir);
    expect(result.endpoints.length).toBe(1);
    // Should resolve BASE_URL and use {param} for unresolvable userId
    expect(result.endpoints[0].urlTemplate).toBe('http://localhost:4200/users/{param}');
  });

  test('marks unresolved URLs correctly', () => {
    const code = `
      const dynamicUrl = computeUrl();  // Function not in this file
      fetch(dynamicUrl);
    `;
    writeTestFile('test.ts', code);
    
    const result = scanCodeForEndpoints(tempDir);
    expect(result.endpoints.length).toBe(1);
    expect(result.endpoints[0].urlTemplate).toBe('unresolved');
    expect(result.endpoints[0].callType).toBe('unresolved');
  });

  test('handles template literals with process.env fallback', () => {
    const code = `
      const BASE = process.env.GRAPHQL_URL ?? 'http://127.0.0.1:4206';
      fetch(\`\${BASE}/graphql\`);
    `;
    writeTestFile('test.ts', code);
    
    const result = scanCodeForEndpoints(tempDir);
    expect(result.endpoints.length).toBe(1);
    expect(result.endpoints[0].urlTemplate).toBe('http://127.0.0.1:4206/graphql');
  });

  test('handles axios with nullish coalescing', () => {
    const code = `
      import axios from 'axios';
      const API_BASE = process.env.API_URL ?? 'http://localhost:4200';
      axios.get(API_BASE + '/trips');
    `;
    writeTestFile('test.ts', code);
    
    const result = scanCodeForEndpoints(tempDir);
    expect(result.endpoints.length).toBe(1);
    expect(result.endpoints[0].urlTemplate).toBe('http://localhost:4200/trips');
    expect(result.endpoints[0].callType).toBe('axios');
  });

  test('preserves single {param} placeholders', () => {
    const code = `
      const tripId = 123;
      fetch('http://localhost:4200/trips/' + tripId);
    `;
    writeTestFile('test.ts', code);
    
    const result = scanCodeForEndpoints(tempDir);
    expect(result.endpoints.length).toBe(1);
    expect(result.endpoints[0].urlTemplate).toBe('http://localhost:4200/trips/{param}');
  });

  test('handles multiple unresolved URLs in one file', () => {
    const code = `
      function makeCall1() {
        const url1 = getUrl1();
        fetch(url1);
      }
      
      function makeCall2() {
        const url2 = getUrl2();
        fetch(url2);
      }
    `;
    writeTestFile('test.ts', code);
    
    const result = scanCodeForEndpoints(tempDir);
    expect(result.endpoints.length).toBe(2);
    expect(result.endpoints.every(e => e.urlTemplate === 'unresolved')).toBe(true);
  });
});
