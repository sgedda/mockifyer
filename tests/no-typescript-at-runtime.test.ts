/**
 * Assert that requiring @sgedda/mockifyer-core doesn't load the TypeScript compiler.
 * The TypeScript compiler is large (~10MB) and only needed for static code scanning.
 * Loading it at runtime causes severe initialization slowdown.
 */

describe('mockifyer-core runtime dependencies', () => {
  it('does not load the typescript module when imported', () => {
    jest.isolateModules(() => {
      // Clear any previously loaded modules
      delete require.cache[require.resolve('../packages/mockifyer-core/dist/index.js')];
      
      // Require the built package (what consumers get)
      require('../packages/mockifyer-core/dist/index.js');
      
      // Check that typescript was NOT loaded
      const typescriptLoaded = Object.keys(require.cache).some(key => 
        key.includes('typescript') && !key.includes('node_modules/@types/typescript')
      );
      
      expect(typescriptLoaded).toBe(false);
    });
  });
});
