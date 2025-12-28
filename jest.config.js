/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/example-projects/', '/examples/'],
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  moduleNameMapper: {
    '^@sgedda/mockifyer-core$': '<rootDir>/packages/mockifyer-core/src/index.ts',
    '^@sgedda/mockifyer-core/(.*)$': '<rootDir>/packages/mockifyer-core/src/$1',
    '^@sgedda/mockifyer-axios$': '<rootDir>/packages/mockifyer-axios/src/index.ts',
    '^@sgedda/mockifyer-axios/(.*)$': '<rootDir>/packages/mockifyer-axios/src/$1',
    '^@sgedda/mockifyer-fetch$': '<rootDir>/packages/mockifyer-fetch/src/index.ts',
    '^@sgedda/mockifyer-fetch/(.*)$': '<rootDir>/packages/mockifyer-fetch/src/$1',
  },
}; 