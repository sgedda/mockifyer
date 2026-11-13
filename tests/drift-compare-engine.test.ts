/**
 * Unit tests for drift detection comparison engine.
 */

import {
  compareResponses,
  hasBreakingIssues,
  groupIssuesBySeverity,
} from '@sgedda/mockifyer-core/utils/drift';

describe('drift-compare-engine', () => {
  describe('status changes', () => {
    it('should detect status code changes as breaking', () => {
      const issues = compareResponses({
        expectedStatus: 200,
        actualStatus: 404,
        expectedBody: {},
        actualBody: {},
      });

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        path: 'status',
        type: 'status_change',
        severity: 'breaking',
        expected: '200',
        actual: '404',
      });
      expect(issues[0].message).toContain('200 to 404');
    });

    it('should not report drift when status matches', () => {
      const issues = compareResponses({
        expectedStatus: 200,
        actualStatus: 200,
        expectedBody: { data: 'test' },
        actualBody: { data: 'test' },
      });

      expect(issues).toHaveLength(0);
    });
  });

  describe('missing keys', () => {
    it('should detect removed keys as breaking', () => {
      const issues = compareResponses({
        expectedStatus: 200,
        actualStatus: 200,
        expectedBody: { name: 'John', age: 30 },
        actualBody: { name: 'John' },
      });

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        path: 'age',
        type: 'missing_key',
        severity: 'breaking',
        expected: 'number',
      });
      expect(issues[0].message).toContain('removed');
    });

    it('should detect nested removed keys', () => {
      const issues = compareResponses({
        expectedStatus: 200,
        actualStatus: 200,
        expectedBody: {
          user: { id: 1, name: 'John', email: 'john@example.com' },
        },
        actualBody: {
          user: { id: 1, name: 'John' },
        },
      });

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        path: 'user.email',
        type: 'missing_key',
        severity: 'breaking',
      });
    });
  });

  describe('extra keys', () => {
    it('should detect new keys as warnings', () => {
      const issues = compareResponses({
        expectedStatus: 200,
        actualStatus: 200,
        expectedBody: { name: 'John' },
        actualBody: { name: 'John', age: 30 },
      });

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        path: 'age',
        type: 'extra_key',
        severity: 'warning',
        actual: 'number',
      });
      expect(issues[0].message).toContain('added');
    });

    it('should detect nested new keys', () => {
      const issues = compareResponses({
        expectedStatus: 200,
        actualStatus: 200,
        expectedBody: {
          user: { id: 1, name: 'John' },
        },
        actualBody: {
          user: { id: 1, name: 'John', email: 'john@example.com' },
        },
      });

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        path: 'user.email',
        type: 'extra_key',
        severity: 'warning',
      });
    });
  });

  describe('type changes', () => {
    it('should detect type changes as breaking', () => {
      const issues = compareResponses({
        expectedStatus: 200,
        actualStatus: 200,
        expectedBody: { count: 42 },
        actualBody: { count: '42' },
      });

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        path: 'count',
        type: 'type_change',
        severity: 'breaking',
        expected: 'number',
        actual: 'string',
      });
    });

    it('should detect null to object changes as warning', () => {
      const issues = compareResponses({
        expectedStatus: 200,
        actualStatus: 200,
        expectedBody: { data: null },
        actualBody: { data: { value: 'test' } },
      });

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        type: 'type_change',
        severity: 'warning',
        expected: 'null',
        actual: 'object',
      });
    });

    it('should detect object to array changes', () => {
      const issues = compareResponses({
        expectedStatus: 200,
        actualStatus: 200,
        expectedBody: { items: { key: 'value' } },
        actualBody: { items: ['value'] },
      });

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        path: 'items',
        type: 'type_change',
        expected: 'object',
        actual: 'array',
      });
    });
  });

  describe('arrays', () => {
    it('should compare array element shapes (union of all items)', () => {
      const issues = compareResponses({
        expectedStatus: 200,
        actualStatus: 200,
        expectedBody: {
          items: [{ id: 1, name: 'Item 1' }],
        },
        actualBody: {
          items: [{ id: 1 }],
        },
      });

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        path: 'items[*].name',
        type: 'missing_key',
        severity: 'breaking',
      });
    });

    it('should detect new fields in array elements', () => {
      const issues = compareResponses({
        expectedStatus: 200,
        actualStatus: 200,
        expectedBody: {
          items: [{ id: 1 }],
        },
        actualBody: {
          items: [{ id: 1, status: 'active' }],
        },
      });

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        path: 'items[*].status',
        type: 'extra_key',
        severity: 'warning',
      });
    });

    it('should not report issues when array becomes empty (time-sensitive data)', () => {
      const issues = compareResponses({
        expectedStatus: 200,
        actualStatus: 200,
        expectedBody: {
          items: [{ id: 1 }, { id: 2 }],
        },
        actualBody: {
          items: [],
        },
      });

      expect(issues).toHaveLength(0);
    });

    it('should not report issues for empty to non-empty arrays', () => {
      const issues = compareResponses({
        expectedStatus: 200,
        actualStatus: 200,
        expectedBody: { items: [] },
        actualBody: { items: [{ id: 1 }] },
      });

      expect(issues).toHaveLength(0);
    });

    it('should compare union of all array items', () => {
      const issues = compareResponses({
        expectedStatus: 200,
        actualStatus: 200,
        expectedBody: {
          items: [
            { id: 1, name: 'Item 1' },
            { id: 2, name: 'Item 2', status: 'active' },
          ],
        },
        actualBody: {
          items: [
            { id: 1, name: 'Item 1' },
            { id: 2, name: 'Item 2' },
          ],
        },
      });

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        path: 'items[*].status',
        type: 'missing_key',
        severity: 'breaking',
      });
    });
  });

  describe('nested structures', () => {
    it('should detect deeply nested changes', () => {
      const issues = compareResponses({
        expectedStatus: 200,
        actualStatus: 200,
        expectedBody: {
          data: {
            user: {
              profile: {
                settings: { theme: 'dark' },
              },
            },
          },
        },
        actualBody: {
          data: {
            user: {
              profile: {
                settings: {},
              },
            },
          },
        },
      });

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        path: 'data.user.profile.settings.theme',
        type: 'missing_key',
        severity: 'breaking',
      });
    });

    it('should handle complex nested structures with arrays', () => {
      const issues = compareResponses({
        expectedStatus: 200,
        actualStatus: 200,
        expectedBody: {
          data: {
            teams: [
              {
                id: 1,
                members: [{ userId: 10, role: 'admin' }],
              },
            ],
          },
        },
        actualBody: {
          data: {
            teams: [
              {
                id: 1,
                members: [{ userId: 10 }],
              },
            ],
          },
        },
      });

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        path: 'data.teams[*].members[*].role',
        type: 'missing_key',
        severity: 'breaking',
      });
    });
  });

  describe('ignore paths', () => {
    it('should ignore exact path matches', () => {
      const issues = compareResponses(
        {
          expectedStatus: 200,
          actualStatus: 200,
          expectedBody: { timestamp: '2024-01-01', data: 'value' },
          actualBody: { data: 'value' },
        },
        { ignorePaths: ['timestamp'] }
      );

      expect(issues).toHaveLength(0);
    });

    it('should ignore nested paths', () => {
      const issues = compareResponses(
        {
          expectedStatus: 200,
          actualStatus: 200,
          expectedBody: {
            data: { id: 1, meta: { timestamp: '2024-01-01', requestId: 'abc' } },
          },
          actualBody: {
            data: { id: 1, meta: {} },
          },
        },
        { ignorePaths: ['data.meta.timestamp', 'data.meta.requestId'] }
      );

      expect(issues).toHaveLength(0);
    });

    it('should ignore all children of an ignored path', () => {
      const issues = compareResponses(
        {
          expectedStatus: 200,
          actualStatus: 200,
          expectedBody: {
            data: { value: 'test' },
            meta: { timestamp: '2024-01-01', requestId: 'abc', version: 1 },
          },
          actualBody: {
            data: { value: 'test' },
            meta: {},
          },
        },
        { ignorePaths: ['meta'] }
      );

      expect(issues).toHaveLength(0);
    });

    it('should ignore array element paths', () => {
      const issues = compareResponses(
        {
          expectedStatus: 200,
          actualStatus: 200,
          expectedBody: {
            items: [{ id: 1, timestamp: '2024-01-01' }],
          },
          actualBody: {
            items: [{ id: 1 }],
          },
        },
        { ignorePaths: ['items[*].timestamp'] }
      );

      expect(issues).toHaveLength(0);
    });
  });

  describe('multiple issues', () => {
    it('should report all issues in one comparison', () => {
      const issues = compareResponses({
        expectedStatus: 200,
        actualStatus: 404,
        expectedBody: {
          data: { name: 'John', age: 30 },
          metadata: { version: 1 },
        },
        actualBody: {
          data: { name: 'John', email: 'john@example.com' },
          metadata: { version: '1' },
        },
      });

      expect(issues.length).toBeGreaterThan(3);

      const statusIssue = issues.find((i) => i.type === 'status_change');
      expect(statusIssue).toBeDefined();

      const missingKeyIssue = issues.find((i) => i.path === 'data.age');
      expect(missingKeyIssue).toMatchObject({ type: 'missing_key' });

      const extraKeyIssue = issues.find((i) => i.path === 'data.email');
      expect(extraKeyIssue).toMatchObject({ type: 'extra_key' });

      const typeChangeIssue = issues.find((i) => i.path === 'metadata.version');
      expect(typeChangeIssue).toMatchObject({ type: 'type_change' });
    });
  });

  describe('helper functions', () => {
    it('should identify breaking issues', () => {
      const issues = [
        { path: 'name', type: 'missing_key' as const, severity: 'breaking' as const, message: '' },
        { path: 'email', type: 'extra_key' as const, severity: 'warning' as const, message: '' },
      ];

      expect(hasBreakingIssues(issues)).toBe(true);
    });

    it('should return false when no breaking issues', () => {
      const issues = [
        { path: 'email', type: 'extra_key' as const, severity: 'warning' as const, message: '' },
      ];

      expect(hasBreakingIssues(issues)).toBe(false);
    });

    it('should group issues by severity', () => {
      const issues = [
        { path: 'name', type: 'missing_key' as const, severity: 'breaking' as const, message: '' },
        { path: 'age', type: 'type_change' as const, severity: 'breaking' as const, message: '' },
        { path: 'email', type: 'extra_key' as const, severity: 'warning' as const, message: '' },
      ];

      const grouped = groupIssuesBySeverity(issues);

      expect(grouped.breaking).toHaveLength(2);
      expect(grouped.warning).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty objects', () => {
      const issues = compareResponses({
        expectedStatus: 200,
        actualStatus: 200,
        expectedBody: {},
        actualBody: {},
      });

      expect(issues).toHaveLength(0);
    });

    it('should handle null bodies', () => {
      const issues = compareResponses({
        expectedStatus: 204,
        actualStatus: 204,
        expectedBody: null,
        actualBody: null,
      });

      expect(issues).toHaveLength(0);
    });

    it('should handle mismatched null and object as warning', () => {
      const issues = compareResponses({
        expectedStatus: 200,
        actualStatus: 200,
        expectedBody: null,
        actualBody: { data: 'value' },
      });

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        type: 'type_change',
        severity: 'warning',
        expected: 'null',
        actual: 'object',
      });
    });

    it('should handle primitive body values', () => {
      const issues = compareResponses({
        expectedStatus: 200,
        actualStatus: 200,
        expectedBody: 'string response',
        actualBody: 'string response',
      });

      expect(issues).toHaveLength(0);
    });

    it('should detect primitive type changes', () => {
      const issues = compareResponses({
        expectedStatus: 200,
        actualStatus: 200,
        expectedBody: 42,
        actualBody: '42',
      });

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        type: 'type_change',
        expected: 'number',
        actual: 'string',
      });
    });
  });
});
