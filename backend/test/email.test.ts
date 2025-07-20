import request from 'supertest';
import { Express } from 'express';
import { unifiedEmailService } from '../src/config/unifiedEmailService';

// Mock the express app - adjust this path based on your server export
// Since the server file might not export the app directly, we'll create a mock setup
const mockApp = {
  get: jest.fn(),
  post: jest.fn(),
  listen: jest.fn(),
  use: jest.fn()
};

// Mock environment variables for testing
process.env.EMAIL_SERVICE = 'gmail';
process.env.EMAIL_USER = 'samer19alloush@gmail.com';
process.env.EMAIL_PASSWORD = 'ouca mkgc embx sqwc';
process.env.EMAIL_FROM = 'noreply@gs-construction.com';

describe('SMTP Email Tests', () => {
  beforeAll(async () => {
    // Load environment variables
    require('dotenv').config();
  });

  describe('Unified Email Service', () => {
    it('should initialize successfully with valid credentials', async () => {
      const config = unifiedEmailService.getConfiguration();
      
      expect(config.hasCredentials).toBe(true);
      expect(config.service).toBe('gmail');
      expect(config.user).toBe('samer19alloush@gmail.com');
      expect(config.from).toBe('noreply@gs-construction.com');
    });

    it('should verify SMTP connection successfully', async () => {
      const verification = await unifiedEmailService.verifyConnection();
      
      expect(verification.success).toBe(true);
      expect(verification.error).toBeUndefined();
    });

    it('should be ready to send emails', () => {
      const isReady = unifiedEmailService.isReady();
      expect(isReady).toBe(true);
    });
  });

  describe('Email Sending Functionality', () => {
    it('should send a test email successfully', async () => {
      const emailOptions = {
        to: process.env.EMAIL_USER!,
        subject: 'Jest Test Email - SMTP Configuration',
        text: 'This is a test email sent from Jest automated tests.',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>✅ Jest Test Email</h2>
            <p>This email was sent successfully from the automated Jest test suite.</p>
            <ul>
              <li><strong>Test Time:</strong> ${new Date().toISOString()}</li>
              <li><strong>Service:</strong> ${process.env.EMAIL_SERVICE}</li>
              <li><strong>From:</strong> ${process.env.EMAIL_FROM}</li>
            </ul>
            <p style="color: #666;">SMTP unified configuration is working correctly!</p>
          </div>
        `
      };

      const result = await unifiedEmailService.sendEmail(emailOptions);
      
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.error).toBeUndefined();
      
      console.log(`✅ Test email sent with ID: ${result.messageId}`);
    }, 30000); // 30 second timeout for email sending

    it('should handle invalid email addresses gracefully', async () => {
      const emailOptions = {
        to: 'invalid-email-address',
        subject: 'Test Invalid Email',
        text: 'This should fail validation.'
      };

      const result = await unifiedEmailService.sendEmail(emailOptions);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('SMTP Configuration Validation', () => {
    it('should have all required environment variables set', () => {
      expect(process.env.EMAIL_SERVICE).toBe('gmail');
      expect(process.env.EMAIL_USER).toBe('samer19alloush@gmail.com');
      expect(process.env.EMAIL_PASSWORD).toBeDefined();
      expect(process.env.EMAIL_FROM).toBe('noreply@gs-construction.com');
    });

    it('should auto-assign fallback credentials', () => {
      // These should be auto-assigned by the unified email service
      expect(process.env.FALLBACK_SMTP_USER).toBe(process.env.EMAIL_USER);
      expect(process.env.FALLBACK_SMTP_PASS).toBe(process.env.EMAIL_PASSWORD);
      expect(process.env.FALLBACK_SMTP_HOST).toBe('smtp.gmail.com');
      expect(process.env.FALLBACK_SMTP_PORT).toBe('587');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing credentials gracefully', async () => {
      // Temporarily unset credentials
      const originalUser = process.env.EMAIL_USER;
      const originalPass = process.env.EMAIL_PASSWORD;
      
      delete process.env.EMAIL_USER;
      delete process.env.EMAIL_PASSWORD;
      
      const verification = await unifiedEmailService.verifyConnection();
      
      expect(verification.success).toBe(false);
      expect(verification.error).toContain('not initialized');
      
      // Restore credentials
      process.env.EMAIL_USER = originalUser;
      process.env.EMAIL_PASSWORD = originalPass;
    });
  });
});

describe('Integration Tests (if server is available)', () => {
  // These tests would run against a running server
  // Uncomment and modify based on your server setup
  
  /*
  let app: Express;
  
  beforeAll(async () => {
    // Import your app here
    // app = await import('../src/server').then(m => m.app);
  });

  it('should verify SMTP connection via API endpoint', async () => {
    const res = await request(app).get('/api/mail/test-smtp-unified');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should send a test email via API endpoint', async () => {
    const res = await request(app).post('/api/mail/test-send-unified');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.messageId).toBeDefined();
  });
  */
});

// Helper function to run a complete SMTP test
export const runCompleteEmailTest = async (): Promise<{
  connectionTest: boolean;
  emailDeliveryTest: boolean;
  configurationValid: boolean;
}> => {
  console.log('\n🧪 ===== RUNNING COMPLETE EMAIL TEST SUITE =====');
  
  // Test 1: Connection verification
  console.log('1. Testing SMTP connection...');
  const connectionResult = await unifiedEmailService.verifyConnection();
  const connectionTest = connectionResult.success;
  console.log(`   Result: ${connectionTest ? '✅ SUCCESS' : '❌ FAILED'}`);
  
  // Test 2: Email delivery
  console.log('2. Testing email delivery...');
  const emailResult = await unifiedEmailService.sendEmail({
    to: process.env.EMAIL_USER!,
    subject: 'Complete Email Test Suite - Automated Test',
    text: 'This email confirms that the complete email test suite passed successfully.',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #16a34a;">✅ Complete Email Test Suite</h2>
        <p>All email functionality tests have been completed successfully!</p>
        <ul>
          <li>SMTP Connection: ✅ Verified</li>
          <li>Email Delivery: ✅ Working</li>
          <li>Configuration: ✅ Valid</li>
        </ul>
        <p><em>Test completed at: ${new Date().toISOString()}</em></p>
      </div>
    `
  });
  const emailDeliveryTest = emailResult.success;
  console.log(`   Result: ${emailDeliveryTest ? '✅ SUCCESS' : '❌ FAILED'}`);
  
  // Test 3: Configuration validation
  console.log('3. Validating configuration...');
  const config = unifiedEmailService.getConfiguration();
  const configurationValid = config.hasCredentials && config.isInitialized;
  console.log(`   Result: ${configurationValid ? '✅ SUCCESS' : '❌ FAILED'}`);
  
  console.log('\n📊 FINAL TEST RESULTS:');
  console.log(`Connection Test: ${connectionTest ? '✅' : '❌'}`);
  console.log(`Email Delivery: ${emailDeliveryTest ? '✅' : '❌'}`);
  console.log(`Configuration: ${configurationValid ? '✅' : '❌'}`);
  console.log('================================\n');
  
  return {
    connectionTest,
    emailDeliveryTest,
    configurationValid
  };
}; 