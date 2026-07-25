const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Path to the Next.js app to load next.config and .env files in the test env.
  dir: './',
});

/** @type {import('jest').Config} */
const config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'components/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    'lib/**/*.ts',
    'config/**/*.ts',
    '!app/layout.tsx',
    '!app/providers.tsx',
    '!app/api/**',
    '!**/*.d.ts',
  ],
  coverageReporters: ['text', 'text-summary', 'html', 'lcov'],
  coverageDirectory: 'coverage',
};

module.exports = createJestConfig(config);
