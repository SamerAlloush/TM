#!/usr/bin/env node

/**
 * Comprehensive Email Testing Suite
 * Based on the External Email Sending Test Guide
 */

const axios = require('axios');
const readline = require('readline');

class EmailTester {
  constructor(baseURL = 'http://localhost:5000', token = null) {
    this.baseURL = baseURL;
    this.token = token;
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };
    this.results = {};
  }

  async promptForToken() {
    if (this.token) return;

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question('Please enter your JWT token (or press Enter to skip auth tests): ', (token) => {
        if (token.trim()) {
          this.token = token.trim();
          this.headers.Authorization = `Bearer ${this.token}`;
        }
        rl.close();
        resolve();
      });
    });
  }

  async promptForEmail() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question('Enter your email address for testing (default: test@example.com): ', (email) => {
        const testEmail = email.trim() || 'test@example.com';
        rl.close();
        resolve(testEmail);
      });
    });
  }

  log(emoji, test, message, success = null) {
    const status = success !== null ? (success ? '✅' : '❌') : '📝';
    console.log(`${status} ${emoji} ${test}: ${message}`);
  }

  async makeRequest(endpoint, data, expectedToFail = false) {
    try {
      const response = await axios.post(`${this.baseURL}${endpoint}`, data, { 
        headers: this.headers,
        timeout: 10000
      });
      
      if (expectedToFail) {
        this.log('⚠️', 'Unexpected Success', 'Request should have failed but succeeded', false);
        return { success: false, data: response.data };
      }
      
      return { success: true, data: response.data };
    } catch (error) {
      if (expectedToFail) {
        return { success: true, error: error.response?.data || error.message };
      }
      
      return { 
        success: false, 
        error: error.response?.data || error.message,
        status: error.response?.status
      };
    }
  }

  // Test Case 1: Basic Email Sending
  async testBasicTextEmail(testEmail) {
    this.log('📧', 'Basic Text Email', 'Testing simple text email sending...');
    
    const result = await this.makeRequest('/api/mail/send', {
      to: testEmail,
      subject: 'Test Email - Basic Text',
      body: 'This is a simple test email to verify basic functionality.',
      type: 'notification'
    });

    if (result.success) {
      this.log('✉️', 'Basic Text Email', `Sent successfully! Message ID: ${result.data.messageId}`, true);
    } else {
      this.log('💥', 'Basic Text Email', `Failed: ${result.error}`, false);
    }
    
    return result.success;
  }

  async testHTMLEmail(testEmail) {
    this.log('📧', 'HTML Email', 'Testing HTML email sending...');
    
    const result = await this.makeRequest('/api/mail/send', {
      to: testEmail,
      subject: 'Test Email - HTML Format',
      body: '<h1>HTML Test Email</h1><p>This is an <strong>HTML</strong> email with <em>formatting</em>.</p><ul><li>Item 1</li><li>Item 2</li></ul>',
      type: 'notification'
    });

    if (result.success) {
      this.log('🎨', 'HTML Email', 'HTML email sent successfully!', true);
    } else {
      this.log('💥', 'HTML Email', `Failed: ${result.error}`, false);
    }
    
    return result.success;
  }

  // Test Case 2: Authentication Tests
  async testUnauthenticatedRequest() {
    this.log('🔒', 'Unauthenticated Request', 'Testing request without token...');
    
    const originalHeaders = { ...this.headers };
    this.headers.Authorization = '';
    
    const result = await this.makeRequest('/api/mail/send', {
      to: 'test@example.com',
      subject: 'Unauthorized Test',
      body: 'This should fail'
    }, true);

    this.headers = originalHeaders;

    if (result.success) {
      this.log('🚫', 'Unauthenticated Request', 'Properly rejected unauthorized request', true);
    } else {
      this.log('⚠️', 'Unauthenticated Request', 'Failed to reject unauthorized request', false);
    }
    
    return result.success;
  }

  async testInvalidToken() {
    this.log('🔑', 'Invalid Token', 'Testing request with invalid token...');
    
    const originalHeaders = { ...this.headers };
    this.headers.Authorization = 'Bearer invalid-token-12345';
    
    const result = await this.makeRequest('/api/mail/send', {
      to: 'test@example.com',
      subject: 'Invalid Token Test',
      body: 'This should fail'
    }, true);

    this.headers = originalHeaders;

    if (result.success) {
      this.log('🔐', 'Invalid Token', 'Properly rejected invalid token', true);
    } else {
      this.log('⚠️', 'Invalid Token', 'Failed to reject invalid token', false);
    }
    
    return result.success;
  }

  // Test Case 3: Email Validation Tests
  async testInvalidEmailFormat() {
    this.log('📮', 'Invalid Email Format', 'Testing invalid email address validation...');
    
    const result = await this.makeRequest('/api/mail/send', {
      to: 'invalid-email-format',
      subject: 'Invalid Email Test',
      body: 'This should fail validation'
    }, true);

    if (result.success) {
      this.log('✔️', 'Invalid Email Format', 'Properly rejected invalid email format', true);
    } else {
      this.log('⚠️', 'Invalid Email Format', 'Failed to reject invalid email format', false);
    }
    
    return result.success;
  }

  async testMissingRequiredFields() {
    this.log('📋', 'Missing Required Fields', 'Testing missing required fields validation...');
    
    const result = await this.makeRequest('/api/mail/send', {
      to: 'test@example.com'
      // Missing subject and body
    }, true);

    if (result.success) {
      this.log('✔️', 'Missing Required Fields', 'Properly rejected incomplete request', true);
    } else {
      this.log('⚠️', 'Missing Required Fields', 'Failed to reject incomplete request', false);
    }
    
    return result.success;
  }

  // Test Case 4: Special Characters Test
  async testSpecialCharacters(testEmail) {
    this.log('🌍', 'Special Characters', 'Testing special characters in subject and body...');
    
    const result = await this.makeRequest('/api/mail/send', {
      to: testEmail,
      subject: 'Special Characters Test: éñ中文🚀 áéíóú ñç',
      body: 'Testing special characters: éñ中文🚀\nEmojis: 🎉 ✅ 🔥 💡\nAccents: áéíóú àèìòù âêîôû\nSymbols: ©®™ €£¥ ±≠≈',
      type: 'notification'
    });

    if (result.success) {
      this.log('🌐', 'Special Characters', 'Special characters email sent successfully!', true);
    } else {
      this.log('💥', 'Special Characters', `Failed: ${result.error}`, false);
    }
    
    return result.success;
  }

  // Test Case 5: Multiple Recipients (if supported)
  async testMultipleRecipients(testEmail) {
    this.log('👥', 'Multiple Recipients', 'Testing multiple recipients...');
    
    const recipients = [testEmail, 'test2@example.com'];
    
    const result = await this.makeRequest('/api/mail/send', {
      to: recipients,
      subject: 'Multiple Recipients Test',
      body: 'This email is sent to multiple recipients'
    });

    if (result.success) {
      this.log('📤', 'Multiple Recipients', 'Multiple recipients email sent successfully!', true);
    } else {
      this.log('📝', 'Multiple Recipients', `Not supported or failed: ${result.error}`, false);
    }
    
    return result.success;
  }

  // Test Case 6: System Health Tests
  async testGmailSMTP() {
    this.log('📡', 'Gmail SMTP Test', 'Testing Gmail SMTP configuration...');
    
    const result = await this.makeRequest('/api/mail/test-gmail-smtp', {});

    if (result.success) {
      this.log('📮', 'Gmail SMTP Test', 'Gmail SMTP configuration is working!', true);
    } else {
      this.log('💥', 'Gmail SMTP Test', `Failed: ${result.error}`, false);
    }
    
    return result.success;
  }

  async testEmailSystemDiagnostic(testEmail) {
    this.log('🔍', 'Email System Diagnostic', 'Running comprehensive system diagnostic...');
    
    const result = await this.makeRequest('/api/mail/test-system', {
      testEmail: testEmail
    });

    if (result.success) {
      this.log('📊', 'Email System Diagnostic', 'System diagnostic completed successfully!', true);
      
      // Log diagnostic details
      const data = result.data.data;
      console.log('\n📋 Diagnostic Results:');
      console.log(`   Environment Check: ${JSON.stringify(data.environmentCheck)}`);
      console.log(`   Email Configuration: ${JSON.stringify(data.emailConfiguration)}`);
      console.log(`   Fallback Service: ${JSON.stringify(data.fallbackService)}`);
      console.log(`   Delivery Test: ${data.deliveryTest.success ? '✅' : '❌'} ${data.deliveryTest.messageId || data.deliveryTest.error}`);
      
      if (data.recommendations && data.recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        data.recommendations.forEach(rec => console.log(`   - ${rec}`));
      }
      console.log('');
    } else {
      this.log('💥', 'Email System Diagnostic', `Failed: ${result.error}`, false);
    }
    
    return result.success;
  }

  // Main test runner
  async runAllTests() {
    console.log('🧪 Email System Comprehensive Test Suite');
    console.log('=========================================\n');

    // Get test email and token
    await this.promptForToken();
    const testEmail = await this.promptForEmail();

    console.log(`\n🎯 Testing with email: ${testEmail}`);
    console.log(`🔑 Using token: ${this.token ? 'Yes' : 'No (will skip auth tests)'}\n`);

    const tests = [];

    // Basic functionality tests
    if (this.token) {
      tests.push(['basicTextEmail', () => this.testBasicTextEmail(testEmail)]);
      tests.push(['htmlEmail', () => this.testHTMLEmail(testEmail)]);
      tests.push(['specialCharacters', () => this.testSpecialCharacters(testEmail)]);
      tests.push(['multipleRecipients', () => this.testMultipleRecipients(testEmail)]);
    }

    // Authentication tests
    tests.push(['unauthenticatedRequest', () => this.testUnauthenticatedRequest()]);
    tests.push(['invalidToken', () => this.testInvalidToken()]);

    // Validation tests
    if (this.token) {
      tests.push(['invalidEmailFormat', () => this.testInvalidEmailFormat()]);
      tests.push(['missingRequiredFields', () => this.testMissingRequiredFields()]);
    }

    // System health tests
    if (this.token) {
      tests.push(['gmailSMTP', () => this.testGmailSMTP()]);
      tests.push(['systemDiagnostic', () => this.testEmailSystemDiagnostic(testEmail)]);
    }

    console.log('🚀 Running tests...\n');

    // Run all tests
    for (const [testName, testFunction] of tests) {
      try {
        this.results[testName] = await testFunction();
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between tests
      } catch (error) {
        this.log('💥', testName, `Exception: ${error.message}`, false);
        this.results[testName] = false;
      }
    }

    // Generate summary
    this.generateTestReport();
  }

  generateTestReport() {
    console.log('\n📊 Test Results Summary');
    console.log('======================');

    const testNames = {
      basicTextEmail: '📧 Basic Text Email',
      htmlEmail: '🎨 HTML Email',
      specialCharacters: '🌍 Special Characters',
      multipleRecipients: '👥 Multiple Recipients',
      unauthenticatedRequest: '🔒 Unauthenticated Request',
      invalidToken: '🔑 Invalid Token',
      invalidEmailFormat: '📮 Invalid Email Format',
      missingRequiredFields: '📋 Missing Required Fields',
      gmailSMTP: '📡 Gmail SMTP Test',
      systemDiagnostic: '🔍 System Diagnostic'
    };

    Object.entries(this.results).forEach(([test, passed]) => {
      const testLabel = testNames[test] || test;
      console.log(`${passed ? '✅' : '❌'} ${testLabel}: ${passed ? 'PASSED' : 'FAILED'}`);
    });

    const passedCount = Object.values(this.results).filter(Boolean).length;
    const totalCount = Object.keys(this.results).length;
    const percentage = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

    console.log(`\n📈 Summary: ${passedCount}/${totalCount} tests passed (${percentage}%)`);

    if (passedCount === totalCount) {
      console.log('🎉 All tests passed! Your email system is working correctly.');
    } else if (passedCount > totalCount / 2) {
      console.log('⚠️ Most tests passed, but some issues detected. Check the failures above.');
    } else {
      console.log('❌ Multiple test failures detected. Please review your email configuration.');
    }

    console.log('\n💡 Next Steps:');
    if (!this.token) {
      console.log('   - Get a valid JWT token to run authenticated tests');
    }
    console.log('   - Check your email inbox for test messages');
    console.log('   - Review server logs for any errors');
    console.log('   - Test from the React Native app UI');
  }
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Email System Comprehensive Test Suite');
    console.log('');
    console.log('Usage: node test-email-comprehensive.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --help, -h        Show this help message');
    console.log('  --token=<token>   Provide JWT token directly');
    console.log('  --email=<email>   Provide test email directly');
    console.log('  --url=<url>       API base URL (default: http://localhost:5000)');
    console.log('');
    console.log('Examples:');
    console.log('  node test-email-comprehensive.js');
    console.log('  node test-email-comprehensive.js --token=your-jwt-token --email=test@gmail.com');
    process.exit(0);
  }

  // Parse command line arguments
  const token = args.find(arg => arg.startsWith('--token='))?.split('=')[1];
  const email = args.find(arg => arg.startsWith('--email='))?.split('=')[1];
  const url = args.find(arg => arg.startsWith('--url='))?.split('=')[1] || 'http://localhost:5000';

  const tester = new EmailTester(url, token);
  
  // Override email prompt if provided
  if (email) {
    tester.promptForEmail = () => Promise.resolve(email);
  }

  tester.runAllTests().catch(error => {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  });
}

module.exports = EmailTester; 