/**
 * Mobile layout contracts for Atlas / drift HTML generators.
 * Phone widths (~360–430px) must not create page-level horizontal scroll;
 * wide tables scroll inside a wrapper; system diagram scales to container width.
 */

import {
  buildAtlasDocHtmlFiles,
  buildAtlasLiveStreamHtml,
} from '@sgedda/mockifyer-core';
import {
  generateEndpointInventoryHTML,
  generateSystemDiagramSVG,
} from '../packages/mockifyer-core/src/utils/atlas-architecture-view';
import { generateDriftHtml } from '../packages/mockifyer-core/src/utils/drift/drift-html';
import type { EndpointInventory } from '../packages/mockifyer-core/src/utils/atlas-endpoint-inventory';
import type { DriftCheckReport } from '../packages/mockifyer-core/src/utils/drift/drift-report';
import type { NetworkEvent } from '../packages/mockifyer-core/src/utils/network-event-types';

function assertNoViewportBustingFixedWidths(cssChunk: string): void {
  const fixedPx = [...cssChunk.matchAll(/(?:^|[^\d.-])(?:min-|max-)?width:\s*(\d+)px/g)];
  for (const match of fixedPx) {
    const px = Number(match[1]);
    // Allow small chrome (icons, badges); forbid layout min/fixed widths > phone viewport.
    expect(px).toBeLessThanOrEqual(360);
  }
}

describe('Atlas / drift mobile layout HTML', () => {
  const inventory: EndpointInventory = {
    byHost: new Map([
      [
        'api.example.com',
        [
          {
            host: 'api.example.com',
            method: 'GET',
            urlTemplate: '/v1/very/long/path/that/should/wrap/on/narrow/screens/users/{id}/profile',
            status: 'observed-no-chain',
            observations: [],
            codeLocations: [],
            mockExists: false,
            callCount: 4,
          },
        ],
      ],
    ]),
    all: [],
    summary: {
      totalEndpoints: 1,
      observedCount: 1,
      mockedOnlyCount: 0,
      codeOnlyCount: 0,
      unresolvedCount: 0,
      hostCoverage: [],
    },
  };

  const events: NetworkEvent[] = [
    {
      id: 'evt1',
      requestId: 'req1',
      timestamp: new Date().toISOString(),
      scenario: 'default',
      transport: 'fetch',
      source: 'upstream',
      url: 'https://api.example.com/v1/very/long/path/that/should/wrap/on/narrow/screens/users/42/profile',
      method: 'GET',
      status: 200,
      durationMs: 12,
    },
  ];

  it('wraps system diagram SVG for full-width scaling and open/zoom', () => {
    const html = generateSystemDiagramSVG(inventory, events);

    expect(html).toContain('class="atlas-system-diagram-wrap"');
    expect(html).toContain('class="atlas-system-diagram-frame"');
    expect(html).toContain('class="atlas-system-diagram"');
    expect(html).toContain('data-export="open-svg"');
    expect(html).toContain('Open diagram');
    expect(html).toContain('style="width: 100%; height: auto;"');
    expect(html).not.toContain('min-height: 400px');
  });

  it('wraps endpoint inventory tables so only the table scrolls', () => {
    const html = generateEndpointInventoryHTML(inventory, events);

    expect(html).toContain('class="atlas-table-wrap"');
    expect(html).toContain('class="atlas-endpoint-table"');
    expect(html.indexOf('atlas-table-wrap')).toBeLessThan(html.indexOf('atlas-endpoint-table'));
    expect(html).toContain('url-template');
  });

  it('ships Atlas doc CSS that clamps the page and scrolls tables', () => {
    const files = buildAtlasDocHtmlFiles(
      {
        scenario: 'default',
        updatedAt: new Date().toISOString(),
        pages: {},
        screens: {},
        prefetches: {},
      },
      events,
      { skipArchitecture: false },
    );
    const index = files['index.html'];
    expect(index).toBeTruthy();

    expect(index).toContain('overflow-x: hidden');
    expect(index).toContain('overflow-wrap: anywhere');
    expect(index).toContain('.atlas-table-wrap');
    expect(index).toContain('overflow-x: auto');
    expect(index).toContain('.atlas-system-diagram-wrap');
    expect(index).toContain('max-width: min(80rem, 100%)');
    expect(index).toContain('color-scheme: light;');
    expect(index).not.toContain('prefers-color-scheme');
    // Diagram markup is JSON-embedded in the payload; the open handler is in the page script.
    expect(index).toContain("exportType === 'open-svg'");
    expect(index).toMatch(/atlas-system-diagram-wrap/);
    expect(index).toMatch(/data-export=\\?"open-svg\\?"/);

    const style = index!.slice(index!.indexOf('<style>'), index!.indexOf('</style>'));
    // Element layout (not @media breakpoints) should not force min-widths past a phone viewport.
    const withoutMedia = style.replace(/@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/g, '');
    expect(withoutMedia).not.toMatch(/(?:^|[^\d-])min-width:\s*(?:4\d{2}|[5-9]\d{2}|\d{4,})px/);
    expect(style).toContain('html {\n  max-width: 100%;\n  overflow-x: hidden;');
  });

  it('ships Atlas live CSS without page-level overflow at phone widths', () => {
    const html = buildAtlasLiveStreamHtml();

    expect(html).toContain('overflow-x: hidden');
    expect(html).toContain('overflow-wrap: anywhere');
    expect(html).toContain('max-width: min(1100px, 100%)');
    expect(html).toContain('min-width: 0');
    expect(html).toContain('color-scheme: light;');
    expect(html).not.toContain('prefers-color-scheme');

    const style = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
    expect(style).not.toMatch(/\.search-label input\[type="search"\][^}]*min-width:\s*12rem/);
  });

  it('ships drift CSS with wrapping and no page horizontal scroll', () => {
    const report: DriftCheckReport = {
      totalMocks: 1,
      driftedMocks: 0,
      breakingDriftCount: 0,
      warningOnlyCount: 0,
      skippedCount: 0,
      notCheckedCount: 0,
      summary: '✓ All 1 mocks are in sync',
      failOnWarnings: false,
      mockReports: [
        {
          method: 'GET',
          url: 'https://api.example.com/users/very/long/path/segment/that/needs/wrapping',
          mockFilePath: 'mock-data/default/api.example.com/users/GET.json',
          hasDrift: false,
          hasBreakingDrift: false,
          issues: [],
        },
      ],
    };

    const html = generateDriftHtml(report);

    expect(html).toContain('overflow-x: hidden');
    expect(html).toContain('overflow-wrap: anywhere');
    expect(html).toContain('max-width: min(1200px, 100%)');
    expect(html).toContain('minmax(min(150px, 100%), 1fr)');
    expect(html).toContain('color-scheme: light;');
    expect(html).not.toContain('prefers-color-scheme');

    const style = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
    assertNoViewportBustingFixedWidths(
      style.replace(/@media[^{]+\{[\s\S]*?\}\s*\}/g, ''),
    );
  });
});
