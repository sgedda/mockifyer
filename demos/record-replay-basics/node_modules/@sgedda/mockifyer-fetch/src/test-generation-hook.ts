/**
 * Test generation hook for Metro sync middleware
 * 
 * This is a separate module that can be used as a callback with the Metro sync middleware
 * to generate tests when mocks are saved. This keeps test generation separate from the
 * core sync functionality.
 */

import * as fs from 'fs';
import * as path from 'path';
import { TestGenerator, TestGenerationOptions, MockData } from '@sgedda/mockifyer-core';

export interface TestGenerationHookOptions {
  /** Project root directory */
  projectRoot: string;
  /** Test framework to use */
  framework?: 'jest' | 'vitest' | 'mocha';
  /** Output path for generated tests */
  outputPath?: string;
  /** Test file naming pattern */
  testPattern?: string;
  /** Include setup code in generated tests */
  includeSetup?: boolean;
  /** Group tests by: 'endpoint', 'scenario', or 'file' */
  groupBy?: 'endpoint' | 'scenario' | 'file';
  /** HTTP client type */
  httpClientType?: 'fetch' | 'axios';
  /** If true, only generate one test per endpoint */
  uniqueTestsPerEndpoint?: boolean;
}

/**
 * Creates a test generation hook function that can be used with Metro sync middleware
 */
export function createTestGenerationHook(options: TestGenerationHookOptions) {
  const {
    projectRoot,
    framework = 'jest',
    outputPath = './tests/generated',
    testPattern = '{endpoint}.test.ts',
    includeSetup = true,
    groupBy = 'endpoint',
    httpClientType = 'fetch',
    uniqueTestsPerEndpoint = false,
  } = options;

  return async (mockData: MockData, filePath: string) => {
    try {
      // Try to require TestGenerator from mockifyer-core
      let TestGeneratorClass: typeof TestGenerator;
      try {
        let mockifyerCore;
        try {
          mockifyerCore = require('@sgedda/mockifyer-core');
        } catch (e) {
          // Fallback: try relative path (for local file: dependencies)
          const corePath = path.join(projectRoot, '../../packages/mockifyer-core/dist/index.js');
          if (fs.existsSync(corePath)) {
            mockifyerCore = require(corePath);
          } else {
            throw new Error(`Could not find mockifyer-core at ${corePath}`);
          }
        }
        
        TestGeneratorClass = mockifyerCore?.TestGenerator;
        
        if (!TestGeneratorClass) {
          const testGeneratorPath = path.join(projectRoot, '../../packages/mockifyer-core/dist/utils/test-generator.js');
          if (fs.existsSync(testGeneratorPath)) {
            const testGeneratorModule = require(testGeneratorPath);
            TestGeneratorClass = testGeneratorModule.TestGenerator;
          }
        }
      } catch (e) {
        console.log(`[MockSync] ⚠️ Could not load TestGenerator: ${(e as Error).message}`);
        return;
      }

      if (!TestGeneratorClass) {
        console.log('[MockSync] ⚠️ TestGenerator not available');
        return;
      }

      const generator = new TestGeneratorClass();
      
      const testOptions: TestGenerationOptions = {
        framework,
        outputPath,
        testPattern,
        includeSetup,
        groupBy,
        httpClientType,
        uniqueTestsPerEndpoint,
      };

      const testInfo = generator.analyzeMock(mockData, httpClientType);
      const testFilePath = generator.determineTestFilePath(mockData, testOptions);
      
      const absoluteTestPath = path.resolve(projectRoot, testFilePath);
      const testDir = path.dirname(absoluteTestPath);

      // If uniqueTestsPerEndpoint is enabled, check if a test file already exists
      if (uniqueTestsPerEndpoint && fs.existsSync(absoluteTestPath)) {
        console.log(`[MockSync] ✅ Test file already exists for endpoint ${testInfo.method} ${testInfo.endpoint}, skipping generation`);
        return;
      }

      // Ensure test directory exists
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      const testCode = generator.generateTest(mockData, testOptions);

      // Check if test file already exists
      if (fs.existsSync(absoluteTestPath)) {
        const testName = `${testInfo.method} ${testInfo.endpoint}`;
        
        const existingContent = fs.readFileSync(absoluteTestPath, 'utf-8');
        if (existingContent.includes(`it('${testName}'`) || existingContent.includes(`it("${testName}"`)) {
          console.log(`[MockSync] ✅ Test already exists in ${absoluteTestPath}, skipping generation`);
          return;
        }
        
        // Append test to existing file
        const testMatch = testCode.match(/it\('.*?', async \(\) => \{[\s\S]*?\}\);?/);
        if (testMatch) {
          const newTest = testMatch[0];
          const updatedContent = existingContent.replace(
            /(\s+)(\}\);?\s*)$/,
            `$1${newTest}\n$1$2`
          );
          fs.writeFileSync(absoluteTestPath, updatedContent);
          console.log(`[MockSync] ✅ Appended test to existing file: ${absoluteTestPath}`);
        }
      } else {
        // Create new test file
        fs.writeFileSync(absoluteTestPath, testCode);
        console.log(`[MockSync] ✅ Generated test: ${absoluteTestPath}`);
      }
    } catch (error) {
      console.error(`[MockSync] ❌ Error generating test:`, error);
    }
  };
}

