import { describe, it, expect } from '@jest/globals';
import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('Atlas Code Scanner - .replace() handling', () => {
  function scanTestCode(code: string): any[] {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scanner-test-'));
    const testFile = path.join(tempDir, 'test.ts');
    fs.writeFileSync(testFile, code, 'utf8');

    try {
      const { scanCodeForEndpoints } = require('../packages/mockifyer-core/dist/utils/atlas-code-scanner.js');
      const result = scanCodeForEndpoints(tempDir);
      return result.endpoints;
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  it('should resolve URL with .replace(/\\/$/, "") trailing slash removal', () => {
    const code = `
      const GATEWAY_URL = (process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'http://localhost:4200').replace(/\\/\$/, '');
      fetch(GATEWAY_URL + '/graphql');
    `;
    const endpoints = scanTestCode(code);
    
    expect(endpoints.length).toBeGreaterThan(0);
    const endpoint = endpoints[0];
    expect(endpoint.resolvedUrl).toBe('http://localhost:4200/graphql');
  });

  it('should resolve URL with .replace(/\\/+$/, "") multiple trailing slash removal', () => {
    const code = `
      const BASE = 'https://api.example.com/'.replace(/\\/+\$/, '');
      fetch(BASE + '/users');
    `;
    const endpoints = scanTestCode(code);
    
    expect(endpoints.length).toBeGreaterThan(0);
    const endpoint = endpoints[0];
    expect(endpoint.resolvedUrl).toBe('https://api.example.com/users');
  });

  it('should resolve nested expression with replace', () => {
    const code = `
      const API_BASE = (process.env.API_URL || 'http://localhost:3000').replace(/\\/\$/, '');
      const endpoint = API_BASE + '/api/data';
      fetch(endpoint);
    `;
    const endpoints = scanTestCode(code);
    
    expect(endpoints.length).toBeGreaterThan(0);
    const endpoint = endpoints[0];
    expect(endpoint.resolvedUrl).toBe('http://localhost:3000/api/data');
  });

  it('should not resolve non-trailing-slash replace patterns', () => {
    const code = `
      const URL = 'http://localhost:4200'.replace(/localhost/, 'example.com');
      fetch(URL + '/graphql');
    `;
    const endpoints = scanTestCode(code);
    
    // Should not resolve because it's not a simple trailing slash strip
    expect(endpoints.length).toBeGreaterThan(0);
    const endpoint = endpoints[0];
    // resolvedUrl should be unresolved or partial
    expect(endpoint.resolvedUrl).not.toBe('http://example.com:4200/graphql');
  });
});
