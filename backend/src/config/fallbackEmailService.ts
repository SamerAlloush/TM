import nodemailer from 'nodemailer';
import { sendOTPEmail, sendWelcomeEmail } from './email';
import { getEmailConfiguration, getFallbackSMTPConfig, getConfigurationSummary } from './emailConfig';

export interface FallbackEmailConfig {
  enabled: boolean;
  mode: 'console' | 'smtp' | 'disabled';
  smtp?: {
  host: string;
  port: number;
  secure: boolean;
    auth?: {
    user: string;
    pass: string;
  };
  };
}

class FallbackEmailService {
  private config: FallbackEmailConfig;
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.config = this.loadConfiguration();
    this.initializeTransporter();
  }

  private loadConfiguration(): FallbackEmailConfig {
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Use centralized email configuration
    const emailConfig = getEmailConfiguration();
    const configSummary = getConfigurationSummary();

    console.log('\n🔍 ===== FALLBACK EMAIL SERVICE CONFIGURATION =====');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Email Config Results:');
    console.log('- hasExplicitFallback:', emailConfig.hasExplicitFallback);
    console.log('- hasMainCredentials:', emailConfig.hasMainCredentials);
    console.log('- hasWorkingConfig:', emailConfig.hasWorkingConfig);
    console.log('- usingDefaults:', emailConfig.usingDefaults);
    console.log('- sameAccount:', configSummary.sameAccount);
    console.log('- fallbackUser:', configSummary.fallbackUser.includes('@') ? `${configSummary.fallbackUser.substring(0, 5)}...@${configSummary.fallbackUser.split('@')[1]}` : configSummary.fallbackUser);
    console.log('- mainUser:', configSummary.mainUser.includes('@') ? `${configSummary.mainUser.substring(0, 5)}...@${configSummary.mainUser.split('@')[1]}` : configSummary.mainUser);

    let mode: 'console' | 'smtp' | 'disabled';
    let enabled: boolean;
    
    // FIXED: Always enable SMTP mode when we have EMAIL_USER credentials
    // This prevents MISSING_EMAIL_CREDENTIALS errors and stops console fallback
    if (emailConfig.hasWorkingConfig && emailConfig.fallbackConfig) {
      mode = 'smtp';
      enabled = true;
      console.log('✅ SMTP credentials available - email service ENABLED');
      console.log('📧 Mode: SMTP');
      
      if (emailConfig.usingDefaults) {
        if (emailConfig.hasMainCredentials && !emailConfig.hasExplicitFallback) {
          console.log('📧 Using main EMAIL_USER/EMAIL_PASSWORD for fallback SMTP (no explicit fallback configured)');
          console.log('🔄 Both OTP and external emails will use the same Gmail account');
        } else {
          console.log('🌐 Using global fallback SMTP as default - enabling external email delivery for all users');
          console.log('🔄 Both OTP and external emails will use the global fallback SMTP account');
        }
      } else {
        console.log('🔧 Using explicit fallback SMTP configuration');
      }
    } else {
      // IMPORTANT: Only disable if absolutely no SMTP credentials are available
      mode = 'disabled';
      enabled = false;
      console.log('❌ No SMTP credentials available - email service DISABLED');
      console.log('💡 Configure EMAIL_USER/EMAIL_PASSWORD or FALLBACK_SMTP_* variables to enable email delivery');
      console.log('🚨 Users will get MISSING_EMAIL_CREDENTIALS errors when trying to send emails');
    }

    console.log('🔧 Final Configuration:');
    console.log('- enabled:', enabled);
    console.log('- mode:', mode);
    console.log('- smtp host:', emailConfig.fallbackConfig?.host || 'none');
    console.log('- smtp user:', emailConfig.fallbackConfig?.auth?.user || 'none');
    console.log('================================================\n');

    return {
      enabled,
      mode,
      smtp: emailConfig.fallbackConfig || undefined
    };
  }

  private async initializeTransporter(): Promise<void> {
    if (this.config.mode === 'smtp' && this.config.smtp) {
      try {
        // Create transporter using the exact format requested by the user
        this.transporter = nodemailer.createTransport({
          service: process.env.EMAIL_SERVICE || 'gmail',
          auth: {
            user: process.env.FALLBACK_SMTP_USER || process.env.EMAIL_USER,
            pass: process.env.FALLBACK_SMTP_PASS || process.env.EMAIL_PASSWORD,
          },
          tls: { rejectUnauthorized: false }
        });

        // Test the connection
        if (this.transporter) {
          await this.transporter.verify();
        }
        console.log('✅ Fallback email service initialized successfully with SMTP');
        console.log(`📧 Using SMTP: ${this.config.smtp.auth?.user} via ${this.config.smtp.host}:${this.config.smtp.port}`);
      } catch (error) {
        console.warn('⚠️ Fallback email service failed to initialize SMTP connection:', error);
        console.log('🔧 SMTP credentials are configured but connection failed');
        console.log('💡 Check SMTP settings and network connectivity');
        // Keep SMTP mode but mark as failed - don't fall back to console
        // This will cause email attempts to fail with proper error messages
        this.config.enabled = false;
        console.error('❌ Email service disabled - SMTP connection failed');
      }
    }
  }

  public async sendEmail(options: {
    to: string;
    subject: string;
    html?: string;
    text?: string;
    type?: 'otp' | 'welcome' | 'notification' | 'other';
    userFirstName?: string;
    otpCode?: string;
    fromUser?: { name: string; email: string };
  }): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
    mode: string;
  }> {
    const { to, subject, html, text, type, userFirstName, otpCode, fromUser } = options;

    console.log('\n🔧 ===== FALLBACK EMAIL SERVICE =====');
    console.log('📧 To:', to);
    console.log('📋 Subject:', subject);
    console.log('📂 Type:', type || 'other');
    console.log('⚙️ Mode:', this.config.mode);
    console.log('✅ Enabled:', this.config.enabled);

    if (!this.config.enabled) {
      console.log('❌ Fallback email service is disabled - check EMAIL_USER/EMAIL_PASSWORD configuration');
      return {
        success: false,
        error: 'Email service credentials not configured',
        mode: 'disabled'
      };
    }

    // Handle specific email types with enhanced templates
    if (type === 'otp' && userFirstName && otpCode) {
      console.log('🔐 Sending OTP email via fallback service...');
      return await this.sendOTPViaBestMethod(to, otpCode, userFirstName);
    }

    if (type === 'welcome' && userFirstName) {
      console.log('🎉 Sending welcome email via fallback service...');
      return await this.sendWelcomeViaBestMethod(to, userFirstName);
    }

    // Handle generic email - ALWAYS use SMTP when enabled (no more console fallback)
    switch (this.config.mode) {
      case 'smtp':
        return await this.sendViaSMTP(to, subject, html, text, fromUser);
      
      case 'console':
        // This should not happen anymore with proper EMAIL_USER configuration
        console.warn('⚠️ Console mode detected - this indicates missing EMAIL_USER credentials');
        return this.sendViaConsole(to, subject, text || html || '', type);
      
      default:
        return {
          success: false,
          error: 'No email method available',
          mode: this.config.mode
        };
    }
  }

  private async sendOTPViaBestMethod(email: string, otp: string, firstName: string): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
    mode: string;
  }> {
    if (this.config.mode === 'smtp') {
      // Try to use the original OTP email function
      try {
        const success = await sendOTPEmail(email, otp, firstName);
        if (success) {
          return {
            success: true,
            mode: 'smtp-original',
            messageId: `otp-${Date.now()}`
          };
        }
      } catch (error) {
        console.warn('⚠️ Original OTP email failed, using fallback SMTP...');
      }

      // Use fallback SMTP
      return await this.sendViaSMTP(
        email,
        'Account Verification - OTP Code',
        this.generateOTPEmailHTML(firstName, otp),
        `Your OTP code is: ${otp}`,
        undefined
      );
    }

    // Console mode
    return this.sendViaConsole(email, 'OTP Verification', `OTP Code: ${otp}`, 'otp');
  }

  private async sendWelcomeViaBestMethod(email: string, firstName: string): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
    mode: string;
  }> {
    if (this.config.mode === 'smtp') {
      // Try to use the original welcome email function
      try {
        const success = await sendWelcomeEmail(email, firstName, '');
        if (success) {
          return {
            success: true,
            mode: 'smtp-original',
            messageId: `welcome-${Date.now()}`
          };
        }
      } catch (error) {
        console.warn('⚠️ Original welcome email failed, using fallback SMTP...');
      }

      // Use fallback SMTP
      return await this.sendViaSMTP(
        email,
        'Welcome to TM Paysage!',
        this.generateWelcomeEmailHTML(firstName),
        `Welcome ${firstName}! Your account has been successfully created.`,
        undefined
      );
    }

    // Console mode
    return this.sendViaConsole(email, 'Welcome!', `Welcome ${firstName}!`, 'welcome');
  }

  private sendViaConsole(to: string, subject: string, content: string, type?: string): {
    success: boolean;
    messageId: string;
    mode: string;
  } {
    const border = '═'.repeat(60);
    const timestamp = new Date().toLocaleString();
    
    console.log(`\n╔${border}╗`);
    console.log(`║ 📧 FALLBACK EMAIL (Console Mode) ${' '.repeat(20)}║`);
    console.log(`╠${border}╣`);
    console.log(`║ 📧 To: ${to.padEnd(50)} ║`);
    console.log(`║ 📋 Subject: ${subject.padEnd(45)} ║`);
    console.log(`║ 📂 Type: ${(type || 'generic').padEnd(48)} ║`);
    console.log(`║ ⏰ Time: ${timestamp.padEnd(47)} ║`);
    console.log(`╠${border}╣`);
    console.log(`║ 📄 CONTENT:${' '.repeat(46)} ║`);
    
    // Split content into lines and format
    const lines = content.split('\n').slice(0, 10); // Limit to 10 lines
    lines.forEach(line => {
      const truncated = line.substring(0, 54);
      console.log(`║ ${truncated.padEnd(56)} ║`);
    });
    
    if (content.split('\n').length > 10) {
      console.log(`║ ... (truncated)${' '.repeat(42)} ║`);
    }
    
    console.log(`╚${border}╝\n`);

        return {
      success: true,
      messageId: `console-${Date.now()}`,
      mode: 'console'
    };
  }

  private async sendViaSMTP(to: string, subject: string, html?: string, text?: string, fromUser?: { name: string; email: string }): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
    mode: string;
  }> {
    if (!this.transporter) {
      return {
        success: false,
        error: 'SMTP transporter not initialized',
        mode: 'smtp'
      };
    }

    try {
      // Use proper email configuration as specified
      const fromEmail = process.env.EMAIL_FROM || 'noreply@tm-paysage.com';
      const replyToEmail = fromUser?.email || process.env.EMAIL_FROM || 'noreply@tm-paysage.com';
      
      const result = await this.transporter.sendMail({
        from: `"TM Paysage" <${fromEmail}>`,
        to,
        replyTo: replyToEmail,
        subject: subject,
        html: html || text,
        text: text || html?.replace(/<[^>]*>/g, '') // Strip HTML for text
      });

      console.log('✅ Email sent via SMTP:', {
        messageId: result.messageId,
        from: fromEmail,
        replyTo: replyToEmail,
        to: to
      });

      return {
        success: true,
        messageId: result.messageId,
        mode: 'smtp'
      };
    } catch (error: any) {
      console.error('❌ SMTP failed:', error.message);
      
      // In development, fall back to console
      if (process.env.NODE_ENV === 'development') {
        console.log('📝 Falling back to console mode...');
        return this.sendViaConsole(to, subject, text || html || '', 'fallback');
      }

      return {
        success: false,
        error: error.message,
        mode: 'smtp'
      };
    }
  }

  private generateOTPEmailHTML(firstName: string, otp: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>OTP Verification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
          .otp-code { background: #fff; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px; border: 2px dashed #2563eb; }
          .otp-number { font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 8px; }
          .fallback-notice { background: #fef3cd; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; margin: 20px 0; color: #92400e; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏗️ TM Paysage</h1>
            <h2>Account Verification</h2>
          </div>
          <div class="content">
            <div class="fallback-notice">
              <strong>🔧 Notice:</strong> This email was sent via fallback service.
            </div>
            <h3>Hello ${firstName}!</h3>
            <p>Your verification code:</p>
            <div class="otp-code">
              <div class="otp-number">${otp}</div>
            </div>
            <p>This code expires in 10 minutes.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateWelcomeEmailHTML(firstName: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
          .fallback-notice { background: #fef3cd; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; margin: 20px 0; color: #92400e; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏗️ TM Paysage</h1>
            <h2>Welcome!</h2>
          </div>
          <div class="content">
            <div class="fallback-notice">
              <strong>🔧 Notice:</strong> This email was sent via fallback service.
            </div>
            <h3>Welcome ${firstName}!</h3>
            <p>Your account has been successfully created and verified.</p>
            <p>You can now log in and start using the platform.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  public getConfiguration(): FallbackEmailConfig {
    return { ...this.config };
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  public async testConnection(): Promise<{
    success: boolean;
    mode: string;
    details: any;
  }> {
    console.log('\n🔧 ===== TESTING FALLBACK EMAIL SERVICE =====');
    
    const result = {
      success: this.config.enabled,
      mode: this.config.mode,
      details: {
        enabled: this.config.enabled,
        mode: this.config.mode,
        smtpConfigured: !!this.config.smtp,
        transporterReady: !!this.transporter,
        smtpConnectable: undefined as boolean | undefined,
        smtpError: undefined as string | undefined
      }
    };

    if (this.config.mode === 'smtp' && this.transporter) {
      try {
        await this.transporter.verify();
        result.details.smtpConnectable = true;
        console.log('✅ Fallback SMTP connection verified');
      } catch (error) {
        result.details.smtpConnectable = false;
        result.details.smtpError = (error as Error).message;
        console.log('❌ Fallback SMTP connection failed:', (error as Error).message);
      }
    }

    console.log('📊 Test results:', result);
    return result;
  }
}

export default new FallbackEmailService(); 