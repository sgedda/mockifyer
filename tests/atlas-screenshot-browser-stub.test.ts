/**
 * Metro remaps several `dist/utils/*.js` paths to `*.browser.js` via the
 * package.json `"browser"` field (Expo web and React Native). If a stub is
 * missing an export that setup / `configureAtlas` / request matching invoke,
 * device init throws `TypeError: undefined is not a function`.
 */
import * as screenshotReal from '../packages/mockifyer-core/src/utils/atlas-screenshot';
import * as screenshotStub from '../packages/mockifyer-core/src/utils/atlas-screenshot.browser';
import * as docHtmlReal from '../packages/mockifyer-core/src/utils/atlas-doc-html';
import * as docHtmlStub from '../packages/mockifyer-core/src/utils/atlas-doc-html.browser';
import * as spillReal from '../packages/mockifyer-core/src/utils/network-body-spill';
import * as spillStub from '../packages/mockifyer-core/src/utils/network-body-spill.browser';
import * as cryptoReal from '../packages/mockifyer-core/src/utils/crypto-digest';
import * as cryptoStub from '../packages/mockifyer-core/src/utils/crypto-digest.browser';
import * as scenarioReal from '../packages/mockifyer-core/src/utils/scenario';
import * as scenarioStub from '../packages/mockifyer-core/src/utils/scenario.browser';
import { configureAtlas, resetAtlasRuntime } from '../packages/mockifyer-core/src/utils/atlas';

/** Assert every function export on `real` exists as a function on `stub`. */
function expectFunctionExportParity(
  real: Record<string, unknown>,
  stub: Record<string, unknown>,
  label: string
): void {
  const missing: string[] = [];
  for (const key of Object.keys(real)) {
    if (typeof real[key] !== 'function') {
      continue;
    }
    if (typeof stub[key] !== 'function') {
      missing.push(key);
    }
  }
  expect({ label, missing }).toEqual({ label, missing: [] });
}

describe('Metro browser-field stubs (Atlas + request path)', () => {
  afterEach(() => {
    resetAtlasRuntime();
  });

  it.each([
    ['atlas-screenshot', screenshotReal, screenshotStub],
    ['atlas-doc-html', docHtmlReal, docHtmlStub],
    ['network-body-spill', spillReal, spillStub],
    ['crypto-digest', cryptoReal, cryptoStub],
    ['scenario', scenarioReal, scenarioStub],
  ] as const)('%s stub exports every real function', (label, real, stub) => {
    expectFunctionExportParity(
      real as Record<string, unknown>,
      stub as Record<string, unknown>,
      label
    );
  });

  it('crypto-digest stub sha256Hex is usable for request keys', () => {
    const hex = cryptoStub.sha256Hex('hello');
    expect(hex).toMatch(/^[a-f0-9]{64}$/);
    expect(cryptoStub.sha256Hex('hello')).toBe(hex);
    expect(cryptoStub.utf8ByteLength('héllo')).toBeGreaterThan(5);
    expect(cryptoStub.truncateUtf8('abcdef', 3).startsWith('abc')).toBe(true);
    expect(typeof cryptoStub.randomEventId()).toBe('string');
  });

  it('configureAtlas call shape succeeds against stub no-ops', () => {
    expect(() => {
      docHtmlStub.setAtlasDocHtmlOutputPath('/tmp/atlas-html');
      spillStub.setNetworkBodySpillEnabled(true);
      screenshotStub.configureAtlasScreenshotCapture({
        enabled: screenshotStub.resolveAtlasCaptureScreenshots({
          captureScreenshots: true,
        }),
        htmlOutputPath: '/tmp/atlas-html',
      });
    }).not.toThrow();

    expect(() =>
      configureAtlas({
        mockDataPath: './mock-data',
        atlas: { mode: 'off' },
      })
    ).not.toThrow();
  });
});
