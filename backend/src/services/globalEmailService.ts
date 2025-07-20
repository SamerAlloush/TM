import nodemailer from 'nodemailer';

// Global SMTP Transport using EMAIL_USER credentials (same as OTP)
const createGlobalSMTPTransport = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error('❌ EMAIL_USER or EMAIL_PASSWORD not configured in .env');
    return null;
  }

  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    tls: { rejectUnauthorized: false },
  });
};

// Initialize global transporter
export const globalSMTPTransport = createGlobalSMTPTransport();

// Log initialization status
if (globalSMTPTransport) {
  console.log('✅ Global SMTP Transport initialized');
  console.log('📧 Service: Gmail');  
  console.log('📧 User:', process.env.EMAIL_USER);
  console.log('📧 From:', process.env.EMAIL_FROM || process.env.EMAIL_USER);
} else {
  console.log('❌ Global SMTP Transport failed to initialize');
  console.log('💡 Check EMAIL_USER and EMAIL_PASSWORD in .env file');
}

// Unified email sending function
export async function sendUserEmail(options: {
  fromUser: { name: string; email: string };
  toEmail: string;
  subject: string;
  message: string;
  html?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (!globalSMTPTransport) {
      return { 
        success: false, 
        error: 'Global SMTP transport not available - check EMAIL_USER configuration' 
      };
    }

    const { fromUser, toEmail, subject, message, html } = options;

    const mailOptions = {
      from: `"${fromUser.name}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: subject,
      html: html || `<p>${message}</p>`,
      text: message,
      replyTo: fromUser.email // User can reply to the actual sender
    };

    console.log(`📤 Sending email from ${fromUser.name} (${fromUser.email}) to ${toEmail}`);
    console.log(`📋 Subject: ${subject}`);
    console.log(`📧 Using global SMTP: ${process.env.EMAIL_USER}`);

    const info = await globalSMTPTransport.sendMail(mailOptions);

    console.log(`✅ Email sent successfully`);
    console.log(`📬 Message ID: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId
    };

  } catch (error: any) {
    console.error('❌ Failed to send email via global SMTP:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Simple email sending function for system emails
export async function sendSystemEmail(options: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (!globalSMTPTransport) {
      return { 
        success: false, 
        error: 'Global SMTP transport not available - check EMAIL_USER configuration' 
      };
    }

    const mailOptions = {
      from: `"TM Paysage" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text
    };

    const info = await globalSMTPTransport.sendMail(mailOptions);

    console.log(`✅ System email sent to ${options.to}`);
    console.log(`📬 Message ID: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId
    };

  } catch (error: any) {
    console.error('❌ Failed to send system email:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Verify global SMTP connection
export async function verifyGlobalSMTP(): Promise<{ success: boolean; error?: string }> {
  try {
    if (!globalSMTPTransport) {
      return { success: false, error: 'Global SMTP transport not initialized' };
    }

    await globalSMTPTransport.verify();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Get SMTP configuration status
export function getSMTPStatus() {
  return {
    isConfigured: !!globalSMTPTransport,
    service: process.env.EMAIL_SERVICE || 'gmail',
    user: process.env.EMAIL_USER || 'not configured',
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'not configured',
    hasCredentials: !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD)
  };
} 