const rootJestConfig = require('../../jest.config');

module.exports = {
  ...rootJestConfig,
  displayName: 'data',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
  roots: ['<rootDir>/src'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!**/*.generated.ts',
    '!**/__tests__/**',
    '!**/dist/**',
    '!**/*.d.ts',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@novaconnect/data/(.*)$': '<rootDir>/src/$1',
    '^@novaconnect/core/(.*)$': '<rootDir>/../../packages/core/src/$1',
  },
};
