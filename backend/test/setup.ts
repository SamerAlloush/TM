/**
 * Jest Test Setup
 * Common configuration for all tests with email SMTP configuration
 */

// Extend Jest timeout for integration tests
jest.setTimeout(10000);

// Set up test environment variables for email configuration
beforeAll(() => {
  // Ensure test environment is properly detected
  process.env.NODE_ENV = 'test';
  
  // Set up test email credentials to prevent fallback-to-console behavior
  // Only set defaults if not already provided
  if (!process.env.EMAIL_USER) process.env.EMAIL_USER = 'test@gmail.com';
  if (!process.env.EMAIL_PASSWORD) process.env.EMAIL_PASSWORD = 'test-password-123';
  if (!process.env.EMAIL_FROM) process.env.EMAIL_FROM = 'noreply@test-gs-construction.com';
  if (!process.env.EMAIL_SERVICE) process.env.EMAIL_SERVICE = 'gmail';
  
  // Enable unified email configuration for tests by default
  // This can be overridden in specific tests
  if (!process.env.EMAIL_TEST_MODE) process.env.EMAIL_TEST_MODE = 'unified';
  
  // Optionally suppress console output during tests
  if (process.env.SUPPRESS_TEST_LOGS === 'true') {
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  }
});

// Mock console methods to reduce noise during testing
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

afterAll(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

// Global test environment setup
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
}); 