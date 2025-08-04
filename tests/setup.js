// Jest setup file for global test configuration

// Suppress console output during tests unless explicitly testing logging
const originalConsoleError = console.error;
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;

// Only suppress if not in verbose mode
if (!process.env.JEST_VERBOSE) {
  console.error = jest.fn();
  console.log = jest.fn();
  console.warn = jest.fn();
}

// Restore console methods when needed
global.restoreConsole = () => {
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLOUD_PROJECT = 'test-project';

// Global test timeout
jest.setTimeout(10000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});