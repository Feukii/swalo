import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testRegex: '.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleFileExtensions: ['js', 'json', 'ts'],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^@swalo/core$': '<rootDir>/../../packages/core/src',
    '^@swalo/core/(.*)$': '<rootDir>/../../packages/core/src/$1',
  },
  setupFilesAfterEnv: ['jest-extended/all'],
  maxWorkers: 1,
  testTimeout: 30000,
  clearMocks: true,
  verbose: true,
};

export default config;
