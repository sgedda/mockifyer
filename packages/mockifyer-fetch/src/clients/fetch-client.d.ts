import { BaseHTTPClient } from '@sgedda/mockifyer-core';
import { HTTPRequestConfig, HTTPResponse } from '@sgedda/mockifyer-core';
export declare class FetchHTTPClient extends BaseHTTPClient<any, HTTPResponse<any>> {
    private baseUrl?;
    private defaultHeaders;
    constructor(config?: {
        baseUrl?: string;
        defaultHeaders?: Record<string, string>;
    });
    protected performRequest<D = any>(config: HTTPRequestConfig<D>): Promise<HTTPResponse<any>>;
    protected getDefaultHeaders(): Record<string, string>;
    protected getDefaultConfig(): Record<string, any>;
}
//# sourceMappingURL=fetch-client.d.ts.map