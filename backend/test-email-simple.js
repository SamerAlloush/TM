/**
 * Simple Email Configuration Test
 * Run with: node test-email-simple.js
 */
require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmailConfig() {
  console.log('\n🧪 ===== SIMPLE EMAIL CONFIGURATION TEST =====');
  console.log('🕐 Started at:', new Date().toISOString());
  
  // Step 1: Check environment variables
  console.log('\n📋 Step 1: Environment Variables');
  console.log('EMAIL_USER:', process.env.EMAIL_USER ? '✅ Set' : '❌ Missing');
  console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '✅ Set' : '❌ Missing');
  console.log('EMAIL_SERVICE:', process.env.EMAIL_SERVICE || 'Not set');
  console.log('FALLBACK_SMTP_HOST:', process.env.FALLBACK_SMTP_HOST || 'Not set');
  console.log('FALLBACK_SMTP_USER:', process.env.FALLBACK_SMTP_USER ? '✅ Set' : '❌ Missing');
  console.log('FALLBACK_SMTP_PASS:', process.env.FALLBACK_SMTP_PASS ? '✅ Set' : '❌ Missing');
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.log('\n❌ ERROR: EMAIL_USER and EMAIL_PASSWORD must be set in .env file');
    console.log('💡 Add these lines to your backend/.env file:');
    console.log('EMAIL_USER=samer19alloush@gmail.com');
    console.log('EMAIL_PASSWORD=ouca mkgc embx sqwc');
    console.log('FALLBACK_SMTP_ENABLED=true');
    console.log('FALLBACK_SMTP_HOST=smtp.gmail.com');
    console.log('FALLBACK_SMTP_PORT=587');
    console.log('FALLBACK_SMTP_SECURE=false');
    console.log('FALLBACK_SMTP_USER=samer19alloush@gmail.com');
    console.log('FALLBACK_SMTP_PASS=ouca mkgc embx sqwc');
    return false;
  }
  
  // Step 2: Test SMTP connection
  console.log('\n🔌 Step 2: Testing SMTP Connection');
  
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
      }
    });
    
    console.log('📧 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!');
    
    // Step 3: Send test email
    console.log('\n📤 Step 3: Sending Test Email');
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // Send to self
      subject: '🧪 TM Paysage Email Test - ' + new Date().toISOString(),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #16a34a;">✅ Email Configuration Test Successful!</h2>
          <p>Your email system is working correctly!</p>
          
          <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
            <h3>Test Results:</h3>
            <ul>
              <li>✅ Environment variables loaded</li>
              <li>✅ SMTP connection verified</li>
              <li>✅ Email delivery successful</li>
            </ul>
          </div>
          
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p><strong>From:</strong> ${process.env.EMAIL_USER}</p>
          <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
          
          <p style="color: #16a34a; font-weight: bold;">
            🎉 Your email system is ready to send emails!
          </p>
        </div>
      `,
      text: `
        ✅ Email Configuration Test Successful!
        
        Your email system is working correctly!
        
        Test Results:
        - Environment variables loaded
        - SMTP connection verified  
        - Email delivery successful
        
        Timestamp: ${new Date().toISOString()}
        From: ${process.env.EMAIL_USER}
        Environment: ${process.env.NODE_ENV || 'development'}
        
        🎉 Your email system is ready to send emails!
      `
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Test email sent successfully!');
    console.log('📬 Message ID:', result.messageId);
    console.log('📧 Check your inbox:', process.env.EMAIL_USER);
    
    console.log('\n🎉 ===== ALL TESTS PASSED! =====');
    console.log('✅ Email configuration is working correctly');
    console.log('✅ Users can now send emails through the app');
    console.log('✅ No more "Email service credentials not configured" errors');
    console.log('=====================================\n');
    
    return true;
    
  } catch (error) {
    console.log('\n❌ ===== EMAIL TEST FAILED =====');
    console.error('Error:', error.message);
    
    if (error.code === 'EAUTH') {
      console.log('🔐 Authentication failed. Check:');
      console.log('   - Email address is correct');
      console.log('   - App password is correct (not regular password)');
      console.log('   - 2FA is enabled on Gmail account');
    } else if (error.code === 'ECONNECTION') {
      console.log('🌐 Connection failed. Check:');
      console.log('   - Internet connection');
      console.log('   - SMTP server is accessible');
      console.log('   - Firewall settings');
    } else {
      console.log('🔍 Troubleshooting steps:');
      console.log('   - Verify .env file configuration');
      console.log('   - Check Gmail app password settings');
      console.log('   - Ensure 2FA is enabled');
    }
    
    console.log('================================\n');
    return false;
  }
}

// Run the test
if (require.main === module) {
  testEmailConfig()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test script error:', error);
      process.exit(1);
    });
}

module.exports = testEmailConfig; 