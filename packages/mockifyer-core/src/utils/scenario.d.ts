import { MockifyerConfig } from '../types';
/**
 * Get the current scenario name
 * Priority: config.scenarios?.default > scenario-config.json > environment variable > 'default'
 */
export declare function getCurrentScenario(mockDataPath?: string): string;
/**
 * Get the scenario folder path for a given scenario name
 */
export declare function getScenarioFolderPath(mockDataPath: string, scenario?: string): string;
/**
 * Ensure scenario folder exists
 */
export declare function ensureScenarioFolder(mockDataPath: string, scenario?: string): string;
/**
 * Initialize scenario management with the given config
 */
export declare function initializeScenario(config: MockifyerConfig): void;
/**
 * List all available scenarios (folders in mock data directory)
 */
export declare function listScenarios(mockDataPath: string): string[];
/**
 * Create a new scenario (creates folder)
 */
export declare function createScenario(mockDataPath: string, scenarioName: string): void;
/**
 * Save current scenario to scenario-config.json
 */
export declare function saveScenarioConfig(mockDataPath: string, scenario: string): void;
/**
 * Reset scenario management
 */
export declare function resetScenario(): void;
/**
 * Check if request limit is reached for the current scenario
 * @param mockDataPath Path to mock data directory
 * @returns Object with limitReached boolean and error details if limit is reached
 */
export declare function checkRequestLimit(mockDataPath: string): {
    limitReached: boolean;
    error?: {
        message: string;
        maxRequests: number;
        currentScenario: string;
    };
};
//# sourceMappingURL=scenario.d.ts.map