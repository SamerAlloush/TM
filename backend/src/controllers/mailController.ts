import { Request, Response } from 'express';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { User } from '../models/User';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import {
  sendEmailViaUserService,
  verifyUserEmailCredentials,
  EMAIL_PROVIDERS,
  getEmailServiceConfig,
  detectEmailProvider
} from '../config/emailService';
import { getEmailConfiguration as getEmailConfig } from '../config/emailConfig';
import fallbackEmailService from '../config/fallbackEmailService';

// Configure multer for mail attachments (reuse existing config)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/mail';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadMail = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 10 // Maximum 10 files per upload
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types for email attachments
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff',
      'video/mp4', 'video/webm', 'video/quicktime', 'video/avi', 'video/mkv',
      'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac',
      'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv', 'text/html', 'text/xml',
      'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
      'application/json', 'application/xml'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed for email attachments`));
    }
  }
});

// Enhanced Email transporter with debugging
const createTransporter = async () => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const useEthereal = process.env.USE_ETHEREAL_EMAIL === 'true';
  const useConsoleOnly = process.env.EMAIL_CONSOLE_ONLY === 'true';

  console.log('🔧 Creating email transporter...');
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Use Ethereal:', useEthereal);
  console.log('Console Only:', useConsoleOnly);

  // Console-only mode for testing
  if (useConsoleOnly) {
    console.log('📧 Using CONSOLE-ONLY mode for email testing');
    return null;
  }

  // Ethereal Email for testing (fake SMTP service)
  if (useEthereal || isDevelopment) {
    try {
      console.log('🔮 Creating Ethereal test account...');
      const testAccount = await nodemailer.createTestAccount();
      
      const etherealTransporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        },
        debug: true, // Enable SMTP debugging
        logger: true // Enable logging
      });

      console.log('✅ Ethereal account created:');
      console.log('User:', testAccount.user);
      console.log('Pass:', testAccount.pass);
      console.log('SMTP Server:', testAccount.smtp);
      console.log('IMAP Server:', testAccount.imap);
      
      return etherealTransporter;
    } catch (error) {
      console.error('❌ Failed to create Ethereal account:', error);
      // Fall back to Gmail
    }
  }

  // Real Gmail SMTP (requires app password)
  console.log('📧 Using Gmail SMTP...');
  console.log('Email User:', process.env.EMAIL_USER ? 'Set' : 'Not Set');
  console.log('Email Password:', process.env.EMAIL_PASSWORD ? 'Set' : 'Not Set');

  // Environment-specific TLS configuration for security
  const getTLSConfig = () => {
    if (isDevelopment || process.env.ALLOW_SELF_SIGNED_CERTS === 'true') {
      console.log('🔓 Development mode: Allowing self-signed certificates');
      console.log('   ⚠️  This setting should NEVER be used in production!');
      console.log('   🔧 Applying aggressive SSL bypass for development...');
      
      return {
        // Core SSL bypass settings
        rejectUnauthorized: false,     // 🔑 Main fix: bypass SSL validation
        requestCert: false,            // Don't request client certificates
        checkServerIdentity: () => {}, // Skip hostname verification with function
        
        // Protocol compatibility options
        ciphers: 'SSLv3',
        secureProtocol: 'TLSv1_method',
        
        // Additional bypass options for stubborn certificates
        ca: [],                        // Empty CA list to bypass certificate chain validation
        key: null,                     // No client key required
        cert: null,                    // No client certificate required
        
        // Timeout settings to prevent hanging on bad SSL
        handshakeTimeout: 30000,       // 30 second SSL handshake timeout
        sessionTimeout: 60000          // 60 second session timeout
      };
    } else {
      console.log('🔒 Production mode: Strict certificate validation enabled');
      return {
        rejectUnauthorized: true,      // Strict certificate validation in production
        minVersion: 'TLSv1.2',        // Ensure modern TLS version
        maxVersion: 'TLSv1.3',
        honorCipherOrder: true,        // Use server cipher preference
        checkServerIdentity: undefined // Use default hostname verification
      };
    }
  };

  const gmailTransporter = nodemailer.createTransport({
    service: 'gmail',
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    },
    debug: isDevelopment, // Enable SMTP debugging in development
    logger: isDevelopment, // Enable detailed logging in development
    tls: getTLSConfig(), // Environment-aware TLS configuration
    // Additional options optimized per environment
    pool: true,
    maxConnections: isDevelopment ? 1 : 5, // More connections in production
    rateDelta: 20000,
    rateLimit: isDevelopment ? 5 : 10, // Higher rate limit in production
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000
  } as any); // Type assertion to fix TypeScript compatibility with Gmail service

  return gmailTransporter;
};

// Multer middleware for handling attachments
export const uploadAttachments = uploadMail.array('attachments', 10);

// @desc    Send Email using global SMTP service (OTP credentials)
// @route   POST /api/mail/send  
// @access  Private
export const sendMail = async (req: Request, res: Response): Promise<void> => {
  try {
    const senderId = (req as any).user._id.toString();
    const { recipient, subject, body } = req.body;
    const attachments = (req as any).files || [];

    console.log('\n📧 ===== GLOBAL SMTP EMAIL SEND REQUEST =====');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Sender ID:', senderId);
    console.log('Recipient:', recipient);
    console.log('Subject:', subject);
    console.log('Body Length:', body?.length || 0);
    console.log('Attachment Count:', attachments.length);
    console.log('Using Global SMTP:', process.env.EMAIL_USER);
    console.log('===========================================\n');

    // Validation
    if (!recipient || !subject || !body) {
      console.log('❌ Validation failed: Missing required fields');
      res.status(400).json({
        success: false,
        message: 'Recipient, subject, and body are required'
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipient)) {
      console.log('❌ Validation failed: Invalid email format');
      res.status(400).json({
        success: false,
        message: 'Invalid recipient email address'
      });
      return;
    }

    // Get sender info
    const sender = await User.findById(senderId);
    if (!sender) {
      console.log('❌ Sender not found in database');
      res.status(404).json({
        success: false,
        message: 'Sender not found'
      });
      return;
    }

    console.log('👤 Sender:', `${sender.firstName} ${sender.lastName} (${sender.email})`);

    // Use global SMTP transport (ignore per-user credentials)
    console.log('\n🔧 ===== USING GLOBAL SMTP TRANSPORT =====');
    console.log('✅ Always use EMAIL_USER credentials for all outgoing emails');
    console.log('📧 SMTP User:', process.env.EMAIL_USER);
    console.log('📧 From Address:', process.env.EMAIL_FROM);
    console.log('❌ Ignoring per-user email credentials');
    console.log('===========================================\n');

    // Import and use global SMTP transporter
    const globalTransporter = require('../services/emailService');

    // Prepare attachments for nodemailer
    const mailAttachments = attachments.map((file: any) => ({
      filename: file.originalname,
      path: file.path
    }));

    // Create mail options using global SMTP credentials
    const mailOptions = {
      from: `"${sender.firstName} ${sender.lastName}" <${process.env.EMAIL_FROM}>`,
      to: recipient,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #333; margin: 0;">📧 New Message</h2>
            <p style="color: #666; margin: 5px 0;"><strong>From:</strong> ${sender.firstName} ${sender.lastName} &lt;${sender.email}&gt;</p>
            <p style="color: #666; margin: 5px 0;"><strong>To:</strong> ${recipient}</p>
            <p style="color: #666; margin: 5px 0;"><strong>Subject:</strong> ${subject}</p>
            <p style="color: #666; margin: 5px 0;"><strong>Sent via:</strong> TM Paysage Platform</p>
          </div>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; border: 1px solid #ddd;">
            <h3 style="color: #333; margin-top: 0;">Message:</h3>
            <div style="white-space: pre-wrap; line-height: 1.6; color: #333;">
              ${body.replace(/\n/g, '<br>')}
            </div>
          </div>

          ${attachments.length > 0 ? `
            <div style="margin-top: 20px; padding: 15px; background-color: #e3f2fd; border-radius: 8px;">
              <p style="margin: 0; color: #1976d2; font-weight: bold;">
                📎 ${attachments.length} attachment${attachments.length > 1 ? 's' : ''} included
              </p>
            </div>
          ` : ''}

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 12px;">
            <p>This email was sent via the TM Paysage messaging platform.</p>
            <p>Reply to this email to respond directly to ${sender.firstName} ${sender.lastName}.</p>
            <p>Sent at: ${new Date().toLocaleString()}</p>
          </div>
        </div>
      `,
      text: `
        From: ${sender.firstName} ${sender.lastName} <${sender.email}>
        To: ${recipient}
        Subject: ${subject}
        
        Message:
        ${body}
        
        ${attachments.length > 0 ? `\nAttachments: ${attachments.length} file(s) included` : ''}
        
        ---
        This email was sent via the TM Paysage messaging platform.
        Reply to this email to respond directly to ${sender.firstName} ${sender.lastName}.
      `,
      replyTo: sender.email, // User can reply to the actual sender
      attachments: mailAttachments
    };

    console.log(`📤 Sending email from ${sender.firstName} ${sender.lastName} (${sender.email}) to ${recipient}`);
    console.log(`📋 Subject: ${subject}`);
    console.log(`📧 Using global SMTP: ${process.env.EMAIL_USER}`);

    // Send email using global SMTP transport
    const info = await globalTransporter.sendMail(mailOptions);

    console.log(`✅ Email sent successfully`);
    console.log(`📬 Message ID: ${info.messageId}`);

    // Create conversation record if recipient is in system
    let conversationId: string | undefined;
    const recipientUser = await User.findOne({ email: recipient });
    
    if (recipientUser) {
      console.log('💬 Creating conversation record...');
      let conversation = await Conversation.findOne({
        type: 'direct',
        participants: { $all: [senderId, recipientUser._id], $size: 2 }
      });

      if (!conversation) {
        conversation = new Conversation({
          participants: [senderId, recipientUser._id],
          type: 'direct',
          createdBy: senderId,
          lastActivity: new Date()
        });
        await conversation.save();
      }

      const messageData = {
        conversation: conversation._id,
        sender: senderId,
        content: `📧 Email sent: ${subject}\n\n${body}`,
        type: 'email',
        attachments: attachments.map((file: any) => ({
          fileName: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          url: `/uploads/mail/${file.filename}`
        })),
        metadata: {
          emailTo: recipient,
          emailSubject: subject,
          emailId: info.messageId,
          sentViaGlobalSMTP: true,
          smtpUser: process.env.EMAIL_USER
        }
      };

      const message = new Message(messageData);
      await message.save();

      conversation.lastMessage = message._id as any;
      conversation.lastActivity = new Date();
      await conversation.save();

      conversationId = (conversation._id as any).toString();
    }

    // Return success response
    res.json({
      success: true,
      messageId: info.messageId,
      conversationId: conversationId,
      message: `Email sent successfully to ${recipient}`,
      delivery: 'SMTP',
      smtpUser: process.env.EMAIL_USER,
      sentFrom: `${sender.firstName} ${sender.lastName}`,
      sentTo: recipient,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Failed to send email via global SMTP:', error.message);
    
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to send email. Check server logs for details.',
      troubleshooting: [
        'Verify EMAIL_USER and EMAIL_PASSWORD are set correctly in .env',
        'Make sure you are using an app password for Gmail (not your regular password)',
        'Check your network connection',
        'Ensure 2-factor authentication is enabled and app password is generated'
      ]
    });
  }
};

// @desc    Test email configuration
// @route   GET /api/mail/test-config  
// @access  Private
export const testEmailConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('\n🔧 ===== TESTING EMAIL CONFIGURATION =====');
    
    const transporter = await createTransporter();
    if (!transporter) {
      res.json({
        success: true,
        message: 'Console-only mode active',
        config: {
          mode: 'console-only',
          status: 'active'
        }
      });
      return;
    }

    console.log('🔍 Verifying transporter...');
    await transporter.verify();
    console.log('✅ Email configuration is valid');

    res.json({
      success: true,
      message: 'Email configuration is valid',
      config: {
        service: process.env.USE_ETHEREAL_EMAIL === 'true' ? 'ethereal' : 'gmail',
        user: process.env.EMAIL_USER,
        debug: true,
        verified: true
      }
    });

  } catch (error) {
    console.error('❌ Email configuration test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Email configuration test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// @desc    Send test email
// @route   POST /api/mail/test-send
// @access  Private
export const sendTestEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { recipient } = req.body;
    const userId = (req as any).user.id;

    if (!recipient) {
      res.status(400).json({
        success: false,
        message: 'Recipient email is required'
      });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Create a simple test email request
    const testReq = {
      ...req,
      body: {
        recipient,
        subject: 'Test Email from TM Paysage App',
        body: `Hello!\n\nThis is a test email sent from the TM Paysage messaging system.\n\nSent by: ${user.firstName} ${user.lastName}\nTimestamp: ${new Date().toISOString()}\n\nIf you received this email, the email functionality is working correctly! 🎉`
      },
      files: []
    };

    // Call the main sendMail function
    await sendMail(testReq as any, res);

  } catch (error) {
    console.error('❌ Test email failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test email',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// @desc    Get mail sending history
// @route   GET /api/mail/history
// @access  Private
// @desc    Get email providers and setup instructions
// @route   GET /api/mail/providers
// @access  Private
export const getEmailProviders = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const detectedProvider = detectEmailProvider(user.email);
    
    res.json({
      success: true,
      data: {
        userEmail: user.email,
        detectedProvider,
        providers: EMAIL_PROVIDERS,
        currentConfiguration: user.emailServiceCredentials || null
      }
    });
  } catch (error) {
    console.error('Error getting email providers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get email providers'
    });
  }
};

// @desc    Setup user email credentials
// @route   POST /api/mail/setup-credentials
// @access  Private
export const setupEmailCredentials = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user._id;
    const { emailPassword } = req.body;

    if (!emailPassword) {
      res.status(400).json({
        success: false,
        message: 'Email password is required'
      });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    console.log('\n🔧 ===== SETTING UP EMAIL CREDENTIALS =====');
    console.log('User:', user.email);
    console.log('Provider:', detectEmailProvider(user.email));

    // Set email credentials
    user.setEmailCredentials(emailPassword);
    await user.save();

    // Verify credentials
    const verification = await verifyUserEmailCredentials(user);

    if (!verification.success) {
      // Clear credentials if verification failed
      user.emailServiceCredentials!.hasCredentials = false;
      user.emailServiceCredentials!.emailPassword = '';
      await user.save();

      res.status(400).json({
        success: false,
        message: verification.error,
        error: 'CREDENTIAL_VERIFICATION_FAILED'
      });
      return;
    }

    console.log('✅ Email credentials set up successfully');
    console.log('==========================================\n');

    res.json({
      success: true,
      message: 'Email credentials configured and verified successfully',
      data: {
        provider: verification.provider,
        email: user.email,
        lastVerified: user.emailServiceCredentials!.lastVerified
      }
    });

  } catch (error) {
    console.error('Error setting up email credentials:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to setup email credentials'
    });
  }
};

// @desc    Verify user email credentials
// @route   POST /api/mail/verify-credentials
// @access  Private
export const verifyEmailCredentials = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user._id;
    
    const user = await User.findById(userId).select('+emailServiceCredentials.emailPassword');
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    if (!user.hasValidEmailCredentials()) {
      res.status(400).json({
        success: false,
        message: 'No email credentials configured',
        error: 'NO_CREDENTIALS'
      });
      return;
    }

    console.log('\n🔍 ===== VERIFYING EMAIL CREDENTIALS =====');
    const verification = await verifyUserEmailCredentials(user);

    if (verification.success) {
      res.json({
        success: true,
        message: 'Email credentials verified successfully',
        data: {
          provider: verification.provider,
          email: user.email,
          lastVerified: user.emailServiceCredentials!.lastVerified
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: verification.error,
        error: 'VERIFICATION_FAILED'
      });
    }

  } catch (error) {
    console.error('Error verifying email credentials:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify email credentials'
    });
  }
};

// @desc    Remove user email credentials
// @route   DELETE /api/mail/credentials
// @access  Private
export const removeEmailCredentials = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user._id;
    
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    console.log('\n🗑️ ===== REMOVING EMAIL CREDENTIALS =====');
    console.log('User:', user.email);

    // Clear email credentials
    if (user.emailServiceCredentials) {
      user.emailServiceCredentials.hasCredentials = false;
      user.emailServiceCredentials.emailPassword = '';
      user.emailServiceCredentials.lastVerified = undefined;
    }
    
    await user.save();

    console.log('✅ Email credentials removed successfully');
    console.log('=======================================\n');

    res.json({
      success: true,
      message: 'Email credentials removed successfully'
    });

  } catch (error) {
    console.error('Error removing email credentials:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove email credentials'
    });
  }
};

// Removed duplicate - using enhanced version below

export const getMailHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Find messages of type 'email' sent by the user
    const emails = await Message.find({
      sender: userId,
      type: 'email'
    })
    .populate('sender', 'firstName lastName email')
    .populate({
      path: 'conversation',
      populate: {
        path: 'participants',
        select: 'firstName lastName email'
      }
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit as string));

    const totalEmails = await Message.countDocuments({
      sender: userId,
      type: 'email'
    });

    res.json({
      success: true,
      data: emails,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalEmails,
        pages: Math.ceil(totalEmails / parseInt(limit as string))
      }
    });

  } catch (error) {
    console.error('Error fetching mail history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch mail history'
    });
  }
};

export const getEmailStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    console.log('\n🔧 ===== EMAIL SYSTEM STATUS CHECK =====');
    
    // Check user email credentials
    const hasUserCredentials = user.hasValidEmailCredentials();
    let userEmailStatus = null;
    
    if (hasUserCredentials) {
      const credentialsTest = await verifyUserEmailCredentials(user);
      userEmailStatus = {
        configured: true,
        provider: user.emailServiceCredentials?.provider,
        verified: credentialsTest.success,
        lastVerified: user.emailServiceCredentials?.lastVerified,
        error: credentialsTest.error
      };
    } else {
      userEmailStatus = {
        configured: false,
        provider: null,
        verified: false,
        lastVerified: null,
        error: 'No email credentials configured'
      };
    }

    // Check fallback email service
    const fallbackStatus = await fallbackEmailService.testConnection();
    
    // Overall system status
    const systemStatus = {
      userEmailAvailable: hasUserCredentials && userEmailStatus.verified,
      fallbackAvailable: fallbackStatus.success,
      canSendEmails: (hasUserCredentials && userEmailStatus.verified) || fallbackStatus.success,
      preferredMethod: hasUserCredentials && userEmailStatus.verified ? 'user-credentials' : 'fallback'
    };

    console.log('📊 Email System Status:', systemStatus);

    res.json({
      success: true,
      data: {
        system: systemStatus,
        userEmail: userEmailStatus,
        fallback: fallbackStatus,
        recommendations: {
          shouldConfigureUserEmail: !hasUserCredentials,
          shouldTestConnection: hasUserCredentials && !userEmailStatus.verified,
          fallbackMode: fallbackStatus.mode,
          developmentMode: process.env.NODE_ENV === 'development'
        }
      }
    });

  } catch (error: any) {
    console.error('❌ Email status check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check email status',
      error: error.message
    });
  }
};

// Test fallback email service
export const testFallbackEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { testEmail } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    const targetEmail = testEmail || user.email;

    console.log('\n🧪 ===== TESTING FALLBACK EMAIL SERVICE =====');
    console.log('Target Email:', targetEmail);
    console.log('Requested by:', user.email);

    // Test fallback service
    const result = await fallbackEmailService.sendEmail({
      to: targetEmail,
      subject: 'Test Email - Fallback Service',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #1976d2; margin: 0;">🧪 Fallback Email Service Test</h2>
          </div>
          
          <p>Hello!</p>
          
          <p>This is a test email from the fallback email service.</p>
          
          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3>Test Details:</h3>
            <ul>
              <li><strong>Requested by:</strong> ${user.firstName} ${user.lastName} (${user.email})</li>
              <li><strong>Sent to:</strong> ${targetEmail}</li>
              <li><strong>Service mode:</strong> ${fallbackEmailService.getConfiguration().mode}</li>
              <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
              <li><strong>Environment:</strong> ${process.env.NODE_ENV || 'production'}</li>
            </ul>
          </div>
          
          <p>If you received this email, the fallback service is working correctly!</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
            <p>This is an automated test email from TM Paysage Site Manager.</p>
          </div>
        </div>
      `,
      text: `
        Fallback Email Service Test
        
        This is a test email from the fallback email service.
        
        Test Details:
        - Requested by: ${user.firstName} ${user.lastName} (${user.email})
        - Sent to: ${targetEmail}
        - Service mode: ${fallbackEmailService.getConfiguration().mode}
        - Timestamp: ${new Date().toISOString()}
        - Environment: ${process.env.NODE_ENV || 'production'}
        
        If you received this email, the fallback service is working correctly!
      `,
      type: 'other'
    });

    if (result.success) {
      console.log('✅ Fallback email test successful');
      res.json({
        success: true,
        data: {
          sent: true,
          messageId: result.messageId,
          mode: result.mode,
          sentTo: targetEmail,
          sentBy: user.email,
          message: `Test email sent successfully via fallback service (${result.mode} mode)`,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      console.log('❌ Fallback email test failed:', result.error);
      res.status(400).json({
        success: false,
        message: 'Fallback email test failed',
        error: result.error,
        mode: result.mode
      });
    }

  } catch (error: any) {
    console.error('❌ Fallback email test error:', error);
    res.status(500).json({
      success: false,
      message: 'Test email failed',
      error: error.message
    });
  }
};

// Get comprehensive email configuration info
export const getEmailConfiguration = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    const fallbackConfig = fallbackEmailService.getConfiguration();
    const hasUserCredentials = user.hasValidEmailCredentials();

    res.json({
      success: true,
      data: {
        environment: process.env.NODE_ENV || 'production',
        userEmail: {
          configured: hasUserCredentials,
          provider: user.emailServiceCredentials?.provider || null,
          email: user.email,
          lastVerified: user.emailServiceCredentials?.lastVerified || null
        },
        fallback: {
          enabled: fallbackConfig.enabled,
          mode: fallbackConfig.mode,
          available: fallbackEmailService.isEnabled()
        },
        systemBehavior: {
          primaryMethod: hasUserCredentials ? 'user-credentials' : 'fallback',
          fallbackWhenUserFails: true,
          developmentConsoleMode: process.env.NODE_ENV === 'development' && fallbackConfig.mode === 'console'
        },
        recommendations: {
          configureUserEmail: !hasUserCredentials ? {
            message: 'Configure your email credentials for personalized email sending',
            endpoint: '/api/mail/setup-credentials',
            providers: ['Gmail', 'Outlook', 'Yahoo']
          } : null,
          testConnection: hasUserCredentials ? {
            message: 'Test your email connection',
            endpoint: '/api/mail/verify-credentials'
          } : null,
          testFallback: {
            message: 'Test fallback email service',
            endpoint: '/api/mail/test-fallback'
          }
        }
      }
    });

  } catch (error: any) {
    console.error('❌ Get email configuration failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get email configuration',
      error: error.message
    });
  }
};

// @desc    Diagnose Email Configuration Issues
// @route   POST /api/mail/diagnose
// @access  Private
export const diagnoseEmailConfiguration = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('\n🔧 ===== EMAIL CONFIGURATION DIAGNOSIS =====');
    
    // Get fallback service configuration
    const fallbackConfig = fallbackEmailService.getConfiguration();
    
    // Test fallback service connection
    const connectionTest = await fallbackEmailService.testConnection();
    
    // Check environment variables
    const envCheck = {
      NODE_ENV: process.env.NODE_ENV || 'unknown',
      hasFallbackSMTPHost: !!process.env.FALLBACK_SMTP_HOST,
      hasFallbackSMTPPort: !!process.env.FALLBACK_SMTP_PORT,
      hasFallbackSMTPUser: !!process.env.FALLBACK_SMTP_USER,
      hasFallbackSMTPPass: !!process.env.FALLBACK_SMTP_PASS,
      hasLegacyEmailUser: !!process.env.EMAIL_USER,
      hasLegacyEmailPass: !!process.env.EMAIL_PASSWORD,
      fallbackSMTPHost: process.env.FALLBACK_SMTP_HOST || 'not set',
      fallbackSMTPPort: process.env.FALLBACK_SMTP_PORT || 'not set',
      fallbackSMTPUser: process.env.FALLBACK_SMTP_USER || 'not set'
    };

    // Analyze the issue
    let diagnosis = 'unknown';
    let fixes: string[] = [];
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    if (fallbackConfig.mode === 'console') {
      diagnosis = 'emails_not_being_sent';
      severity = 'critical';
      fixes = [
        'Configure SMTP credentials in your .env file',
        'Add FALLBACK_SMTP_HOST (e.g., smtp.gmail.com)',
        'Add FALLBACK_SMTP_PORT (e.g., 587)',
        'Add FALLBACK_SMTP_USER (your email address)',
        'Add FALLBACK_SMTP_PASS (your app password)',
        'Restart your server after adding credentials',
        'Test again using the /api/mail/test-smtp endpoint'
      ];
    } else if (fallbackConfig.mode === 'smtp' && !connectionTest.details.smtpConnectable) {
      diagnosis = 'smtp_connection_failed';
      severity = 'high';
      fixes = [
        'Verify SMTP credentials are correct',
        'Check if your email provider requires app-specific passwords',
        'Ensure firewall/network allows SMTP connections',
        'For Gmail: Enable 2FA and generate an app password',
        'For Outlook: Use your Microsoft account password or app password',
        'Test SMTP connection manually using a email client'
      ];
    } else if (fallbackConfig.mode === 'smtp' && connectionTest.details.smtpConnectable) {
      diagnosis = 'configuration_working';
      severity = 'low';
      fixes = ['Your email configuration is working correctly!'];
    }

    const result = {
      success: true,
      diagnosis: {
        issue: diagnosis,
        severity,
        summary: diagnosis === 'emails_not_being_sent' 
          ? 'CRITICAL: Emails are only being logged to console, recipients do not receive them'
          : diagnosis === 'smtp_connection_failed'
          ? 'SMTP configured but connection failed - check credentials'
          : 'Email system is configured and working',
        
        fallbackService: {
          enabled: fallbackConfig.enabled,
          mode: fallbackConfig.mode,
          smtpConfigured: !!fallbackConfig.smtp,
          actuallyDelivering: fallbackConfig.mode === 'smtp' && connectionTest.details.smtpConnectable
        },
        
        environment: envCheck,
        
        connectionTest: connectionTest,
        
        fixes,
        
        nextSteps: diagnosis === 'emails_not_being_sent' ? [
          '1. Copy the SMTP configuration from env.example',
          '2. Add your actual SMTP credentials to .env file',
          '3. Restart the server',
          '4. Test using POST /api/mail/test-smtp',
          '5. Try sending an email again'
        ] : diagnosis === 'smtp_connection_failed' ? [
          '1. Verify your email credentials',
          '2. Generate app-specific password if needed',
          '3. Test using POST /api/mail/test-smtp',
          '4. Check firewall/network settings'
        ] : [
          'Your email system is working! Try sending an email.'
        ]
      }
    };

    console.log('📋 Diagnosis Result:', diagnosis);
    console.log('⚠️ Severity:', severity);
    console.log('✅ SMTP Deliverable:', result.diagnosis.fallbackService.actuallyDelivering);
    
    res.json(result);
    
  } catch (error: any) {
    console.error('❌ Email diagnosis failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to diagnose email configuration',
      error: error.message
    });
  }
};

// @desc    Test SMTP Configuration
// @route   POST /api/mail/test-smtp
// @access  Private
export const testSMTPConfiguration = async (req: Request, res: Response): Promise<void> => {
  try {
    const { testEmail } = req.body;
    
    if (!testEmail) {
      res.status(400).json({
        success: false,
        message: 'Test email address is required'
      });
      return;
    }

    console.log('\n📧 ===== TESTING SMTP CONFIGURATION =====');
    console.log('🎯 Test Email:', testEmail);
    
    // Test the fallback service connection
    const connectionTest = await fallbackEmailService.testConnection();
    
    if (!connectionTest.success) {
      res.json({
        success: false,
        message: 'SMTP connection test failed',
        details: connectionTest
      });
      return;
    }

    // Send a test email
    const testResult = await fallbackEmailService.sendEmail({
      to: testEmail,
      subject: '🧪 SMTP Configuration Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1>✅ SMTP Configuration Test</h1>
          </div>
          <div style="background: #f0fdf4; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #16a34a;">
            <h2>🎉 Success!</h2>
            <p>If you received this email, your SMTP configuration is working correctly.</p>
            <p><strong>Test Details:</strong></p>
            <ul>
              <li>✅ SMTP Connection: Successful</li>
              <li>✅ Email Delivery: Working</li>
              <li>✅ Configuration: Valid</li>
            </ul>
            <p>You can now send emails through your application!</p>
            <hr>
            <p style="color: #666; font-size: 12px;">
              Sent at: ${new Date().toLocaleString()}<br>
              Environment: ${process.env.NODE_ENV || 'production'}<br>
              Test ID: ${Date.now()}
            </p>
          </div>
        </div>
      `,
      text: `✅ SMTP Configuration Test Success!\n\nIf you received this email, your SMTP configuration is working correctly.\n\nSent at: ${new Date().toLocaleString()}\nTest ID: ${Date.now()}`,
      type: 'other'
    });

    console.log('📧 Test Result:', testResult);

    res.json({
      success: testResult.success,
      message: testResult.success 
        ? `✅ Test email sent successfully! Check ${testEmail} for the test message.`
        : '❌ Failed to send test email',
      details: {
        messageId: testResult.messageId,
        mode: testResult.mode,
        error: testResult.error,
        connectionTest: connectionTest
      }
    });
    
  } catch (error: any) {
    console.error('❌ SMTP test failed:', error);
    res.status(500).json({
      success: false,
      message: 'SMTP test failed',
      error: error.message
    });
  }
};

// @desc    Test SMTP with User's Gmail Credentials  
// @route   POST /api/mail/test-gmail-smtp
// @access  Private
export const testGmailSMTP = async (req: Request, res: Response): Promise<void> => {
  console.log('\n🧪 ===== GMAIL SMTP TEST =====');
  
  try {
    const testConfig = {
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
      }
    };

    console.log('🔧 Test Config:', {
      service: testConfig.service,
      user: testConfig.auth.user,
      passwordSet: !!testConfig.auth.pass
    });

         const transporter = nodemailer.createTransport(testConfig);
    
    // Test connection
    console.log('🔌 Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified');

    // Send test email
    const testEmail = {
      from: testConfig.auth.user,
      to: testConfig.auth.user, // Send to self
      subject: 'TM Paysage - SMTP Test Email',
      html: `
        <h2>🧪 SMTP Test Email</h2>
        <p>This is a test email to verify Gmail SMTP configuration.</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <p><strong>Server:</strong> ${process.env.NODE_ENV}</p>
        <p><strong>Status:</strong> ✅ Gmail SMTP is working correctly</p>
      `
    };

    console.log('📧 Sending test email...');
    const result = await transporter.sendMail(testEmail);
    
    console.log('✅ Test email sent successfully!');
    console.log('📬 Message ID:', result.messageId);

    res.json({
      success: true,
      message: 'Gmail SMTP test successful',
      data: {
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
        envelope: result.envelope,
        timestamp: new Date().toISOString(),
        testEmail: testConfig.auth.user
      }
    });

  } catch (error: any) {
    console.error('❌ Gmail SMTP test failed:', error);
    
    res.status(500).json({
      success: false,
      message: 'Gmail SMTP test failed',
      error: error.message,
      details: {
        code: error.code,
        errno: error.errno,
        syscall: error.syscall,
        hostname: error.hostname,
        timestamp: new Date().toISOString()
      }
    });
  }

  console.log('===========================\n');
};

// NEW: Comprehensive Email System Test Endpoint
export const testEmailSystem = async (req: Request, res: Response): Promise<void> => {
  console.log('\n🧪 ===== COMPREHENSIVE EMAIL SYSTEM TEST =====');
  
  try {
    const { testEmail } = req.body;
    const emailToTest = testEmail || process.env.EMAIL_USER || 'test@example.com';
    
    console.log('🎯 Test target email:', emailToTest);
    console.log('🕐 Test started at:', new Date().toISOString());
    
    // Step 1: Check environment variables
    console.log('\n📋 Step 1: Environment Variables Check');
    const envCheck = {
      EMAIL_USER: !!process.env.EMAIL_USER,
      EMAIL_PASSWORD: !!process.env.EMAIL_PASSWORD,
      EMAIL_SERVICE: process.env.EMAIL_SERVICE,
      FALLBACK_SMTP_HOST: process.env.FALLBACK_SMTP_HOST,
      FALLBACK_SMTP_USER: !!process.env.FALLBACK_SMTP_USER,
      FALLBACK_SMTP_PASS: !!process.env.FALLBACK_SMTP_PASS
    };
    console.log('Environment Check:', envCheck);
    
    // Step 2: Test email configuration
    console.log('\n🔧 Step 2: Email Configuration Analysis');
         const emailConfig = getEmailConfig();
         console.log('Config Analysis:', {
       hasMainCredentials: emailConfig.hasMainCredentials,
       hasWorkingConfig: emailConfig.hasWorkingConfig,
       mainConfigAvailable: !!emailConfig.mainConfig,
       hasFallbackConfig: !!emailConfig.fallbackConfig
     });
    
    // Step 3: Test fallback service
    console.log('\n📧 Step 3: Fallback Email Service Test');
    const fallbackResult = await fallbackEmailService.sendEmail({
      to: emailToTest,
      subject: `🧪 TM Paysage Email System Test - ${new Date().toISOString()}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2563eb;">🧪 Email System Test</h2>
          <p>This is a comprehensive test of the TM Paysage email system.</p>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3>✅ Test Results:</h3>
            <ul>
              <li>Environment variables: ${envCheck.EMAIL_USER ? '✅ Configured' : '❌ Missing'}</li>
              <li>Email configuration: ${emailConfig.hasWorkingConfig ? '✅ Working' : '❌ Failed'}</li>
                             <li>SMTP delivery: ${!!emailConfig.fallbackConfig ? '✅ Available' : '❌ Not configured'}</li>
            </ul>
          </div>
          
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p><strong>Environment:</strong> ${process.env.NODE_ENV}</p>
          <p><strong>Test Email:</strong> ${emailToTest}</p>
          
          <p style="color: #16a34a; font-weight: bold;">
            If you received this email, your email system is working correctly! 🎉
          </p>
        </div>
      `,
      text: `
        TM Paysage Email System Test
        
        This is a comprehensive test of the email system.
        
        Test Results:
        - Environment variables: ${envCheck.EMAIL_USER ? 'Configured' : 'Missing'}
        - Email configuration: ${emailConfig.hasWorkingConfig ? 'Working' : 'Failed'}
                 - SMTP delivery: ${!!emailConfig.fallbackConfig ? 'Available' : 'Not configured'}
        
        Timestamp: ${new Date().toISOString()}
        Environment: ${process.env.NODE_ENV}
        Test Email: ${emailToTest}
        
        If you received this email, your email system is working correctly!
      `,
      type: 'other'
    });
    
    console.log('📬 Fallback service result:', {
      success: fallbackResult.success,
      mode: fallbackResult.mode,
      messageId: fallbackResult.messageId,
      error: fallbackResult.error
    });
    
         // Compile results
     const testResults = {
       success: fallbackResult.success,
       timestamp: new Date().toISOString(),
       testEmail: emailToTest,
       environmentCheck: envCheck,
                emailConfiguration: {
         hasMainCredentials: emailConfig.hasMainCredentials,
         hasWorkingConfig: emailConfig.hasWorkingConfig,
         mainConfigAvailable: !!emailConfig.mainConfig,
         hasFallbackConfig: !!emailConfig.fallbackConfig
       },
       deliveryTest: {
         success: fallbackResult.success,
         mode: fallbackResult.mode,
         messageId: fallbackResult.messageId,
         error: fallbackResult.error
       },
       recommendations: [] as string[]
     };
    
    // Add recommendations based on results
    if (!envCheck.EMAIL_USER || !envCheck.EMAIL_PASSWORD) {
      testResults.recommendations.push('Configure EMAIL_USER and EMAIL_PASSWORD in .env file');
    }
    
    if (!emailConfig.hasWorkingConfig) {
      testResults.recommendations.push('Set up FALLBACK_SMTP_* variables for email delivery');
    }
    
    if (fallbackResult.mode === 'console') {
      testResults.recommendations.push('Configure SMTP credentials to enable real email delivery (currently console-only)');
    }
    
    if (fallbackResult.success && fallbackResult.mode === 'smtp') {
      testResults.recommendations.push('✅ Email system is working correctly!');
    }
    
    console.log('🏁 Test completed. Success:', testResults.success);
    console.log('==========================================\n');
    
    res.json({
      success: true,
      message: 'Email system test completed',
      data: testResults
    });

  } catch (error: any) {
    console.error('❌ Email system test failed:', error);
    
    res.status(500).json({
      success: false,
      message: 'Email system test failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}; 