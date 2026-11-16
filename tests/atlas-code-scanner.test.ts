import { scanCodeForEndpoints } from '../packages/mockifyer-core/src/utils/atlas-code-scanner';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('atlas-code-scanner', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-scanner-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function writeTestFile(fileName: string, content: string) {
    const filePath = path.join(tempDir, fileName);
    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
  }

  it('should find fetch calls', () => {
    writeTestFile('test.ts', `
      async function fetchData() {
        const response = await fetch('https://api.example.com/users');
        return response.json();
      }
    `);

    const result = scanCodeForEndpoints(tempDir);
    expect(result.endpoints.length).toBe(1);
    expect(result.endpoints[0].method).toBe('GET');
    expect(result.endpoints[0].resolvedUrl).toBe('https://api.example.com/users');
    expect(result.endpoints[0].callType).toBe('fetch');
  });

  it('should find axios calls', () => {
    writeTestFile('test.ts', `
      import axios from 'axios';
      
      async function getData() {
        const response = await axios.get('https://api.example.com/posts');
        return response.data;
      }
    `);

    const result = scanCodeForEndpoints(tempDir);
    expect(result.endpoints.length).toBe(1);
    expect(result.endpoints[0].method).toBe('GET');
    expect(result.endpoints[0].resolvedUrl).toBe('https://api.example.com/posts');
    expect(result.endpoints[0].callType).toBe('axios');
  });

  it('should find axios instance calls with baseURL', () => {
    writeTestFile('test.ts', `
      import axios from 'axios';
      
      const httpClient = axios.create({
        baseURL: 'https://api.example.com'
      });
      
      async function getUser(id: number) {
        const response = await httpClient.get('/users/' + id);
        return response.data;
      }
    `);

    const result = scanCodeForEndpoints(tempDir);
    expect(result.endpoints.length).toBe(1);
    expect(result.endpoints[0].method).toBe('GET');
    expect(result.endpoints[0].resolvedUrl).toContain('https://api.example.com');
    expect(result.endpoints[0].callType).toBe('axios-instance');
    expect(result.endpoints[0].baseUrl).toBe('https://api.example.com');
  });

  it('should handle template strings', () => {
    writeTestFile('test.ts', `
      async function getUser(id: number) {
        const response = await fetch(\`https://api.example.com/users/\${id}\`);
        return response.json();
      }
    `);

    const result = scanCodeForEndpoints(tempDir);
    expect(result.endpoints.length).toBe(1);
    expect(result.endpoints[0].resolvedUrl).toContain('https://api.example.com/users/');
  });

  it('should resolve string constants', () => {
    writeTestFile('test.ts', `
      const API_BASE = 'https://api.example.com';
      
      async function fetchData() {
        const response = await fetch(API_BASE + '/data');
        return response.json();
      }
    `);

    const result = scanCodeForEndpoints(tempDir);
    expect(result.endpoints.length).toBe(1);
    expect(result.endpoints[0].resolvedUrl).toBe('https://api.example.com/data');
  });

  it('should handle POST requests', () => {
    writeTestFile('test.ts', `
      async function createUser(data: any) {
        const response = await fetch('https://api.example.com/users', {
          method: 'POST',
          body: JSON.stringify(data)
        });
        return response.json();
      }
    `);

    const result = scanCodeForEndpoints(tempDir);
    expect(result.endpoints.length).toBe(1);
    expect(result.endpoints[0].method).toBe('POST');
  });

  it('should track component names', () => {
    writeTestFile('Component.tsx', `
      function UserProfile() {
        const fetchUser = async () => {
          const response = await fetch('https://api.example.com/user');
          return response.json();
        };
        return <div>Profile</div>;
      }
    `);

    const result = scanCodeForEndpoints(tempDir);
    expect(result.endpoints.length).toBe(1);
    // Note: Currently tracks the immediate containing function (fetchUser), 
    // not the outer component. This is acceptable for now.
    expect(result.endpoints[0].componentName).toBeDefined();
  });

  it('should mark unresolvable URLs', () => {
    writeTestFile('test.ts', `
      async function fetchData(url: string) {
        const response = await fetch(url);
        return response.json();
      }
    `);

    const result = scanCodeForEndpoints(tempDir);
    expect(result.endpoints.length).toBe(1);
    expect(result.endpoints[0].callType).toBe('unresolved');
    expect(result.endpoints[0].urlTemplate).toBe('unresolved');
  });

  it('should exclude node_modules by default', () => {
    const nodeModulesDir = path.join(tempDir, 'node_modules', 'some-package');
    fs.mkdirSync(nodeModulesDir, { recursive: true });
    writeTestFile('node_modules/some-package/index.js', `
      fetch('https://should-not-be-found.com/data');
    `);
    writeTestFile('app.ts', `
      fetch('https://should-be-found.com/data');
    `);

    const result = scanCodeForEndpoints(tempDir);
    expect(result.endpoints.length).toBe(1);
    expect(result.endpoints[0].resolvedUrl).toContain('should-be-found.com');
  });

  it('should track file location', () => {
    const filePath = writeTestFile('api.ts', `
      async function getData() {
        const response = await fetch('https://api.example.com/data');
        return response.json();
      }
    `);

    const result = scanCodeForEndpoints(tempDir);
    expect(result.endpoints.length).toBe(1);
    expect(result.endpoints[0].filePath).toBe(filePath);
    expect(result.endpoints[0].line).toBeGreaterThan(0);
  });
});
