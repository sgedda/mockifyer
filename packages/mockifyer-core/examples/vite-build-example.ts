/**
 * Vite Build Plugin Example: Generate static data during build
 * 
 * Use this as a Vite plugin to generate static data files during build
 */

import { Plugin } from 'vite';
import { generateStaticDataFile } from '@sgedda/mockifyer-core/utils/build-utils';
import path from 'path';

export function mockifyerBuildPlugin(options: {
  mockDataPath: string;
  outputPath?: string;
  filter?: (filename: string, data: any) => boolean;
  transform?: (data: any, filename: string) => any;
}): Plugin {
  return {
    name: 'mockifyer-build-plugin',
    buildStart() {
      const outputPath = options.outputPath || path.join(process.cwd(), 'dist/static-data.json');
      
      console.log('[Mockifyer Build Plugin] Generating static data file...');
      
      generateStaticDataFile({
        mockDataPath: options.mockDataPath,
        outputPath,
        filter: options.filter,
        transform: options.transform,
        format: 'json'
      });
    }
  };
}

// Usage in vite.config.ts:
/*
import { mockifyerBuildPlugin } from '@sgedda/mockifyer-core/examples/vite-build-example';

export default {
  plugins: [
    mockifyerBuildPlugin({
      mockDataPath: './mock-data',
      outputPath: './dist/static-data.json',
      filter: (filename, data) => data.request.method === 'GET',
      transform: (data) => data.response.data
    })
  ]
};
*/

