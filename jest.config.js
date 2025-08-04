/** @type {import('jest').Config} */
export default {
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns - only test JS files in dist for now
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.test.js',
  ],
  
  // Module type
  type: 'module',
  
  // Coverage configuration
  collectCoverage: false,
  collectCoverageFrom: [
    'dist/**/*.js',
    '!dist/**/*.test.js',
    '!dist/**/*.spec.js',
    '!node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Test setup
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Timeout for tests
  testTimeout: 10000,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Verbose output
  verbose: true
};