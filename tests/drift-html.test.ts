/**
 * Tests for drift HTML report generation.
 */

import { generateDriftHtml } from '../packages/mockifyer-core/src/utils/drift/drift-html';
import type { DriftCheckReport } from '../packages/mockifyer-core/src/utils/drift/drift-report';

describe('Drift HTML Generation', () => {
  it('should generate HTML for a clean report', () => {
    const report: DriftCheckReport = {
      totalMocks: 3,
      driftedMocks: 0,
      breakingDriftCount: 0,
      warningOnlyCount: 0,
      skippedCount: 0,
      notCheckedCount: 0,
      summary: '✓ All 3 mocks are in sync',
      failOnWarnings: false,
      mockReports: [
        {
          method: 'GET',
          url: 'https://api.example.com/users',
          mockFilePath: 'mock-data/default/api.example.com/users/GET.json',
          hasDrift: false,
          hasBreakingDrift: false,
          issues: [],
        },
        {
          method: 'GET',
          url: 'https://api.example.com/posts',
          mockFilePath: 'mock-data/default/api.example.com/posts/GET.json',
          hasDrift: false,
          hasBreakingDrift: false,
          issues: [],
        },
        {
          method: 'POST',
          url: 'https://api.example.com/orders',
          mockFilePath: 'mock-data/default/api.example.com/orders/POST.json',
          hasDrift: false,
          hasBreakingDrift: false,
          issues: [],
        },
      ],
    };

    const html = generateDriftHtml(report, { title: 'Test Clean Report' });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Test Clean Report');
    expect(html).toContain('All Endpoints In Sync');
    expect(html).toContain('✅');
    expect(html).toContain('GET');
    expect(html).toContain('https://api.example.com/users');
    expect(html).toContain('Clean (3)');
  });

  it('always renders in light mode (no OS dark preference)', () => {
    const report: DriftCheckReport = {
      totalMocks: 0,
      driftedMocks: 0,
      breakingDriftCount: 0,
      warningOnlyCount: 0,
      skippedCount: 0,
      notCheckedCount: 0,
      summary: '✓ No mocks',
      failOnWarnings: false,
      mockReports: [],
    };

    const html = generateDriftHtml(report);

    expect(html).toContain('<meta name="color-scheme" content="light">');
    expect(html).toContain('color-scheme: light;');
    expect(html).not.toContain('color-scheme: light dark');
    expect(html).not.toContain('prefers-color-scheme');
  });

  it('should generate HTML for a report with breaking drift', () => {
    const report: DriftCheckReport = {
      totalMocks: 2,
      driftedMocks: 1,
      breakingDriftCount: 1,
      warningOnlyCount: 0,
      skippedCount: 0,
      notCheckedCount: 0,
      summary: '✗ 1 of 2 mocks drifted: 1 breaking, 0 warnings',
      failOnWarnings: false,
      mockReports: [
        {
          method: 'GET',
          url: 'https://api.example.com/users/123',
          mockFilePath: 'mock-data/default/api.example.com/users/GET_123.json',
          hasDrift: true,
          hasBreakingDrift: true,
          issues: [
            {
              path: 'email',
              type: 'missing_key',
              severity: 'breaking',
              expected: 'string',
              message: 'Key "email" removed',
            },
            {
              path: 'id',
              type: 'type_change',
              severity: 'breaking',
              expected: 'number',
              actual: 'string',
              message: 'Type changed from number to string at id',
            },
          ],
        },
        {
          method: 'GET',
          url: 'https://api.example.com/posts',
          mockFilePath: 'mock-data/default/api.example.com/posts/GET.json',
          hasDrift: false,
          hasBreakingDrift: false,
          issues: [],
        },
      ],
    };

    const html = generateDriftHtml(report, { title: 'Test Breaking Drift' });

    expect(html).toContain('Test Breaking Drift');
    expect(html).toContain('Breaking Changes Detected');
    expect(html).toContain('🚨');
    expect(html).toContain('Breaking Changes (1)');
    expect(html).toContain('https://api.example.com/users/123');
    expect(html).toContain('email');
    expect(html).toContain('Key &quot;email&quot; removed');
    expect(html).toContain('Type changed from number to string');
    expect(html).toContain('Expected: number');
    expect(html).toContain('Actual: string');
    expect(html).toContain('npx mockifyer-drift-check --accept');
  });

  it('should generate HTML for a report with warnings', () => {
    const report: DriftCheckReport = {
      totalMocks: 2,
      driftedMocks: 1,
      breakingDriftCount: 0,
      warningOnlyCount: 1,
      skippedCount: 0,
      notCheckedCount: 0,
      summary: '⚠ 1 of 2 mocks drifted: 0 breaking, 1 warnings',
      failOnWarnings: false,
      mockReports: [
        {
          method: 'GET',
          url: 'https://api.example.com/posts',
          mockFilePath: 'mock-data/default/api.example.com/posts/GET.json',
          hasDrift: true,
          hasBreakingDrift: false,
          issues: [
            {
              path: 'createdAt',
              type: 'extra_key',
              severity: 'warning',
              actual: 'string',
              message: 'New key "createdAt" added',
            },
            {
              path: 'updatedAt',
              type: 'extra_key',
              severity: 'warning',
              actual: 'string',
              message: 'New key "updatedAt" added',
            },
          ],
        },
        {
          method: 'GET',
          url: 'https://api.example.com/users',
          mockFilePath: 'mock-data/default/api.example.com/users/GET.json',
          hasDrift: false,
          hasBreakingDrift: false,
          issues: [],
        },
      ],
    };

    const html = generateDriftHtml(report, { title: 'Test Warnings' });

    expect(html).toContain('Test Warnings');
    expect(html).toContain('Warnings Detected');
    expect(html).toContain('⚠️');
    expect(html).toContain('Warnings (1)');
    expect(html).toContain('createdAt');
    expect(html).toContain('updatedAt');
    expect(html).toContain('New key');
  });

  it('should generate HTML for a report with skipped endpoints', () => {
    const report: DriftCheckReport = {
      totalMocks: 2,
      driftedMocks: 0,
      breakingDriftCount: 0,
      warningOnlyCount: 0,
      skippedCount: 1,
      notCheckedCount: 0,
      summary: '✓ 1 of 2 mocks checked, 1 skipped',
      failOnWarnings: false,
      mockReports: [
        {
          method: 'GET',
          url: 'https://api.example.com/users',
          mockFilePath: 'mock-data/default/api.example.com/users/GET.json',
          hasDrift: false,
          hasBreakingDrift: false,
          issues: [],
        },
        {
          method: 'GET',
          url: 'https://api.example.com/unreachable',
          mockFilePath: 'mock-data/default/api.example.com/unreachable/GET.json',
          hasDrift: false,
          hasBreakingDrift: false,
          issues: [],
          skipped: true,
          skipReason: 'Network error: ECONNREFUSED',
        },
      ],
    };

    const html = generateDriftHtml(report);

    expect(html).toContain('Skipped (1)');
    expect(html).toContain('https://api.example.com/unreachable');
    expect(html).toContain('Network error: ECONNREFUSED');
  });

  it('should generate HTML for a report with not checked endpoints', () => {
    const report: DriftCheckReport = {
      totalMocks: 2,
      driftedMocks: 0,
      breakingDriftCount: 0,
      warningOnlyCount: 0,
      skippedCount: 0,
      notCheckedCount: 1,
      summary: '✓ 1 of 2 mocks checked, 1 not checked',
      failOnWarnings: false,
      mockReports: [
        {
          method: 'GET',
          url: 'https://api.example.com/users',
          mockFilePath: 'mock-data/default/api.example.com/users/GET.json',
          hasDrift: false,
          hasBreakingDrift: false,
          issues: [],
        },
        {
          method: 'GET',
          url: 'https://api.example.com/trips',
          mockFilePath: 'mock-data/default/api.example.com/trips/GET.json',
          hasDrift: false,
          hasBreakingDrift: false,
          issues: [],
          notChecked: true,
          notCheckedReason: 'Empty live list (time-sensitive data)',
        },
      ],
    };

    const html = generateDriftHtml(report);

    expect(html).toContain('Not Checked (1)');
    expect(html).toContain('https://api.example.com/trips');
    expect(html).toContain('Empty live list');
  });

  it('should mark simulated endpoints with badge', () => {
    const report: DriftCheckReport = {
      totalMocks: 2,
      driftedMocks: 1,
      breakingDriftCount: 1,
      warningOnlyCount: 0,
      skippedCount: 0,
      notCheckedCount: 0,
      summary: '✗ 1 of 2 mocks drifted',
      failOnWarnings: false,
      mockReports: [
        {
          method: 'GET',
          url: 'http://localhost:4100/api/trips',
          mockFilePath: 'mock-data/drift-watch/localhost:4100/api/trips/GET.json',
          hasDrift: true,
          hasBreakingDrift: true,
          issues: [
            {
              path: 'departureDate',
              type: 'missing_key',
              severity: 'breaking',
              expected: 'string',
              message: 'Key "departureDate" removed',
            },
          ],
        },
        {
          method: 'GET',
          url: 'https://api.open-meteo.com/v1/forecast',
          mockFilePath: 'mock-data/drift-watch/api.open-meteo.com/v1/forecast/GET.json',
          hasDrift: false,
          hasBreakingDrift: false,
          issues: [],
        },
      ],
    };

    const html = generateDriftHtml(report);

    expect(html).toContain('badge-simulated');
    expect(html).toContain('Simulated');
    expect(html).toContain('localhost:4100');
  });

  it('should group issues by type', () => {
    const report: DriftCheckReport = {
      totalMocks: 1,
      driftedMocks: 1,
      breakingDriftCount: 1,
      warningOnlyCount: 0,
      skippedCount: 0,
      notCheckedCount: 0,
      summary: '✗ 1 of 1 mocks drifted',
      failOnWarnings: false,
      mockReports: [
        {
          method: 'GET',
          url: 'https://api.example.com/complex',
          mockFilePath: 'mock-data/default/api.example.com/complex/GET.json',
          hasDrift: true,
          hasBreakingDrift: true,
          issues: [
            {
              path: 'email',
              type: 'missing_key',
              severity: 'breaking',
              expected: 'string',
              message: 'Key "email" removed',
            },
            {
              path: 'phone',
              type: 'missing_key',
              severity: 'breaking',
              expected: 'string',
              message: 'Key "phone" removed',
            },
            {
              path: 'createdAt',
              type: 'extra_key',
              severity: 'warning',
              actual: 'string',
              message: 'New key "createdAt" added',
            },
            {
              path: 'id',
              type: 'type_change',
              severity: 'breaking',
              expected: 'number',
              actual: 'string',
              message: 'Type changed',
            },
          ],
        },
      ],
    };

    const html = generateDriftHtml(report);

    expect(html).toContain('Fields Removed');
    expect(html).toContain('Fields Added');
    expect(html).toContain('Types Changed');
  });

  it('should escape HTML entities in user content', () => {
    const report: DriftCheckReport = {
      totalMocks: 1,
      driftedMocks: 1,
      breakingDriftCount: 1,
      warningOnlyCount: 0,
      skippedCount: 0,
      notCheckedCount: 0,
      summary: '✗ 1 of 1 mocks drifted',
      failOnWarnings: false,
      mockReports: [
        {
          method: 'GET',
          url: 'https://api.example.com/search?q=<script>alert("xss")</script>',
          mockFilePath: 'mock-data/default/api.example.com/search/GET.json',
          hasDrift: true,
          hasBreakingDrift: true,
          issues: [
            {
              path: 'data.items[0].name',
              type: 'missing_key',
              severity: 'breaking',
              expected: 'string',
              message: 'Key with <special> & "characters" removed',
            },
          ],
        },
      ],
    };

    const html = generateDriftHtml(report);

    // Check that user-controlled content in the endpoint URL is escaped
    expect(html).toContain('endpoint-url\">https://api.example.com/search?q=&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    // Check that issue message is escaped
    expect(html).toContain('Key with &lt;special&gt; &amp; &quot;characters&quot; removed');
  });

  it('should include JavaScript for interactive features', () => {
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
          url: 'https://api.example.com/test',
          hasDrift: false,
          hasBreakingDrift: false,
          issues: [],
        },
      ],
    };

    const html = generateDriftHtml(report);

    // Check that script tag for interactive features is present
    expect(html).toContain('<script>');
    expect(html).toContain('endpoint-header');
    expect(html).toContain('addEventListener');
  });

  it('should include filter buttons for each status', () => {
    const report: DriftCheckReport = {
      totalMocks: 4,
      driftedMocks: 2,
      breakingDriftCount: 1,
      warningOnlyCount: 1,
      skippedCount: 0,
      notCheckedCount: 0,
      summary: '✗ 2 of 4 mocks drifted',
      failOnWarnings: false,
      mockReports: [
        {
          method: 'GET',
          url: 'https://api.example.com/breaking',
          hasDrift: true,
          hasBreakingDrift: true,
          issues: [
            {
              path: 'field',
              type: 'missing_key',
              severity: 'breaking',
              message: 'Removed',
            },
          ],
        },
        {
          method: 'GET',
          url: 'https://api.example.com/warning',
          hasDrift: true,
          hasBreakingDrift: false,
          issues: [
            {
              path: 'newField',
              type: 'extra_key',
              severity: 'warning',
              message: 'Added',
            },
          ],
        },
        {
          method: 'GET',
          url: 'https://api.example.com/clean1',
          hasDrift: false,
          hasBreakingDrift: false,
          issues: [],
        },
        {
          method: 'GET',
          url: 'https://api.example.com/clean2',
          hasDrift: false,
          hasBreakingDrift: false,
          issues: [],
        },
      ],
    };

    const html = generateDriftHtml(report);

    expect(html).toContain('data-filter="all"');
    expect(html).toContain('data-filter="breaking"');
    expect(html).toContain('data-filter="warning"');
    expect(html).toContain('data-filter="clean"');
  });
});
