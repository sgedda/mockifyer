import { EventEmitter } from 'events';
import {
  attachMetroAtlasKeyHandler,
  detachMetroAtlasKeyHandler,
  getMetroAtlasSessionPhase,
  getMetroAtlasStreamSubscriberCount,
  matchesAtlasKey,
  notifyMetroAtlasStreamClientConnected,
  notifyMetroAtlasStreamClientDisconnected,
  resolveAtlasKeyOption,
  resolveDashboardKeyOption,
  resolveMetroAtlasLiveUrl,
  resolveMetroDashboardUrl,
  DEFAULT_METRO_ATLAS_KEY,
  DEFAULT_METRO_DASHBOARD_KEY,
  DEFAULT_METRO_DASHBOARD_URL,
} from '@sgedda/mockifyer-fetch/metro-atlas-key-handlers';
import { ATLAS_LIVE_STREAM_PATH } from '@sgedda/mockifyer-core';

describe('metro-atlas-key-handlers', () => {
  const prevDashboardUrl = process.env.MOCKIFYER_DASHBOARD_URL;
  const prevDashboardBase = process.env.MOCKIFYER_DASHBOARD_BASE;

  afterEach(() => {
    detachMetroAtlasKeyHandler();
    if (prevDashboardUrl === undefined) delete process.env.MOCKIFYER_DASHBOARD_URL;
    else process.env.MOCKIFYER_DASHBOARD_URL = prevDashboardUrl;
    if (prevDashboardBase === undefined) delete process.env.MOCKIFYER_DASHBOARD_BASE;
    else process.env.MOCKIFYER_DASHBOARD_BASE = prevDashboardBase;
  });

  describe('resolveAtlasKeyOption', () => {
    it('defaults to t (a is reserved for Android)', () => {
      expect(resolveAtlasKeyOption()).toBe(DEFAULT_METRO_ATLAS_KEY);
      expect(resolveAtlasKeyOption(undefined)).toBe('t');
      expect(DEFAULT_METRO_ATLAS_KEY).not.toBe('a');
    });

    it('disables with false or empty', () => {
      expect(resolveAtlasKeyOption(false)).toBeNull();
      expect(resolveAtlasKeyOption('')).toBeNull();
      expect(resolveAtlasKeyOption('   ')).toBeNull();
    });

    it('normalizes to a single lowercase char', () => {
      expect(resolveAtlasKeyOption('A')).toBe('a');
      expect(resolveAtlasKeyOption('x')).toBe('x');
    });
  });

  describe('resolveDashboardKeyOption', () => {
    it('defaults to m', () => {
      expect(resolveDashboardKeyOption()).toBe(DEFAULT_METRO_DASHBOARD_KEY);
    });

    it('disables with false', () => {
      expect(resolveDashboardKeyOption(false)).toBeNull();
    });
  });

  describe('resolveMetroDashboardUrl', () => {
    it('defaults to localhost:3002', () => {
      delete process.env.MOCKIFYER_DASHBOARD_URL;
      delete process.env.MOCKIFYER_DASHBOARD_BASE;
      expect(resolveMetroDashboardUrl()).toBe(DEFAULT_METRO_DASHBOARD_URL);
    });

    it('uses explicit over env', () => {
      process.env.MOCKIFYER_DASHBOARD_URL = 'http://env:9999';
      expect(resolveMetroDashboardUrl('http://explicit:3002')).toBe(
        'http://explicit:3002',
      );
    });

    it('appends MOCKIFYER_DASHBOARD_BASE', () => {
      delete process.env.MOCKIFYER_DASHBOARD_URL;
      process.env.MOCKIFYER_DASHBOARD_BASE = '/dashboard';
      expect(resolveMetroDashboardUrl('http://localhost:3002')).toBe(
        'http://localhost:3002/dashboard',
      );
    });
  });

  describe('resolveMetroAtlasLiveUrl', () => {
    const prevMetroUrl = process.env.MOCKIFYER_METRO_URL;
    const prevMetroPort = process.env.METRO_PORT;

    afterEach(() => {
      if (prevMetroUrl === undefined) delete process.env.MOCKIFYER_METRO_URL;
      else process.env.MOCKIFYER_METRO_URL = prevMetroUrl;
      if (prevMetroPort === undefined) delete process.env.METRO_PORT;
      else process.env.METRO_PORT = prevMetroPort;
    });

    it('defaults to localhost Metro + live path', () => {
      delete process.env.MOCKIFYER_METRO_URL;
      delete process.env.METRO_PORT;
      expect(resolveMetroAtlasLiveUrl()).toBe(
        `http://localhost:8081${ATLAS_LIVE_STREAM_PATH}`,
      );
    });

    it('uses MOCKIFYER_METRO_URL when set', () => {
      process.env.MOCKIFYER_METRO_URL = 'http://127.0.0.1:19000/';
      expect(resolveMetroAtlasLiveUrl()).toBe(
        `http://127.0.0.1:19000${ATLAS_LIVE_STREAM_PATH}`,
      );
    });
  });

  describe('matchesAtlasKey', () => {
    it('matches name or str without modifiers', () => {
      expect(matchesAtlasKey('a', { name: 'a' }, 'a')).toBe(true);
      expect(matchesAtlasKey('A', { name: 'a' }, 'a')).toBe(true);
      expect(matchesAtlasKey(undefined, { name: 'a' }, 'a')).toBe(true);
    });

    it('ignores ctrl/meta', () => {
      expect(matchesAtlasKey('a', { name: 'a', ctrl: true }, 'a')).toBe(false);
      expect(matchesAtlasKey('a', { name: 'a', meta: true }, 'a')).toBe(false);
    });

    it('ignores other keys', () => {
      expect(matchesAtlasKey('r', { name: 'r' }, 'a')).toBe(false);
    });
  });

  describe('attachMetroAtlasKeyHandler session toggle', () => {
    function makeStdin() {
      const stdin = new EventEmitter() as EventEmitter & {
        isTTY: boolean;
        isRaw: boolean;
        setRawMode: (mode: boolean) => void;
        resume: () => void;
        removeListener: EventEmitter['removeListener'];
        on: EventEmitter['on'];
      };
      stdin.isTTY = true;
      stdin.isRaw = true;
      stdin.setRawMode = jest.fn();
      stdin.resume = jest.fn();
      return stdin;
    }

    it('starts then stops and generates on second press', async () => {
      const stdin = makeStdin();
      let starts = 0;
      let stops = 0;
      const opened: string[] = [];

      const attached = attachMetroAtlasKeyHandler({
        atlasKey: 'a',
        dashboardKey: false,
        stdin: stdin as unknown as NodeJS.ReadStream,
        deferMs: 0,
        openUrl: (url) => {
          opened.push(url);
        },
        onSessionStart: () => {
          starts += 1;
        },
        onSessionStop: async () => {
          stops += 1;
        },
      });

      expect(attached.key).toBe('a');
      expect(attached.liveUrl).toBe(resolveMetroAtlasLiveUrl());
      expect(getMetroAtlasSessionPhase()).toBe('idle');

      stdin.emit('keypress', 'a', { name: 'a' });
      expect(starts).toBe(1);
      expect(stops).toBe(0);
      expect(getMetroAtlasSessionPhase()).toBe('capturing');
      expect(opened).toEqual([resolveMetroAtlasLiveUrl()]);
      expect(opened[0]).toContain(ATLAS_LIVE_STREAM_PATH);

      stdin.emit('keypress', 'a', { name: 'a' });
      expect(getMetroAtlasSessionPhase()).toBe('rendering');
      expect(opened).toHaveLength(1);
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(stops).toBe(1);
      expect(getMetroAtlasSessionPhase()).toBe('idle');
    });

    it('opens dashboard on m', () => {
      const stdin = makeStdin();
      const opened: string[] = [];

      const attached = attachMetroAtlasKeyHandler({
        atlasKey: false,
        dashboardKey: 'm',
        dashboardUrl: 'http://localhost:3002',
        stdin: stdin as unknown as NodeJS.ReadStream,
        deferMs: 0,
        openUrl: (url) => {
          opened.push(url);
        },
      });

      expect(attached.dashboardKey).toBe('m');
      expect(attached.dashboardUrl).toBe('http://localhost:3002');

      stdin.emit('keypress', 'm', { name: 'm' });
      expect(opened).toEqual(['http://localhost:3002']);
    });

    it('auto-starts when the hop stream connects', async () => {
      const stdin = makeStdin();
      let starts = 0;
      let stops = 0;

      attachMetroAtlasKeyHandler({
        atlasKey: 'a',
        dashboardKey: false,
        stdin: stdin as unknown as NodeJS.ReadStream,
        deferMs: 0,
        onSessionStart: () => {
          starts += 1;
        },
        onSessionStop: async () => {
          stops += 1;
        },
      });

      notifyMetroAtlasStreamClientConnected();
      expect(starts).toBe(1);
      expect(getMetroAtlasSessionPhase()).toBe('capturing');
      expect(getMetroAtlasStreamSubscriberCount()).toBe(1);

      notifyMetroAtlasStreamClientConnected();
      expect(starts).toBe(1);
      expect(getMetroAtlasStreamSubscriberCount()).toBe(2);

      notifyMetroAtlasStreamClientDisconnected();
      notifyMetroAtlasStreamClientDisconnected();
      expect(getMetroAtlasStreamSubscriberCount()).toBe(0);
      expect(getMetroAtlasSessionPhase()).toBe('capturing');

      stdin.emit('keypress', 'a', { name: 'a' });
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(stops).toBe(1);
      expect(getMetroAtlasSessionPhase()).toBe('idle');
    });

    it('ignores other keys during capture', () => {
      const stdin = makeStdin();
      let starts = 0;

      attachMetroAtlasKeyHandler({
        atlasKey: 'a',
        dashboardKey: false,
        stdin: stdin as unknown as NodeJS.ReadStream,
        deferMs: 0,
        onSessionStart: () => {
          starts += 1;
        },
        onSessionStop: () => undefined,
      });

      stdin.emit('keypress', 'a', { name: 'a' });
      stdin.emit('keypress', 'r', { name: 'r' });
      expect(starts).toBe(1);
      expect(getMetroAtlasSessionPhase()).toBe('capturing');
    });

    it('warns when atlasKey is reserved for Android', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const stdin = makeStdin();

      const attached = attachMetroAtlasKeyHandler({
        atlasKey: 'a',
        dashboardKey: false,
        stdin: stdin as unknown as NodeJS.ReadStream,
        deferMs: 0,
        onSessionStart: () => undefined,
        onSessionStop: () => undefined,
      });

      expect(attached.key).toBe('a');
      expect(warn).toHaveBeenCalledWith(
        '[Mockifyer] atlasKey "a" is reserved for Android — pick another letter',
      );
      warn.mockRestore();
    });

    it('does not attach when both keys are false', () => {
      const attached = attachMetroAtlasKeyHandler({
        atlasKey: false,
        dashboardKey: false,
        deferMs: 0,
        onSessionStart: () => undefined,
        onSessionStop: () => undefined,
      });
      expect(attached.key).toBeNull();
      expect(attached.dashboardKey).toBeNull();
      notifyMetroAtlasStreamClientConnected();
      expect(getMetroAtlasSessionPhase()).toBe('idle');
    });
  });
});
