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
  DEFAULT_METRO_ATLAS_KEY,
} from '@sgedda/mockifyer-fetch/metro-atlas-key-handlers';

describe('metro-atlas-key-handlers', () => {
  afterEach(() => {
    detachMetroAtlasKeyHandler();
  });

  describe('resolveAtlasKeyOption', () => {
    it('defaults to a', () => {
      expect(resolveAtlasKeyOption()).toBe(DEFAULT_METRO_ATLAS_KEY);
      expect(resolveAtlasKeyOption(undefined)).toBe('a');
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

      const attached = attachMetroAtlasKeyHandler({
        atlasKey: 'a',
        stdin: stdin as unknown as NodeJS.ReadStream,
        deferMs: 0,
        onSessionStart: () => {
          starts += 1;
        },
        onSessionStop: async () => {
          stops += 1;
        },
      });

      expect(attached.key).toBe('a');
      expect(getMetroAtlasSessionPhase()).toBe('idle');

      stdin.emit('keypress', 'a', { name: 'a' });
      expect(starts).toBe(1);
      expect(stops).toBe(0);
      expect(getMetroAtlasSessionPhase()).toBe('capturing');

      stdin.emit('keypress', 'a', { name: 'a' });
      expect(getMetroAtlasSessionPhase()).toBe('rendering');
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(stops).toBe(1);
      expect(getMetroAtlasSessionPhase()).toBe('idle');
    });

    it('auto-starts when the hop stream connects', async () => {
      const stdin = makeStdin();
      let starts = 0;
      let stops = 0;

      attachMetroAtlasKeyHandler({
        atlasKey: 'a',
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

      // Second subscriber does not re-start / clear
      notifyMetroAtlasStreamClientConnected();
      expect(starts).toBe(1);
      expect(getMetroAtlasStreamSubscriberCount()).toBe(2);

      notifyMetroAtlasStreamClientDisconnected();
      notifyMetroAtlasStreamClientDisconnected();
      expect(getMetroAtlasStreamSubscriberCount()).toBe(0);
      // Still capturing until Metro key stop
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

    it('does not attach when atlasKey is false', () => {
      const attached = attachMetroAtlasKeyHandler({
        atlasKey: false,
        deferMs: 0,
        onSessionStart: () => undefined,
        onSessionStop: () => undefined,
      });
      expect(attached.key).toBeNull();
      notifyMetroAtlasStreamClientConnected();
      expect(getMetroAtlasSessionPhase()).toBe('idle');
    });
  });
});
