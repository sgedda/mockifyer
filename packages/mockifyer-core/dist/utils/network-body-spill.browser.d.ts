/**
 * Browser stub for network-body-spill.
 * Body spilling to disk requires fs access, not available in browsers.
 */
export declare function spillBodyToDisk(_body: any, _path: string): Promise<void>;
export declare function readSpilledBody(_path: string): Promise<any>;
export declare function shouldSpillBody(_size: number): boolean;
