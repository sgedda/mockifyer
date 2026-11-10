import * as esbuild from 'esbuild';
import * as fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Plugin to stub out Node-only modules in browser builds
const stubNodeModules = {
  name: 'stub-node-modules',
  setup(build) {
    // Intercept Node-only modules at load time
    build.onLoad({ filter: /\/(crypto-digest|network-body-spill|atlas-screenshot|atlas-doc-html|scenario|node-capabilities\.node|core-proxy|domain-path-rules-session|domain-path-rules-file)\.(js|ts)$/ }, (args) => {
      if (args.path.includes('crypto-digest')) {
        return {
          contents: `
            export function digest(input) {
              // Browser: use Web Crypto or pure JS (already in browserCapabilities)
              throw new Error('[Mockifyer Browser] Use browserCapabilities.digest');
            }
          `,
          loader: 'js'
        };
      }
      if (args.path.includes('scenario')) {
        return {
          contents: `
            export function initializeScenario() {}
            export function isScenarioLaunchFromNativeArguments() { return false; }
            export function getCurrentScenario() { return 'default'; }
          `,
          loader: 'js'
        };
      }
      if (args.path.includes('domain-path-rules-session')) {
        return {
          contents: `
            export class DomainPathRulesSession {
              constructor(options) { this.options = options; }
              discover() {}
              getTrafficGate() { return { mayReplay: true, mayRecord: this.options?.getRecordMode?.() ?? false }; }
              enableRecordResponsesForAllRules() {}
              invalidateCache() {}
              async hydrate() {}
            }
          `,
          loader: 'js'
        };
      }
      if (args.path.includes('domain-path-rules-file')) {
        return {
          contents: `
            export function domainPathRulesFilePath() { return ''; }
            export function readDomainPathRulesFile() { return null; }
            export function writeDomainPathRulesFile() {}
          `,
          loader: 'js'
        };
      }
      if (args.path.includes('network-body-spill') || args.path.includes('atlas-screenshot') || args.path.includes('atlas-doc-html')) {
        return {
          contents: `export function spillBodyToDisk() {}; export function readSpilledBody() { return null; }; export function generateAtlasHtml() {}; export function captureScreenshot() {}`,
          loader: 'js'
        };
      }
      if (args.path.includes('node-capabilities.node')) {
        return {
          contents: `export const nodeCapabilities = { digest: () => '', getCurrentScenario: () => 'default', getScenarioFolderPath: (p) => p, ensureScenarioFolder: () => {} };`,
          loader: 'js'
        };
      }
      // Default stub for core-proxy
      return {
        contents: `
          export function performDashboardProxyRequest() {
            throw new Error('[Mockifyer Browser] Dashboard proxy requires Node.js');
          }
          export function applyProxyRecordOnMissEnv(c) { return c; }
          export function mirrorProxyRecordingToClient() {}
          export function initMockifyerForDashboardProxy() {
            throw new Error('[Mockifyer Browser] Dashboard proxy requires Node.js');
          }
          export function initMockifyerForLocalFilesystem() {
            throw new Error('[Mockifyer Browser] Use setupMockifyer from browser entry');
          }
          export function initMockifyerForDashboardProxyClients() {
            throw new Error('[Mockifyer Browser] Dashboard proxy requires Node.js');
          }
          export function initMockifyerForLocalFilesystemClients() {
            throw new Error('[Mockifyer Browser] Use setupMockifyer from browser entry');
          }
          export function resolveClientInitFlags() { return {}; }
          export function needsSiblingClientSetup() { return false; }
          export function syncDualMockifyerControls() {}
          export function pickPrimaryDualMockifyerInstance(t,f,r) { return r.fetch || r.axios; }
          export function loadAxiosSetupMockifyer() { return null; }
          export function loadFetchSetupMockifyer() { return null; }
        `,
        loader: 'js'
      };
    });
  }
};

// Plugin to fail build if Node built-ins are imported
const failOnNodeBuiltins = {
  name: 'fail-on-node-builtins',
  setup(build) {
    const nodeBuiltins = ['fs', 'path', 'crypto', 'buffer', 'stream', 'util', 'os', 'net', 'tls', 'dns', 'url'];
    
    build.onResolve({ filter: /.*/ }, args => {
      if (nodeBuiltins.includes(args.path)) {
        return {
          errors: [{
            text: `❌ FORBIDDEN: Node built-in '${args.path}' imported in browser build at ${args.importer}`,
            location: null
          }]
        };
      }
      return null;
    });
  }
};

try {
  console.log('Building browser bundle (platform=browser, NO node built-ins allowed)...');
  
  const result = await esbuild.build({
    entryPoints: [path.resolve(__dirname, 'src/index.ts')],
    bundle: true,
    platform: 'browser',
    target: 'es2020',
    format: 'esm',
    outfile: 'dist/index.js',
    sourcemap: true,
    minify: false,
    external: [], // NO externals - bundle everything to verify no Node modules
    conditions: ['browser', 'module', 'import'],
    mainFields: ['browser', 'module', 'main'],
    plugins: [stubNodeModules, failOnNodeBuiltins], // Stub Node-only modules, then fail on any remaining Node built-ins
    define: {
      'process.env.NODE_ENV': '"production"',
      'global': 'window'
    },
    loader: {
      '.json': 'json',
      '.ts': 'ts',
      '.tsx': 'tsx'
    },
    logLevel: 'info',
    metafile: true,
  });
  
  console.log('✅ Build succeeded - NO Node built-ins detected');
  
  // Write metafile for analysis
  fs.writeFileSync('dist/meta.json', JSON.stringify(result.metafile, null, 2));
  
  // Copy index.html
  fs.copyFileSync('src/index.html', 'dist/index.html');
  console.log('✅ Copied index.html to dist/');
  
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}
