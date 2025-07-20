import nodemailer from 'nodemailer';
import { IUser } from '../models/User';

export interface EmailServiceConfig {
  host: string;
  port: number;
  secure: boolean;
  service?: string;
  auth: {
    user: string;
    pass: string;
  };
  tls?: any;
  debug?: boolean;
  logger?: boolean;
}

export interface EmailProvider {
  name: string;
  displayName: string;
  domains: string[];
  smtpConfig: Omit<EmailServiceConfig, 'auth'>;
  instructions: {
    appPasswordRequired: boolean;
    appPasswordUrl?: string;
    setupSteps: string[];
  };
}

// Email provider configurations
export const EMAIL_PROVIDERS: Record<string, EmailProvider> = {
  gmail: {
    name: 'gmail',
    displayName: 'Gmail',
    domains: ['gmail.com'],
    smtpConfig: {
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      tls: {
        rejectUnauthorized: false,
        requestCert: false,
        checkServerIdentity: () => {}, // Skip hostname verification
        ciphers: 'SSLv3',
        secureProtocol: 'TLSv1_method',
        ca: [],
        handshakeTimeout: 30000,
        sessionTimeout: 60000
      },
      debug: process.env.NODE_ENV === 'development',
      logger: process.env.NODE_ENV === 'development'
    },
    instructions: {
      appPasswordRequired: true,
      appPasswordUrl: 'https://myaccount.google.com/apppasswords',
      setupSteps: [
        'Enable 2-Step Verification on your Google Account',
        'Go to Google Account settings → Security → App passwords',
        'Generate an app password for "Mail"',
        'Use the 16-character app password (not your regular password)'
      ]
    }
  },
  
  outlook: {
    name: 'outlook',
    displayName: 'Outlook/Hotmail',
    domains: ['outlook.com', 'hotmail.com', 'live.com'],
    smtpConfig: {
      host: 'smtp.live.com',
      port: 587,
      secure: false,
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false,
        requestCert: false,
        checkServerIdentity: () => {},
        handshakeTimeout: 30000,
        sessionTimeout: 60000
      },
      debug: process.env.NODE_ENV === 'development',
      logger: process.env.NODE_ENV === 'development'
    },
    instructions: {
      appPasswordRequired: true,
      appPasswordUrl: 'https://account.microsoft.com/security',
      setupSteps: [
        'Enable 2-Step Verification on your Microsoft Account',
        'Go to Microsoft Account → Security → Advanced security options',
        'Generate an app password for email applications',
        'Use the generated app password instead of your regular password'
      ]
    }
  },
  
  yahoo: {
    name: 'yahoo',
    displayName: 'Yahoo Mail',
    domains: ['yahoo.com', 'yahoo.co.uk', 'yahoo.fr', 'ymail.com'],
    smtpConfig: {
      host: 'smtp.mail.yahoo.com',
      port: 587,
      secure: false,
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false,
        requestCert: false,
        checkServerIdentity: () => {},
        handshakeTimeout: 30000,
        sessionTimeout: 60000
      },
      debug: process.env.NODE_ENV === 'development',
      logger: process.env.NODE_ENV === 'development'
    },
    instructions: {
      appPasswordRequired: true,
      appPasswordUrl: 'https://login.yahoo.com/account/security',
      setupSteps: [
        'Enable 2-Step Verification on your Yahoo Account',
        'Go to Yahoo Account → Security → Generate app password',
        'Create an app password for "Mail"',
        'Use the generated app password for SMTP authentication'
      ]
    }
  }
};

/**
 * Detect email provider from email address
 */
export const detectEmailProvider = (email: string): string => {
  const domain = email.split('@')[1]?.toLowerCase();
  
  for (const [providerKey, provider] of Object.entries(EMAIL_PROVIDERS)) {
    if (provider.domains.includes(domain)) {
      return providerKey;
    }
  }
  
  return 'other';
};

/**
 * Get email service configuration for a provider
 */
export const getEmailServiceConfig = (providerKey: string): EmailProvider | null => {
  return EMAIL_PROVIDERS[providerKey] || null;
};

/**
 * Create nodemailer transporter for user's email service
 */
export const createUserEmailTransporter = async (user: IUser): Promise<nodemailer.Transporter | null> => {
  try {
    console.log('\n🔧 ===== CREATING USER EMAIL TRANSPORTER =====');
    console.log('User:', user.email);
    console.log('Provider:', user.emailServiceCredentials?.provider);
    console.log('Has Credentials:', user.hasValidEmailCredentials());
    
    // Check if user has email credentials
    if (!user.hasValidEmailCredentials()) {
      console.log('❌ User has no valid email credentials');
      return null;
    }

    const providerKey = user.emailServiceCredentials!.provider;
    const provider = getEmailServiceConfig(providerKey);
    
    if (!provider) {
      console.log(`❌ Unsupported email provider: ${providerKey}`);
      return null;
    }

    const emailPassword = user.getEmailCredentials();
    if (!emailPassword) {
      console.log('❌ Failed to decrypt user email credentials');
      return null;
    }

    // Create transporter configuration
    const transporterConfig: EmailServiceConfig = {
      ...provider.smtpConfig,
      auth: {
        user: user.email,
        pass: emailPassword
      }
    };

    console.log('🔧 Transporter Config:', {
      service: transporterConfig.service,
      host: transporterConfig.host,
      port: transporterConfig.port,
      secure: transporterConfig.secure,
      user: transporterConfig.auth.user,
      passwordSet: !!transporterConfig.auth.pass,
      provider: provider.displayName
    });

    const transporter = nodemailer.createTransport(transporterConfig);
    
    console.log('✅ Transporter created successfully');
    console.log('=============================================\n');
    
    return transporter;
    
  } catch (error) {
    console.error('❌ Failed to create user email transporter:', error);
    return null;
  }
};

/**
 * Verify user's email credentials
 */
export const verifyUserEmailCredentials = async (user: IUser): Promise<{
  success: boolean;
  error?: string;
  provider?: string;
}> => {
  try {
    console.log('\n🔍 ===== VERIFYING USER EMAIL CREDENTIALS =====');
    console.log('User:', user.email);
    
    const transporter = await createUserEmailTransporter(user);
    
    if (!transporter) {
      return {
        success: false,
        error: 'Failed to create email transporter - check credentials'
      };
    }

    console.log('🔍 Attempting SMTP verification...');
    await transporter.verify();
    
    console.log('✅ Email credentials verified successfully');
    console.log('===============================================\n');
    
    // Update last verified timestamp
    user.emailServiceCredentials!.lastVerified = new Date();
    await user.save();
    
    return {
      success: true,
      provider: user.emailServiceCredentials!.provider
    };
    
  } catch (error: any) {
    console.error('❌ Email credential verification failed:', error.message);
    console.error('===============================================\n');
    
    let errorMessage = 'Email credential verification failed';
    
    if (error.message.includes('Invalid login')) {
      errorMessage = 'Invalid email or password. For Gmail/Outlook/Yahoo, use an App Password instead of your regular password.';
    } else if (error.message.includes('authentication')) {
      errorMessage = 'Authentication failed. Please check your email password and ensure 2-step verification is enabled.';
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      errorMessage = 'Connection failed. Please check your internet connection and try again.';
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
};

/**
 * Send email using user's own email service
 */
export const sendEmailViaUserService = async (
  user: IUser,
  mailOptions: {
    to: string;
    subject: string;
    html?: string;
    text?: string;
    attachments?: any[];
  }
): Promise<{
  success: boolean;
  messageId?: string;
  response?: string;
  error?: string;
}> => {
  try {
    console.log('\n📤 ===== SENDING EMAIL VIA USER SERVICE =====');
    console.log('From User:', user.email);
    console.log('To:', mailOptions.to);
    console.log('Subject:', mailOptions.subject);
    
    const transporter = await createUserEmailTransporter(user);
    
    if (!transporter) {
      return {
        success: false,
        error: 'Failed to create email transporter. Please verify your email credentials.'
      };
    }

    // Prepare final mail options with user as sender
    const finalMailOptions = {
      from: {
        name: `${user.firstName} ${user.lastName}`,
        address: user.email
      },
      to: mailOptions.to,
      subject: mailOptions.subject,
      html: mailOptions.html,
      text: mailOptions.text,
      attachments: mailOptions.attachments || [],
      replyTo: user.email
    };

    console.log('📧 Final mail options:', {
      from: finalMailOptions.from,
      to: finalMailOptions.to,
      subject: finalMailOptions.subject,
      attachments: finalMailOptions.attachments.length
    });

    const result = await transporter.sendMail(finalMailOptions);
    
    console.log('\n✅ ===== EMAIL SENT SUCCESSFULLY =====');
    console.log('Message ID:', result.messageId);
    console.log('Response:', result.response);
    console.log('Accepted:', result.accepted);
    console.log('Rejected:', result.rejected);
    console.log('====================================\n');
    
    return {
      success: true,
      messageId: result.messageId,
      response: result.response
    };
    
  } catch (error: any) {
    console.error('\n❌ ===== EMAIL SEND FAILED =====');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    console.error('==============================\n');
    
    let errorMessage = 'Failed to send email';
    
    if (error.message.includes('Invalid login')) {
      errorMessage = 'Email authentication failed. Please check your email credentials.';
    } else if (error.code === 'EMESSAGE') {
      errorMessage = 'Invalid email message format. Please check recipient email address.';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Connection failed. Please check your internet connection.';
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
}; 