/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  globalSetup: './jest.global-setup.cjs',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.spec.ts'],
  testTimeout: 60000,
  maxWorkers: 1,
  forceExit: true,      // ChromeDriver processes keep Jest alive after tests finish — force exit

  globals: {
    'ts-jest': {
      tsconfig: {
        module: 'commonjs',
        esModuleInterop: true,
      },
    },
  },
};
