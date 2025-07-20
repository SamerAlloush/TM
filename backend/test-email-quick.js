#!/usr/bin/env node

/**
 * Quick Email Test Script
 * Fast test to verify email sending works
 */

const axios = require('axios');

async function quickEmailTest() {
  console.log('⚡ Quick Email Test');
  console.log('=================\n');

  const baseURL = 'http://localhost:5000';
  
  // Test 1: Check if server is running
  console.log('1️⃣ Checking server connection...');
  try {
    const response = await axios.get(`${baseURL}/api/health`, { timeout: 5000 });
    console.log('✅ Server is running\n');
  } catch (error) {
    console.log('❌ Server is not running. Please start the backend server.');
    console.log('   Run: npm run dev (in backend directory)\n');
    return;
  }

  // Test 2: Test Gmail SMTP configuration
  console.log('2️⃣ Testing Gmail SMTP configuration...');
  try {
    const response = await axios.post(`${baseURL}/api/mail/test-gmail-smtp`, {}, { timeout: 15000 });
    
    if (response.data.success) {
      console.log('✅ Gmail SMTP configuration is working!');
      console.log(`   Message ID: ${response.data.data.messageId}`);
      console.log(`   Recipients: ${response.data.data.accepted.join(', ')}\n`);
    } else {
      console.log('❌ Gmail SMTP test failed');
      console.log(`   Error: ${response.data.error}\n`);
    }
  } catch (error) {
    console.log('❌ Gmail SMTP test failed');
    console.log(`   Error: ${error.response?.data?.error || error.message}\n`);
  }

  // Test 3: Test email system diagnostic
  console.log('3️⃣ Running email system diagnostic...');
  try {
    const response = await axios.post(`${baseURL}/api/mail/test-system`, {
      testEmail: process.env.EMAIL_USER || 'test@example.com'
    }, { timeout: 15000 });

    if (response.data.success) {
      console.log('✅ Email system diagnostic completed!');
      
      const data = response.data.data;
      console.log('\n📋 System Status:');
      console.log(`   Environment Variables: ${data.environmentCheck.EMAIL_USER ? '✅' : '❌'} EMAIL_USER, ${data.environmentCheck.EMAIL_PASSWORD ? '✅' : '❌'} EMAIL_PASSWORD`);
      console.log(`   Main Credentials: ${data.emailConfiguration.hasMainCredentials ? '✅' : '❌'}`);
      console.log(`   Working Configuration: ${data.emailConfiguration.hasWorkingConfig ? '✅' : '❌'}`);
      console.log(`   Fallback Service: ${data.fallbackService.enabled ? '✅' : '❌'} (${data.fallbackService.mode})`);
      console.log(`   Delivery Test: ${data.deliveryTest.success ? '✅' : '❌'}`);
      
      if (data.deliveryTest.success) {
        console.log(`   Test Email Sent: ${data.deliveryTest.messageId}`);
      }
      
      if (data.recommendations && data.recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        data.recommendations.forEach(rec => console.log(`   - ${rec}`));
      }
    } else {
      console.log('❌ Email system diagnostic failed');
      console.log(`   Error: ${response.data.error}`);
    }
  } catch (error) {
    console.log('❌ Email system diagnostic failed');
    console.log(`   Error: ${error.response?.data?.error || error.message}`);
  }

  console.log('\n🎯 Quick Test Complete!');
  console.log('\nNext steps:');
  console.log('- Check your email inbox for test messages');
  console.log('- Run full test suite: node test-email-comprehensive.js');
  console.log('- Test from React Native app UI');
}

// Run the quick test
if (require.main === module) {
  quickEmailTest().catch(error => {
    console.error('❌ Quick test failed:', error.message);
    process.exit(1);
  });
}

module.exports = quickEmailTest; 