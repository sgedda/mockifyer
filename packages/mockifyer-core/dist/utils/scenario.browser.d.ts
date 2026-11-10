/**
 * Browser stub for scenario utilities.
 * Scenario management requires fs access, not available in browsers.
 */
export declare function initializeScenario(_config?: any): void;
export declare function isScenarioLaunchFromNativeArguments(): boolean;
export declare function getCurrentScenario(): string;
export declare function getScenarioFolderPath(basePath: string): string;
export declare function ensureScenarioFolder(_basePath: string): void;
