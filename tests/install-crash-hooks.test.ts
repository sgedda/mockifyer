import {
  clearFlightRecorder,
  configureFlightRecorder,
  installMockifyerCrashHooks,
  __flightRecorderBuffersForTests,
} from '@sgedda/mockifyer-core';

describe('installMockifyerCrashHooks', () => {
  let uninstall: (() => void) | null = null;
  let originalAddEventListener: typeof globalThis.addEventListener | undefined;
  let originalRemoveEventListener: typeof globalThis.removeEventListener | undefined;
  const rejectionListeners: Array<(ev: Event) => void> = [];

  beforeEach(() => {
    clearFlightRecorder();
    configureFlightRecorder({ enabled: true, maxEvents: 10, maxIncidents: 5 });
    rejectionListeners.length = 0;

    originalAddEventListener = globalThis.addEventListener;
    originalRemoveEventListener = globalThis.removeEventListener;

    (globalThis as typeof globalThis & {
      addEventListener: typeof globalThis.addEventListener;
      removeEventListener: typeof globalThis.removeEventListener;
    }).addEventListener = ((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'unhandledrejection' && typeof listener === 'function') {
        rejectionListeners.push(listener as (ev: Event) => void);
      }
    }) as typeof globalThis.addEventListener;

    (globalThis as typeof globalThis & {
      removeEventListener: typeof globalThis.removeEventListener;
    }).removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'unhandledrejection' && typeof listener === 'function') {
        const idx = rejectionListeners.indexOf(listener as (ev: Event) => void);
        if (idx >= 0) rejectionListeners.splice(idx, 1);
      }
    }) as typeof globalThis.removeEventListener;
  });

  afterEach(() => {
    uninstall?.();
    uninstall = null;

    if (originalAddEventListener) {
      globalThis.addEventListener = originalAddEventListener;
    } else {
      delete (globalThis as { addEventListener?: unknown }).addEventListener;
    }

    if (originalRemoveEventListener) {
      globalThis.removeEventListener = originalRemoveEventListener;
    } else {
      delete (globalThis as { removeEventListener?: unknown }).removeEventListener;
    }
  });

  it('registers both process and globalThis unhandledrejection listeners', () => {
    uninstall = installMockifyerCrashHooks({ postToDashboard: false });

    expect(rejectionListeners).toHaveLength(1);

    const reason = new Error('dom-rejection');
    rejectionListeners[0]({ reason } as PromiseRejectionEvent);

    const { incidents } = __flightRecorderBuffersForTests();
    expect(incidents).toHaveLength(1);
    expect(incidents[0].incidentType).toBe('unhandledrejection');
    expect(incidents[0].errorMessage).toBe('dom-rejection');
  });

  it('dedupes the same rejection reported via process and DOM', async () => {
    uninstall = installMockifyerCrashHooks({ postToDashboard: false });

    const reason = new Error('shared-rejection');
    process.emit('unhandledRejection', reason, Promise.resolve());
    rejectionListeners[0]({ reason } as PromiseRejectionEvent);

    await new Promise((r) => setTimeout(r, 20));

    const { incidents } = __flightRecorderBuffersForTests();
    expect(incidents).toHaveLength(1);
    expect(incidents[0].errorMessage).toBe('shared-rejection');
  });

  it('awaits incident POST before process.exit on uncaughtException', async () => {
    let resolveFetch!: () => void;
    const fetchStarted = new Promise<void>((resolve) => {
      resolveFetch = resolve;
    });
    let fetchCompleted = false;

    const fetchMock = jest.fn(async () => {
      resolveFetch();
      await new Promise((r) => setTimeout(r, 40));
      fetchCompleted = true;
      return { ok: true } as Response;
    });
    const previousFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;

    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    try {
      uninstall = installMockifyerCrashHooks({
        config: {
          networkLog: {
            dashboardBaseUrl: 'http://dashboard.test',
            incidents: { enabled: true, postToDashboard: true },
          },
        },
      });

      process.emit('uncaughtException', new Error('fatal-boom'));

      await fetchStarted;
      expect(fetchCompleted).toBe(false);
      expect(exitSpy).not.toHaveBeenCalled();

      await new Promise((r) => setTimeout(r, 80));
      expect(fetchCompleted).toBe(true);
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(fetchMock).toHaveBeenCalled();
    } finally {
      exitSpy.mockRestore();
      globalThis.fetch = previousFetch;
    }
  });
});
