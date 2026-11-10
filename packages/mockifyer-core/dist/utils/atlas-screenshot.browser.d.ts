/**
 * Browser stub for atlas-screenshot.
 * Screenshot capture requires fs access, not available in browsers.
 */
export declare function captureScreenshot(_url: string, _options?: any): Promise<Buffer | null>;
export declare function saveScreenshot(_buffer: Buffer, _path: string): Promise<void>;
