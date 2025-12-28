/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/'],
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  moduleNameMapper: {
    '^@sgedda/mockifyer-core$': '<rootDir>/../../packages/mockifyer-core/dist/index.js',
    '^@sgedda/mockifyer-fetch$': '<rootDir>/../../packages/mockifyer-fetch/dist/index.js',
  },
};

