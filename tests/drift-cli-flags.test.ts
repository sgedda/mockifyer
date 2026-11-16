/**
 * Tests for drift CLI flag combinations.
 * Verifies Bugbot finding 4583834209: --json and --html should work together.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

describe('Drift CLI Flags (Bugbot fix 4583834209)', () => {
  it('should support both --json and --html flags together with pure JSON output', () => {
    const testDir = path.join(__dirname, '../.tmp-drift-combined-test');
    const htmlOutputDir = path.join(testDir, 'html-output');
    
    // Use the drift-showcase mock data that we know exists
    const mockDataPath = path.join(__dirname, '../demos/drift-showcase/mock-data');
    const cliPath = path.join(__dirname, '../packages/mockifyer-core/dist/cli/drift-check.js');

    // Clean up any previous runs
    if (fs.existsSync(htmlOutputDir)) {
      fs.rmSync(htmlOutputDir, { recursive: true });
    }

    // Run with both flags and capture stdout
    // Note: drift check may exit with code 1 if drift is detected, which is expected
    let output: string;
    try {
      output = execSync(
        `node ${cliPath} --mock-data-path ${mockDataPath} --scenario drift-watch --json --html ${htmlOutputDir} --no-history`,
        { encoding: 'utf8' }
      );
    } catch (error: any) {
      // Exit code 1 is expected when drift is detected
      if (error.status === 1 && error.stdout) {
        output = error.stdout;
      } else {
        throw error;
      }
    }

    // CRITICAL: Verify JSON is PURE (no human-friendly text contamination)
    // This was the bug: when both flags were given, human-friendly output
    // would contaminate the JSON, making it unparseable
    let report: any;
    expect(() => {
      report = JSON.parse(output);
    }).not.toThrow();
    
    expect(report).toHaveProperty('totalMocks');
    expect(report).toHaveProperty('driftedMocks');

    // Verify JSON does not contain human-friendly console messages
    // (The emoji in the 'summary' field is expected - that's data)
    expect(output).not.toContain('HTML report generated');
    expect(output).not.toContain('Drift Check Report');
    expect(output).not.toContain('BREAKING DRIFT');

    // Verify HTML was ALSO created (both outputs should work)
    const htmlPath = path.join(htmlOutputDir, 'index.html');
    expect(fs.existsSync(htmlPath)).toBe(true);
    const html = fs.readFileSync(htmlPath, 'utf8');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Drift Check');

    // Clean up
    fs.rmSync(testDir, { recursive: true, force: true });
  });
});
