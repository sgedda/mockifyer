import { prettyPrintJsonText } from '../packages/mockifyer-core/src/utils/json-pretty';
import {
  formatGraphqlQueryForDisplay,
  formatGraphqlRequestBodyObject,
  isGraphqlRequestBodyObject,
  looksLikeGraphqlDisplayText,
  tryFormatGraphqlRequestBodyText,
} from '../packages/mockifyer-core/src/utils/graphql-body-display';

describe('graphql body display', () => {
  const sampleQuery =
    'query myAccountDeferredBookings($limit: Int) {\n  myAccount {\n    customerId\n  }\n}';

  it('formats GraphQL JSON so the query has real newlines', () => {
    const raw = JSON.stringify({
      operationName: 'myAccountDeferredBookings',
      query: sampleQuery,
      variables: { limit: 10, timeFilter: 'UPCOMING' },
    });
    const formatted = prettyPrintJsonText(raw);
    expect(formatted).toContain('# operationName: myAccountDeferredBookings');
    expect(formatted).toContain('query myAccountDeferredBookings($limit: Int) {');
    expect(formatted).toContain('\n  myAccount {');
    expect(formatted).toContain('# Variables');
    expect(formatted).toContain('"limit": 10');
    expect(formatted).not.toContain('\\n  myAccount');
    expect(looksLikeGraphqlDisplayText(formatted)).toBe(true);
  });

  it('soft-indents compact single-line GraphQL queries', () => {
    const display = formatGraphqlQueryForDisplay(
      'query Foo($id: ID!) { item(id: $id) { name } }'
    );
    expect(display).toContain('\n');
    expect(display).toContain('query Foo($id: ID!)');
    expect(display).toContain('item(id: $id)');
  });

  it('does not treat non-GraphQL { query: string } JSON as GraphQL', () => {
    const raw = JSON.stringify({ query: 'london weather', limit: 5 });
    expect(tryFormatGraphqlRequestBodyText(raw)).toBeNull();
    expect(prettyPrintJsonText(raw)).toContain('"query": "london weather"');
  });

  it('isGraphqlRequestBodyObject accepts anonymous selection sets', () => {
    expect(isGraphqlRequestBodyObject({ query: '{ viewer { id } }' })).toBe(true);
    expect(formatGraphqlRequestBodyObject({ query: '{ viewer { id } }' })).toContain('viewer');
  });
});
