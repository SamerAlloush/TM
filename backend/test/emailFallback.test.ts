/**
 * Email Fallback Configuration Tests
 * Tests the logic for defaulting fallback SMTP to main email credentials
 */

import { getEmailConfiguration, getFallbackSMTPConfig, getMainSMTPConfig, isUsingSameAccount, getConfigurationSummary } from '../src/config/emailConfig';

// Store original environment variables
const originalEnv = process.env;

describe('Email Fallback Configuration', () => {
  beforeEach(() => {
    // Reset environment variables before each test
    jest.resetModules();
    process.env = { ...originalEnv };
    
    // Clear all email-related environment variables
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASSWORD;
    delete process.env.FALLBACK_SMTP_HOST;
    delete process.env.FALLBACK_SMTP_PORT;
    delete process.env.FALLBACK_SMTP_USER;
    delete process.env.FALLBACK_SMTP_PASS;
    delete process.env.FALLBACK_SMTP_SECURE;
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('When no fallback SMTP variables are defined', () => {
    test('should default to Gmail settings when main email credentials are available', () => {
      // Set up main email credentials only
      process.env.EMAIL_USER = 'test@gmail.com';
      process.env.EMAIL_PASSWORD = 'testpassword123';

      const config = getEmailConfiguration();

      expect(config.hasExplicitFallback).toBe(false);
      expect(config.hasMainCredentials).toBe(true);
      expect(config.hasWorkingConfig).toBe(true);
      expect(config.usingDefaults).toBe(true);

      // Fallback config should default to Gmail settings
      expect(config.fallbackConfig).toEqual({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@gmail.com',
          pass: 'testpassword123'
        }
      });

      // Main config should be Gmail
      expect(config.mainConfig).toEqual({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@gmail.com',
          pass: 'testpassword123'
        }
      });
    });

    test('should indicate both configs use the same account', () => {
      process.env.EMAIL_USER = 'same@gmail.com';
      process.env.EMAIL_PASSWORD = 'password123';

      expect(isUsingSameAccount()).toBe(true);
    });

    test('should return null configs when no credentials are available', () => {
      const config = getEmailConfiguration();

      expect(config.hasExplicitFallback).toBe(false);
      expect(config.hasMainCredentials).toBe(false);
      expect(config.hasWorkingConfig).toBe(false);
      expect(config.usingDefaults).toBe(false);
      expect(config.fallbackConfig).toBeNull();
      expect(config.mainConfig).toBeNull();
    });
  });

  describe('When explicit fallback SMTP variables are defined', () => {
    test('should use explicit fallback configuration over defaults', () => {
      // Disable unified mode for this test
      const originalTestMode = process.env.EMAIL_TEST_MODE;
      delete process.env.EMAIL_TEST_MODE;
      
      // Set up both main and explicit fallback credentials
      process.env.EMAIL_USER = 'main@gmail.com';
      process.env.EMAIL_PASSWORD = 'mainpassword';
      process.env.FALLBACK_SMTP_HOST = 'smtp.custom.com';
      process.env.FALLBACK_SMTP_PORT = '465';
      process.env.FALLBACK_SMTP_USER = 'fallback@custom.com';
      process.env.FALLBACK_SMTP_PASS = 'fallbackpassword';
      process.env.FALLBACK_SMTP_SECURE = 'true';

      const config = getEmailConfiguration();

      expect(config.hasExplicitFallback).toBe(true);
      expect(config.hasMainCredentials).toBe(true);
      expect(config.hasWorkingConfig).toBe(true);
      expect(config.usingDefaults).toBe(false);

      // Fallback config should use explicit settings
      expect(config.fallbackConfig).toEqual({
        host: 'smtp.custom.com',
        port: 465,
        secure: true,
        auth: {
          user: 'fallback@custom.com',
          pass: 'fallbackpassword'
        }
      });

              // Main config should still use Gmail
        expect(config.mainConfig).toEqual({
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: {
            user: 'main@gmail.com',
            pass: 'mainpassword'
          }
        });

        // Cleanup
        process.env.EMAIL_TEST_MODE = originalTestMode;
      });

    test('should indicate different accounts when using explicit fallback', () => {
      // Disable unified mode for this test
      const originalTestMode = process.env.EMAIL_TEST_MODE;
      delete process.env.EMAIL_TEST_MODE;
      
      process.env.EMAIL_USER = 'main@gmail.com';
      process.env.EMAIL_PASSWORD = 'mainpassword';
      process.env.FALLBACK_SMTP_HOST = 'smtp.custom.com';
      process.env.FALLBACK_SMTP_PORT = '465';
      process.env.FALLBACK_SMTP_USER = 'different@custom.com';
      process.env.FALLBACK_SMTP_PASS = 'fallbackpassword';

      expect(isUsingSameAccount()).toBe(false);

      // Cleanup
      process.env.EMAIL_TEST_MODE = originalTestMode;
    });
  });

  describe('Edge cases', () => {
    test('should reject invalid email formats', () => {
      // Disable unified mode for this test to test email validation
      const originalTestMode = process.env.EMAIL_TEST_MODE;
      delete process.env.EMAIL_TEST_MODE;
      
      process.env.EMAIL_USER = 'invalid-email';
      process.env.EMAIL_PASSWORD = 'password123';

      const config = getEmailConfiguration();

      expect(config.hasMainCredentials).toBe(false);
      expect(config.hasWorkingConfig).toBe(false);
      expect(config.mainConfig).toBeNull();
      expect(config.fallbackConfig).toBeNull();

      // Cleanup
      process.env.EMAIL_TEST_MODE = originalTestMode;
    });

    test('should reject placeholder values', () => {
      process.env.EMAIL_USER = 'your-email@gmail.com';
      process.env.EMAIL_PASSWORD = 'your-email-password';

      const config = getEmailConfiguration();

      expect(config.hasMainCredentials).toBe(false);
      expect(config.hasWorkingConfig).toBe(false);
    });

    test('should handle partial fallback configuration', () => {
      process.env.EMAIL_USER = 'test@gmail.com';
      process.env.EMAIL_PASSWORD = 'testpassword';
      process.env.FALLBACK_SMTP_HOST = 'smtp.custom.com';
      // Missing FALLBACK_SMTP_PORT, FALLBACK_SMTP_USER, FALLBACK_SMTP_PASS

      const config = getEmailConfiguration();

      expect(config.hasExplicitFallback).toBe(false);
      expect(config.usingDefaults).toBe(true);
      
      // Should fall back to using main credentials with Gmail settings (ignores partial host setting)
      expect(config.fallbackConfig?.host).toBe('smtp.gmail.com'); // Uses Gmail default, not partial custom host
      expect(config.fallbackConfig?.auth.user).toBe('test@gmail.com');
    });
  });

  describe('Helper functions', () => {
    test('getFallbackSMTPConfig should return fallback configuration', () => {
      process.env.EMAIL_USER = 'test@gmail.com';
      process.env.EMAIL_PASSWORD = 'testpassword';

      const fallbackConfig = getFallbackSMTPConfig();

      expect(fallbackConfig).toEqual({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@gmail.com',
          pass: 'testpassword'
        }
      });
    });

    test('getMainSMTPConfig should return main configuration', () => {
      process.env.EMAIL_USER = 'test@gmail.com';
      process.env.EMAIL_PASSWORD = 'testpassword';

      const mainConfig = getMainSMTPConfig();

      expect(mainConfig).toEqual({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@gmail.com',
          pass: 'testpassword'
        }
      });
    });

    test('getConfigurationSummary should provide comprehensive summary', () => {
      process.env.EMAIL_USER = 'test@gmail.com';
      process.env.EMAIL_PASSWORD = 'testpassword';

      const summary = getConfigurationSummary();

      expect(summary).toEqual({
        hasExplicitFallback: false,
        hasMainCredentials: true,
        hasWorkingConfig: true,
        usingDefaults: true,
        sameAccount: true,
        fallbackHost: 'smtp.gmail.com',
        fallbackPort: 587,
        fallbackUser: 'test@gmail.com',
        mainUser: 'test@gmail.com'
      });
    });
  });

  describe('Global Fallback SMTP Configuration', () => {
    test('should use global fallback SMTP when no user credentials exist', () => {
      // Clear user credentials
      delete process.env.EMAIL_USER;
      delete process.env.EMAIL_PASSWORD;
      
      // Set global fallback SMTP
      process.env.FALLBACK_SMTP_HOST = 'smtp.gmail.com';
      process.env.FALLBACK_SMTP_PORT = '587';
      process.env.FALLBACK_SMTP_USER = 'support@example.com';
      process.env.FALLBACK_SMTP_PASS = 'global-password';

      const config = getEmailConfiguration();
      const summary = getConfigurationSummary();

      // Should have working config using global fallback for both main and fallback
      expect(config.hasMainCredentials).toBe(true);
      expect(config.hasWorkingConfig).toBe(true);
      expect(config.usingDefaults).toBe(true);
      expect(summary.sameAccount).toBe(true);
      
      // Both configs should use global fallback credentials
      expect(config.fallbackConfig?.auth.user).toBe('support@example.com');
      expect(config.mainConfig?.auth.user).toBe('support@example.com');
      expect(config.fallbackConfig?.host).toBe('smtp.gmail.com');
      expect(config.mainConfig?.host).toBe('smtp.gmail.com');

      // Cleanup
      delete process.env.FALLBACK_SMTP_HOST;
      delete process.env.FALLBACK_SMTP_PORT;
      delete process.env.FALLBACK_SMTP_USER;
      delete process.env.FALLBACK_SMTP_PASS;
    });

    test('should force unified configuration when EMAIL_TEST_MODE=unified', () => {
      // Set unified test mode
      const originalTestMode = process.env.EMAIL_TEST_MODE;
      process.env.EMAIL_TEST_MODE = 'unified';
      process.env.EMAIL_USER = 'test@gmail.com';
      process.env.EMAIL_PASSWORD = 'test-password';
      
      // Set explicit fallback variables that should be ignored in unified mode
      process.env.FALLBACK_SMTP_HOST = 'smtp.custom.com';
      process.env.FALLBACK_SMTP_PORT = '465';
      process.env.FALLBACK_SMTP_USER = 'different@custom.com';
      process.env.FALLBACK_SMTP_PASS = 'different-password';

      const config = getEmailConfiguration();
      const summary = getConfigurationSummary();

      // In unified mode, should ignore explicit fallback and use unified config
      expect(config.hasMainCredentials).toBe(true);
      expect(config.hasWorkingConfig).toBe(true);
      expect(config.usingDefaults).toBe(true);
      expect(summary.sameAccount).toBe(true);
      
      // Both configs should use main credentials in unified mode
      expect(config.fallbackConfig?.auth.user).toBe('test@gmail.com');
      expect(config.mainConfig?.auth.user).toBe('test@gmail.com');
      expect(config.fallbackConfig?.host).toBe('smtp.gmail.com');

      // Cleanup
      process.env.EMAIL_TEST_MODE = originalTestMode;
      delete process.env.FALLBACK_SMTP_HOST;
      delete process.env.FALLBACK_SMTP_PORT;
      delete process.env.FALLBACK_SMTP_USER;
      delete process.env.FALLBACK_SMTP_PASS;
    });

    test('should prevent fallback-to-console with relaxed validation in unified mode', () => {
      const originalTestMode = process.env.EMAIL_TEST_MODE;
      process.env.EMAIL_TEST_MODE = 'unified';
      process.env.EMAIL_USER = 'test@example.com'; // Relaxed validation in unified mode
      process.env.EMAIL_PASSWORD = 'test-password';

      const config = getEmailConfiguration();

      // Should accept relaxed email validation in unified mode
      expect(config.hasMainCredentials).toBe(true);
      expect(config.hasWorkingConfig).toBe(true);
      
      // Should provide working SMTP configuration
      expect(config.mainConfig).not.toBeNull();
      expect(config.fallbackConfig).not.toBeNull();
      expect(config.fallbackConfig?.auth.user).toBe('test@example.com');

      // Cleanup
      process.env.EMAIL_TEST_MODE = originalTestMode;
    });

    test('should ensure consistent unified configuration output', () => {
      const originalTestMode = process.env.EMAIL_TEST_MODE;
      process.env.EMAIL_TEST_MODE = 'unified';
      process.env.EMAIL_USER = 'test@gmail.com';
      process.env.EMAIL_PASSWORD = 'some-test-password';

      const summary = getConfigurationSummary();

      // Expected unified configuration output
      expect(summary).toEqual({
        hasExplicitFallback: false,
        hasMainCredentials: true,
        hasWorkingConfig: true,
        usingDefaults: true,
        sameAccount: true,
        fallbackHost: 'smtp.gmail.com',
        fallbackPort: 587,
        fallbackUser: 'test@gmail.com',
        mainUser: 'test@gmail.com'
      });

      // Cleanup
      process.env.EMAIL_TEST_MODE = originalTestMode;
    });

    test('should produce expected configuration output for global fallback SMTP', () => {
      // Clear user credentials to test pure global fallback scenario
      delete process.env.EMAIL_USER;
      delete process.env.EMAIL_PASSWORD;
      delete process.env.EMAIL_TEST_MODE;
      
      // Set global fallback SMTP
      process.env.FALLBACK_SMTP_HOST = 'smtp.gmail.com';
      process.env.FALLBACK_SMTP_PORT = '587';
      process.env.FALLBACK_SMTP_USER = 'support@example.com';
      process.env.FALLBACK_SMTP_PASS = 'your_app_password_here';

      const summary = getConfigurationSummary();

      // Expected global fallback configuration output
      expect(summary).toEqual({
        hasExplicitFallback: true,
        hasMainCredentials: true,
        hasWorkingConfig: true,
        usingDefaults: true,
        sameAccount: true,
        fallbackHost: 'smtp.gmail.com',
        fallbackPort: 587,
        fallbackUser: 'support@example.com',
        mainUser: 'support@example.com'
      });

      // Cleanup
      delete process.env.FALLBACK_SMTP_HOST;
      delete process.env.FALLBACK_SMTP_PORT;
      delete process.env.FALLBACK_SMTP_USER;
      delete process.env.FALLBACK_SMTP_PASS;
    });
  });

  describe('Integration with FallbackEmailService simulation', () => {
    test('should properly configure SMTP mode when using defaults', () => {
      process.env.EMAIL_USER = 'test@gmail.com';
      process.env.EMAIL_PASSWORD = 'testpassword';

      const config = getEmailConfiguration();
      const summary = getConfigurationSummary();

      // Simulate fallback service logic
      const shouldUseSMTPMode = config.hasWorkingConfig && !!config.fallbackConfig;
      const isUsingDefaults = config.usingDefaults;
      const sameAccount = summary.sameAccount;

      expect(shouldUseSMTPMode).toBe(true);
      expect(isUsingDefaults).toBe(true);
      expect(sameAccount).toBe(true);

      // Verify fallback service would use the same account for both OTP and external emails
      expect(config.mainConfig?.auth.user).toBe(config.fallbackConfig?.auth.user);
      expect(config.mainConfig?.auth.pass).toBe(config.fallbackConfig?.auth.pass);
    });

    test('should handle missing credentials gracefully', () => {
      // No credentials provided
      const config = getEmailConfiguration();

      // Simulate fallback service logic
      const shouldUseSMTPMode = config.hasWorkingConfig && config.fallbackConfig;
      const shouldUseConsoleMode = !shouldUseSMTPMode;

      expect(shouldUseSMTPMode).toBe(false);
      expect(shouldUseConsoleMode).toBe(true);
      expect(config.fallbackConfig).toBeNull();
      expect(config.mainConfig).toBeNull();
    });
  });
}); 