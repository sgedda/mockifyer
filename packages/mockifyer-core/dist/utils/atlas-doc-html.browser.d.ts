/**
 * Browser stub for atlas-doc-html.
 * Atlas HTML generation requires fs access, not available in browsers.
 */
export declare function generateAtlasHtml(_data: any, _options?: any): Promise<string>;
export declare function writeAtlasHtml(_html: string, _path: string): Promise<void>;
