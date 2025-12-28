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