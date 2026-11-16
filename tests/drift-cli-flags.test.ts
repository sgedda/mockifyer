/**
 * Tests for drift CLI flag combinations.
 * Verifies Bugbot finding fix: --json and --html should work together.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

describe('Drift CLI Flags', () => {
  const testDir = path.join(__dirname, '../.tmp-drift-cli-test');
  const mockDataDir = path.join(testDir, 'mock-data/test-scenario');
  const htmlOutputDir = path.join(testDir, 'html-output');
  const cliPath = path.join(__dirname, '../packages/mockifyer-core/dist/cli/drift-check.js');

  beforeAll(() => {
    // Create test mock data
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    fs.mkdirSync(mockDataDir, { recursive: true });

    // Create a simple mock
    const mockFile = {
      request: {
        method: 'GET',
        url: 'http://example.com/test',
        headers: {},
      },
      response: {
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: { test: true },
      },
      metadata: {
        recordedAt: '2026-11-16T00:00:00.000Z',
        scenario: 'test-scenario',
      },
    };

    fs.writeFileSync(
      path.join(mockDataDir, 'example.com', 'test', 'GET.json'),
      JSON.stringify(mockFile, null, 2)
    );

    // Create domain-path-rules.json
    fs.mkdirSync(path.join(mockDataDir, 'example.com', 'test'), { recursive: true });
    fs.writeFileSync(
      path.join(mockDataDir, 'domain-path-rules.json'),
      JSON.stringify({
        version: 1,
        rules: [
          {
            domain: 'example.com',
            pathPattern: '/test',
            pathTemplate: '/test',
          },
        ],
      })
    );
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it('should output JSON when --json flag is provided', () => {
    const output = execSync(
      `node ${cliPath} --mock-data-path ${mockDataDir} --scenario test-scenario --json --no-history`,
      { encoding: 'utf8' }
    );

    expect(output).toContain('"totalMocks"');
    expect(output).toContain('"driftedMocks"');
    
    const report = JSON.parse(output);
    expect(report).toHaveProperty('totalMocks');
    expect(report).toHaveProperty('driftedMocks');
  });

  it('should generate HTML when --html flag is provided', () => {
    execSync(
      `node ${cliPath} --mock-data-path ${mockDataDir} --scenario test-scenario --html ${htmlOutputDir} --no-history`,
      { encoding: 'utf8' }
    );

    const htmlPath = path.join(htmlOutputDir, 'index.html');
    expect(fs.existsSync(htmlPath)).toBe(true);

    const html = fs.readFileSync(htmlPath, 'utf8');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Drift Check:');
  });

  it('should support both --json and --html flags together (Bugbot fix)', () => {
    const jsonOutputPath = path.join(testDir, 'combined-output.json');
    const htmlOutputDir2 = path.join(testDir, 'html-output-combined');

    // Run with both flags
    const output = execSync(
      `node ${cliPath} --mock-data-path ${mockDataDir} --scenario test-scenario --json --html ${htmlOutputDir2} --no-history > ${jsonOutputPath}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );

    // Verify JSON was written
    expect(fs.existsSync(jsonOutputPath)).toBe(true);
    const jsonContent = fs.readFileSync(jsonOutputPath, 'utf8');
    const report = JSON.parse(jsonContent);
    expect(report).toHaveProperty('totalMocks');

    // Verify HTML was created
    const htmlPath = path.join(htmlOutputDir2, 'index.html');
    expect(fs.existsSync(htmlPath)).toBe(true);
    const html = fs.readFileSync(htmlPath, 'utf8');
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('should output human-friendly report when no flags are provided', () => {
    const output = execSync(
      `node ${cliPath} --mock-data-path ${mockDataDir} --scenario test-scenario --no-history`,
      { encoding: 'utf8' }
    );

    // Human-friendly output contains emoji and formatted text
    expect(output).toMatch(/✓|✗/);
    expect(output).toContain('mock');
  });
});
