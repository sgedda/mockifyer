/**
 * Tests for post-record notice (once-per-process logging)
 */

import {
  shouldShowPostRecordNotice,
  markNoticeShown,
  resetNoticeForTesting,
  logPostRecordNotice,
  maybeLogPostRecordNotice,
} from '../packages/mockifyer-core/src/utils/post-record-notice';

describe('post-record notice', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    resetNoticeForTesting();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    delete process.env.MOCKIFYER_QUIET;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    delete process.env.MOCKIFYER_QUIET;
  });

  it('shows notice on first call', () => {
    expect(shouldShowPostRecordNotice()).toBe(true);
  });

  it('does not show notice after first call', () => {
    markNoticeShown();
    expect(shouldShowPostRecordNotice()).toBe(false);
  });

  it('respects disableNotice option', () => {
    expect(shouldShowPostRecordNotice({ disableNotice: true })).toBe(false);
  });

  it('respects MOCKIFYER_QUIET=1 env var', () => {
    process.env.MOCKIFYER_QUIET = '1';
    expect(shouldShowPostRecordNotice()).toBe(false);
  });

  it('respects MOCKIFYER_QUIET=true env var', () => {
    process.env.MOCKIFYER_QUIET = 'true';
    expect(shouldShowPostRecordNotice()).toBe(false);
  });

  it('logs full notice with correct format', () => {
    logPostRecordNotice({
      method: 'GET',
      url: 'https://api.example.com/users',
      filePath: 'mock-data/_scratch/api.example.com/users/GET_abc.json',
      scenario: '_scratch',
    });

    expect(consoleSpy).toHaveBeenCalledWith('');
    expect(consoleSpy).toHaveBeenCalledWith('[Mockifyer] Recorded GET https://api.example.com/users');
    expect(consoleSpy).toHaveBeenCalledWith(
      '  → Saved to: mock-data/_scratch/api.example.com/users/GET_abc.json'
    );
    expect(consoleSpy).toHaveBeenCalledWith('  → Scenario: _scratch (temporary)');
    expect(consoleSpy).toHaveBeenCalledWith(
      '  → Activate: Open dashboard (npx mockifyer dashboard) or add domain-path rule'
    );
    expect(consoleSpy).toHaveBeenCalledWith('');
  });

  it('logs notice with non-scratch scenario', () => {
    logPostRecordNotice({
      method: 'POST',
      url: 'https://api.example.com/login',
      filePath: 'mock-data/staging/api.example.com/login/POST_xyz.json',
      scenario: 'staging',
    });

    expect(consoleSpy).toHaveBeenCalledWith('  → Scenario: staging');
  });

  it('maybeLogPostRecordNotice logs only once', () => {
    maybeLogPostRecordNotice({
      method: 'GET',
      url: 'https://api.example.com/users',
      filePath: 'mock-data/_scratch/api.example.com/users/GET_abc.json',
      scenario: '_scratch',
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockClear();

    maybeLogPostRecordNotice({
      method: 'GET',
      url: 'https://api.example.com/posts',
      filePath: 'mock-data/_scratch/api.example.com/posts/GET_def.json',
      scenario: '_scratch',
    });

    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('maybeLogPostRecordNotice respects disableNotice', () => {
    maybeLogPostRecordNotice(
      {
        method: 'GET',
        url: 'https://api.example.com/users',
        filePath: 'mock-data/_scratch/api.example.com/users/GET_abc.json',
        scenario: '_scratch',
      },
      { disableNotice: true }
    );

    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('resetNoticeForTesting allows notice again', () => {
    markNoticeShown();
    expect(shouldShowPostRecordNotice()).toBe(false);

    resetNoticeForTesting();
    expect(shouldShowPostRecordNotice()).toBe(true);
  });
});
