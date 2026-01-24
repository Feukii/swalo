/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  moduleNameMapper: {
    '^@swalo/core$': '<rootDir>/../../packages/core/src',
    '^@swalo/core/(.*)$': '<rootDir>/../../packages/core/src/$1',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!**/node_modules/**'],
  coverageDirectory: './coverage',
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  testPathIgnorePatterns: ['/node_modules/', '/.expo/', '__tests__/components/'],
  clearMocks: true,
  verbose: true,
};

module.exports = config;
