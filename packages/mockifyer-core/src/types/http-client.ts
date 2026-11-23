import type { MockData, StoredResponseStream } from '../types';
import type { MockifyerTraceMeta } from '../utils/mockifyer-trace';
import type { CapturedStreamRecording } from '../utils/stream-response';

/** Payload from dashboard `/api/proxy` when a mock was persisted to Redis (optional client-side mirror). */
export interface MockifyerProxyRecordingMeta {
  recordedToStore: boolean;
  storedMock?: MockData;
  hash?: string;
  scenarioName?: string;
}

export interface HTTPRequestConfig<D = any> {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  data?: D;
  timeout?: number;
  [key: string]: any;
}

export interface HTTPResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: HTTPRequestConfig;
  mockifyerProxyRecording?: MockifyerProxyRecordingMeta;
  /** Populated from response headers or dashboard proxy envelope; upstream body stays unchanged. */
  mockifyerTrace?: MockifyerTraceMeta;
  /**
   * When recording a live stream, resolves once the recording branch finishes
   * (concatenated body + {@link StoredResponseStream}). Save paths await this
   * without delaying the caller's live ReadableStream.
   */
  mockifyerStreamRecording?: Promise<CapturedStreamRecording>;
  /**
   * Stored stream timeline to rebuild as a ReadableStream on replay
   * (local mock hit or dashboard proxy mock-hit payload).
   */
  mockifyerStoredStream?: StoredResponseStream;
}

export interface HTTPClient<T = any, R = HTTPResponse<T>> {
  // Core HTTP methods
  request<D = any>(config: HTTPRequestConfig<D>): Promise<R>;
  get<D = any>(url: string, config?: HTTPRequestConfig<D>): Promise<R>;
  post<D = any>(url: string, data?: D, config?: HTTPRequestConfig<D>): Promise<R>;
  put<D = any>(url: string, data?: D, config?: HTTPRequestConfig<D>): Promise<R>;
  delete<D = any>(url: string, config?: HTTPRequestConfig<D>): Promise<R>;
  patch<D = any>(url: string, data?: D, config?: HTTPRequestConfig<D>): Promise<R>;
  head<D = any>(url: string, config?: HTTPRequestConfig<D>): Promise<R>;
  options<D = any>(url: string, config?: HTTPRequestConfig<D>): Promise<R>;

  // Additional methods
  getUri<D = any>(config?: HTTPRequestConfig<D>): string;
  defaults: {
    headers: Record<string, string>;
    [key: string]: any;
  };
  interceptors: {
    request: {
      use: (onFulfilled?: (config: HTTPRequestConfig) => HTTPRequestConfig | Promise<HTTPRequestConfig>,
            onRejected?: (error: any) => any) => number;
      eject: (id: number) => void;
      clear: () => void;
    };
    response: {
      use: (onFulfilled?: (response: R) => R | Promise<R>,
            onRejected?: (error: any) => any) => number;
      eject: (id: number) => void;
      clear: () => void;
    };
  };
} 