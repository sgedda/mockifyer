import { sanitizeOptionalScenarioName } from '../packages/mockifyer-dashboard/src/utils/scenario-name';

describe('dashboard scenario query validation', () => {
  it.each<[unknown]>([['..'], ['../default'], ['default/../other'], ['foo.bar'], ['foo bar'], [['default']]])(
    'rejects invalid scenario query value %#',
    (raw) => {
      const result = sanitizeOptionalScenarioName(raw);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/Invalid scenario name|Scenario name is required/);
      }
    }
  );

  it.each(['default', 'api-error', 'api_error_2'])('accepts safe scenario query value %s', (raw) => {
    expect(sanitizeOptionalScenarioName(raw)).toEqual({ ok: true, value: raw });
  });
});
