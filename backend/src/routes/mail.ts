import express from 'express';
import { 
  sendMail, 
  getMailHistory, 
  uploadAttachments, 
  testEmailConfig, 
  sendTestEmail,
  getEmailProviders,
  setupEmailCredentials,
  verifyEmailCredentials,
  removeEmailCredentials,
  getEmailStatus,
  testFallbackEmail,
  getEmailConfiguration,
  diagnoseEmailConfiguration,
  testSMTPConfiguration,
  testGmailSMTP
} from '../controllers/mailController';
import { protect } from '../middleware/auth';
import { getEmailConfiguration as getEmailConfig } from '../config/emailConfig';
import { unifiedEmailService } from '../config/unifiedEmailService';
import { globalSMTPTransport, sendUserEmail, sendSystemEmail, verifyGlobalSMTP, getSMTPStatus } from '../services/globalEmailService';
import nodemailer from 'nodemailer';

const router = express.Router();

// Multer configuration is handled in mailController

// Simple test endpoint (no auth required for debugging)
router.get('/test-global-smtp', async (req, res) => {
  try {
    console.log('\n📧 ===== TESTING GLOBAL SMTP (NO AUTH) =====');
    
    if (!globalSMTPTransport) {
      return res.status(500).json({
        success: false,
        error: 'Global SMTP transport not available - check EMAIL_USER configuration'
      });
    }

    const info = await globalSMTPTransport.sendMail({
      from: `"TM Paysage Test" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: "✅ Test Email from TM System",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #16a34a;">✅ Global SMTP Test Successful!</h2>
          <p>This is a working test of the unified email system using global SMTP credentials.</p>
          
          <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3>Configuration Details:</h3>
            <ul>
              <li><strong>Service:</strong> ${process.env.EMAIL_SERVICE || 'gmail'}</li>
              <li><strong>SMTP User:</strong> ${process.env.EMAIL_USER}</li>
              <li><strong>From Address:</strong> ${process.env.EMAIL_FROM || process.env.EMAIL_USER}</li>
              <li><strong>Test Time:</strong> ${new Date().toISOString()}</li>
            </ul>
          </div>
          
          <p style="color: #666;">✅ All outgoing emails now use the same verified Gmail account</p>
          <p style="color: #666;">✅ No need for per-user credentials</p>
          <p style="color: #666;">✅ No more "user has no credentials" errors</p>
          <p style="color: #666;">✅ Consistent reply-to behavior</p>
        </div>
      `,
      text: "This is a working test of the unified email system"
    });

    console.log('✅ Global SMTP test email sent successfully!');
    console.log('📬 Message ID:', info.messageId);

    return res.json({
      success: true,
      messageId: info.messageId,
      to: process.env.EMAIL_USER,
      service: process.env.EMAIL_SERVICE || 'gmail',
      smtpUser: process.env.EMAIL_USER,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Global SMTP test failed:', error.message);
    
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// TEST ROUTE (as requested by user)
router.post('/email/test-send', async (req, res) => {
  try {
    const globalTransporter = require('../services/emailService');
    
    const info = await globalTransporter.sendMail({
      from: `"TM Paysage Test" <${process.env.EMAIL_FROM}>`,
      to: req.body.to || process.env.EMAIL_USER,
      subject: "✅ Test Email from TM System",
      html: "<p>This is a working test of the unified email system</p>"
    });

    res.json({
      success: true,
      messageId: info.messageId
    });
  } catch (e: any) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// Apply authentication middleware to all routes
router.use(protect);

// Test route to verify mail routes are working
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Dynamic Mail System Active!',
    features: [
      'Send emails using user\'s own email service',
      'Support for Gmail, Outlook, Yahoo',
      'Encrypted credential storage',
      'Dynamic SMTP configuration'
    ],
    endpoints: {
      send: 'POST /api/mail/send',
      status: 'GET /api/mail/status',
      config: 'GET /api/mail/config',
      providers: 'GET /api/mail/providers',
      setup: 'POST /api/mail/setup-credentials',
      verify: 'POST /api/mail/verify-credentials',
      remove: 'DELETE /api/mail/credentials',
      testFallback: 'POST /api/mail/test-fallback',
      diagnose: 'POST /api/mail/diagnose',
      testSMTP: 'POST /api/mail/test-smtp',
      testGmail: 'POST /api/mail/test-gmail-smtp'
    }
  });
});

// Core email functionality
router.post('/send', uploadAttachments, sendMail);
router.get('/history', getMailHistory);

// Email credential management
router.get('/status', getEmailStatus);
router.get('/config', getEmailConfiguration);
router.get('/providers', getEmailProviders);
router.post('/setup-credentials', setupEmailCredentials);
router.post('/verify-credentials', verifyEmailCredentials);
router.delete('/credentials', removeEmailCredentials);

// Email testing and diagnostics
router.post('/diagnose', diagnoseEmailConfiguration);
router.post('/test-smtp', testSMTPConfiguration);
router.post('/test-gmail-smtp', testGmailSMTP);
router.post('/test-fallback', testFallbackEmail);

// Legacy/debugging routes (for backward compatibility)
router.get('/test-config', testEmailConfig);
router.post('/test-send', sendTestEmail);

// GLOBAL SMTP TEST ENDPOINT (as requested by user)
router.post('/test-send-global', async (req, res) => {
  try {
    console.log('\n📧 ===== TESTING GLOBAL SMTP DELIVERY =====');
    
    if (!globalSMTPTransport) {
      return res.status(500).json({
        success: false,
        error: 'Global SMTP transport not available - check EMAIL_USER configuration'
      });
    }

    const testEmail = req.body.to || process.env.EMAIL_USER;
    
    const info = await globalSMTPTransport.sendMail({
      from: `"TM Paysage Test" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: testEmail,
      subject: "✅ Test Email from TM System",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #16a34a;">✅ Global SMTP Test Successful!</h2>
          <p>This is a working test of the unified email system using global SMTP credentials.</p>
          
          <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3>Configuration Details:</h3>
            <ul>
              <li><strong>Service:</strong> ${process.env.EMAIL_SERVICE || 'gmail'}</li>
              <li><strong>SMTP User:</strong> ${process.env.EMAIL_USER}</li>
              <li><strong>From Address:</strong> ${process.env.EMAIL_FROM || process.env.EMAIL_USER}</li>
              <li><strong>Test Time:</strong> ${new Date().toISOString()}</li>
            </ul>
          </div>
          
          <p style="color: #666;">✅ All outgoing emails now use the same verified Gmail account</p>
          <p style="color: #666;">✅ No need for per-user credentials</p>
          <p style="color: #666;">✅ No more "user has no credentials" errors</p>
          <p style="color: #666;">✅ Consistent reply-to behavior</p>
        </div>
      `,
      text: "This is a working test of the unified email system"
    });

    console.log('✅ Global SMTP test email sent successfully!');
    console.log('📬 Message ID:', info.messageId);

    return res.json({
      success: true,
      messageId: info.messageId,
      to: testEmail,
      service: process.env.EMAIL_SERVICE || 'gmail',
      smtpUser: process.env.EMAIL_USER,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Global SMTP test failed:', error.message);
    
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Global SMTP status endpoint
router.get('/smtp-status', async (req, res) => {
  try {
    const status = getSMTPStatus();
    const verification = await verifyGlobalSMTP();
    
    return res.json({
      success: true,
      smtp: {
        ...status,
        connectionVerified: verification.success,
        connectionError: verification.error
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Send user email via global SMTP (replaces per-user credentials)
router.post('/send-user-email', async (req, res) => {
  try {
    const { fromUser, toEmail, subject, message, html } = req.body;
    
    if (!fromUser || !toEmail || !subject || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: fromUser, toEmail, subject, message'
      });
    }

    const result = await sendUserEmail({
      fromUser,
      toEmail,
      subject,
      message,
      html
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    return res.json({
      success: true,
      messageId: result.messageId,
      delivery: 'SMTP',
      smtpUser: process.env.EMAIL_USER
    });

  } catch (error: any) {
    console.error('❌ User email sending failed:', error.message);
    
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// UNIFIED SMTP TEST ENDPOINTS (as requested by user)
router.get('/test-smtp-unified', async (req, res) => {
  try {
    console.log('\n🧪 ===== TESTING UNIFIED SMTP CONNECTION =====');
    
    const verification = await unifiedEmailService.verifyConnection();
    
    if (!verification.success) {
      return res.status(500).json({
        success: false,
        message: 'SMTP verification failed',
        error: verification.error,
        config: unifiedEmailService.getConfiguration()
      });
    }

    const config = unifiedEmailService.getConfiguration();
    
    return res.json({
      success: true,
      message: 'SMTP is properly configured and verified.',
      config: {
        service: config.service,
        user: config.user,
        from: config.from,
        isInitialized: config.isInitialized,
        hasTransporter: config.hasTransporter
      }
    });

  } catch (error: any) {
    console.error('❌ SMTP test failed:', error.message);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      config: unifiedEmailService.getConfiguration()
    });
  }
});

router.post('/test-send-unified', async (req, res) => {
  try {
    console.log('\n📧 ===== TESTING UNIFIED EMAIL DELIVERY =====');
    
    if (!unifiedEmailService.isReady()) {
      return res.status(500).json({
        success: false,
        error: 'Email service not ready - check EMAIL_USER configuration',
        config: unifiedEmailService.getConfiguration()
      });
    }

    const result = await unifiedEmailService.sendEmail({
      to: process.env.EMAIL_USER!, // send to self
      subject: '✅ Test Email from TM Paysage',
      text: 'This is a test email to verify unified SMTP configuration.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #16a34a;">✅ Test Email Successful!</h2>
          <p>This test email confirms that your unified SMTP configuration is working correctly.</p>
          
          <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3>Configuration Details:</h3>
            <ul>
              <li><strong>Service:</strong> ${process.env.EMAIL_SERVICE || 'gmail'}</li>
              <li><strong>SMTP User:</strong> ${process.env.EMAIL_USER}</li>
              <li><strong>From Address:</strong> ${process.env.EMAIL_FROM || process.env.EMAIL_USER}</li>
              <li><strong>Test Time:</strong> ${new Date().toISOString()}</li>
            </ul>
          </div>
          
          <p style="color: #666;">All emails (OTP + external) are now using the same unified SMTP configuration.</p>
          
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 14px; color: #999;">
            This is an automated test message from TM Paysage Site Manager.
          </p>
        </div>
      `
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        config: unifiedEmailService.getConfiguration()
      });
    }

    return res.json({
      success: true,
      messageId: result.messageId,
      to: process.env.EMAIL_USER,
      timestamp: new Date().toISOString(),
      config: unifiedEmailService.getConfiguration()
    });

  } catch (error: any) {
    console.error('❌ Test email failed:', error.message);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      config: unifiedEmailService.getConfiguration()
    });
  }
});

// Test SMTP connection endpoint (simple GET version)
router.get('/test-smtp-connection', async (req, res) => {
  try {
    console.log('\n🧪 ===== TESTING SMTP CONNECTION =====');
    
    const emailConfig = getEmailConfig();
    
    if (!emailConfig.hasWorkingConfig || !emailConfig.fallbackConfig) {
      return res.status(400).json({
        success: false,
        error: 'No SMTP credentials configured',
        details: 'Please set EMAIL_USER and EMAIL_PASSWORD in your .env file'
      });
    }

    // Create test transporter using the exact same logic as the fallback service
    const testTransporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.FALLBACK_SMTP_USER || process.env.EMAIL_USER,
        pass: process.env.FALLBACK_SMTP_PASS || process.env.EMAIL_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      }
    });

    console.log('🔧 Testing SMTP connection...');
    console.log('📧 User:', process.env.FALLBACK_SMTP_USER || process.env.EMAIL_USER);
    console.log('📧 Service:', process.env.EMAIL_SERVICE || 'gmail');

    // Verify the connection
    await testTransporter.verify();
    
    console.log('✅ SMTP connection test successful!');
    
    return res.json({
      success: true,
      message: 'SMTP connection successful',
      config: {
        service: process.env.EMAIL_SERVICE || 'gmail',
        user: process.env.FALLBACK_SMTP_USER || process.env.EMAIL_USER,
        hasMainCredentials: emailConfig.hasMainCredentials,
        hasWorkingConfig: emailConfig.hasWorkingConfig,
        fallbackUser: emailConfig.fallbackConfig.auth.user
      }
    });

  } catch (error: any) {
    console.error('❌ SMTP connection test failed:', error.message);
    
    return res.status(500).json({
      success: false,
      error: 'SMTP connection failed',
      details: error.message,
      troubleshooting: [
        'Verify EMAIL_USER and EMAIL_PASSWORD are set correctly',
        'Make sure you are using an app password for Gmail (not your regular password)',
        'Check your network connection',
        'Ensure 2-factor authentication is enabled and app password is generated'
      ]
    });
  }
});

// Test email delivery endpoint
router.get('/test-email-delivery', async (req, res) => {
  try {
    console.log('\n📧 ===== TESTING EMAIL DELIVERY =====');
    
    const emailConfig = getEmailConfig();
    
    if (!emailConfig.hasWorkingConfig || !emailConfig.fallbackConfig) {
      return res.status(400).json({
        success: false,
        error: 'No SMTP credentials configured',
        details: 'Please set EMAIL_USER and EMAIL_PASSWORD in your .env file'
      });
    }

    // Create transporter using the same format as requested
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.FALLBACK_SMTP_USER || process.env.EMAIL_USER,
        pass: process.env.FALLBACK_SMTP_PASS || process.env.EMAIL_PASSWORD,
      },
      tls: { rejectUnauthorized: false }
    });

    const testEmail = process.env.EMAIL_USER!;
    
    // Send test email
    const mailOptions = {
      from: {
        name: 'TM Paysage SMTP Test',
        address: process.env.EMAIL_FROM || process.env.EMAIL_USER!
      },
      to: testEmail,
      subject: 'SMTP Configuration Test - Success!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #16a34a;">✅ SMTP Test Successful!</h2>
          <p>This test email confirms that your SMTP configuration is working correctly.</p>
          
          <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3>Configuration Details:</h3>
            <ul>
              <li><strong>Service:</strong> ${process.env.EMAIL_SERVICE || 'gmail'}</li>
              <li><strong>SMTP User:</strong> ${process.env.FALLBACK_SMTP_USER || process.env.EMAIL_USER}</li>
              <li><strong>From Address:</strong> ${process.env.EMAIL_FROM || process.env.EMAIL_USER}</li>
              <li><strong>Test Time:</strong> ${new Date().toISOString()}</li>
            </ul>
          </div>
          
          <p style="color: #666;">All external emails (OTP + user emails) will now be delivered successfully.</p>
          
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 14px; color: #999;">
            This is an automated test message from TM Paysage Site Manager.
          </p>
        </div>
      `
    };

    console.log('📤 Sending test email to:', testEmail);
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Test email sent successfully!');
    console.log('📬 Message ID:', result.messageId);

    return res.json({
      success: true,
      message: 'Test email sent successfully',
      details: {
        to: testEmail,
        messageId: result.messageId,
        service: process.env.EMAIL_SERVICE || 'gmail',
        smtpUser: process.env.FALLBACK_SMTP_USER || process.env.EMAIL_USER,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('❌ Test email failed:', error.message);
    
    return res.status(500).json({
      success: false,
      error: 'Test email delivery failed',
      details: error.message,
      troubleshooting: [
        'Verify SMTP connection is working (/api/mail/test-smtp-connection)',
        'Check EMAIL_USER and EMAIL_PASSWORD are correct',
        'Ensure Gmail app password is valid',
        'Verify network connectivity to smtp.gmail.com:587'
      ]
    });
  }
});

export default router; 