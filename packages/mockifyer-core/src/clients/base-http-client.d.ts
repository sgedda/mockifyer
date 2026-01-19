import { HTTPClient, HTTPRequestConfig, HTTPResponse } from '../types/http-client';
export declare abstract class BaseHTTPClient<T = any, R = HTTPResponse<T>> implements HTTPClient<T, R> {
    protected abstract performRequest<D = any>(config: HTTPRequestConfig<D>): Promise<R>;
    protected abstract getDefaultHeaders(): Record<string, string>;
    protected abstract getDefaultConfig(): Record<string, any>;
    protected requestInterceptors: Array<{
        onFulfilled?: (config: HTTPRequestConfig) => HTTPRequestConfig | Promise<HTTPRequestConfig>;
        onRejected?: (error: any) => any;
    }>;
    protected responseInterceptors: Array<{
        onFulfilled?: (response: R) => R | Promise<R>;
        onRejected?: (error: any) => any;
    }>;
    get defaults(): {
        headers: Record<string, string>;
    };
    get interceptors(): {
        request: {
            use: (onFulfilled?: (config: HTTPRequestConfig) => HTTPRequestConfig | Promise<HTTPRequestConfig>, onRejected?: (error: any) => any) => number;
            eject: (id: number) => void;
            clear: () => void;
        };
        response: {
            use: (onFulfilled?: (response: R) => R | Promise<R>, onRejected?: (error: any) => any) => number;
            eject: (id: number) => void;
            clear: () => void;
        };
    };
    request<D = any>(config: HTTPRequestConfig<D>): Promise<R>;
    get<D = any>(url: string, config?: HTTPRequestConfig<D>): Promise<R>;
    post<D = any>(url: string, data?: D, config?: HTTPRequestConfig<D>): Promise<R>;
    put<D = any>(url: string, data?: D, config?: HTTPRequestConfig<D>): Promise<R>;
    delete<D = any>(url: string, config?: HTTPRequestConfig<D>): Promise<R>;
    patch<D = any>(url: string, data?: D, config?: HTTPRequestConfig<D>): Promise<R>;
    head<D = any>(url: string, config?: HTTPRequestConfig<D>): Promise<R>;
    options<D = any>(url: string, config?: HTTPRequestConfig<D>): Promise<R>;
    getUri<D = any>(config?: HTTPRequestConfig<D>): string;
}
//# sourceMappingURL=base-http-client.d.ts.map