import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        // Le tsconfig du package utilise module ESNext ; CommonJS pour les tests Jest.
        tsconfig: { module: 'commonjs', esModuleInterop: true },
      },
    ],
  },
  moduleFileExtensions: ['js', 'json', 'ts'],
  clearMocks: true,
};

export default config;
