import nodemailer from 'nodemailer';

// Unified Email Service - Uses EMAIL_USER for all email types
export class UnifiedEmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isInitialized: boolean = false;

  constructor() {
    // Initialize synchronously without awaiting to avoid blocking
    this.initializeTransporter().catch(error => {
      console.error('Failed to initialize email service:', error.message);
    });
  }

  private async initializeTransporter(): Promise<void> {
    try {
      console.log('\n🔧 ===== UNIFIED EMAIL SERVICE INITIALIZATION =====');
      
      // Auto-assign fallback credentials from EMAIL_USER if missing
      this.autoAssignFallbackCredentials();
      
      // Validate EMAIL_USER credentials
      if (!this.hasValidCredentials()) {
        console.log('❌ No valid EMAIL_USER credentials found');
        console.log('💡 Please set EMAIL_USER and EMAIL_PASSWORD in .env file');
        return;
      }

      // Create unified transporter using EMAIL_USER credentials
      this.transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
        tls: { rejectUnauthorized: false }
      });

      // Verify connection
      await this.transporter.verify();
      this.isInitialized = true;
      
      console.log('✅ Unified Email Service initialized successfully');
      console.log('📧 Service: Gmail');
      console.log('📧 SMTP User:', process.env.EMAIL_USER);
      console.log('📧 From Address:', process.env.EMAIL_FROM || process.env.EMAIL_USER);
      console.log('🔄 All emails (OTP + external) will use the same SMTP account');
      console.log('================================================\n');
      
    } catch (error: any) {
      console.error('❌ Unified Email Service initialization failed:', error.message);
      console.log('💡 Check EMAIL_USER and EMAIL_PASSWORD configuration');
      this.isInitialized = false;
    }
  }

  private autoAssignFallbackCredentials(): void {
    if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
      // Use ||= operator equivalent for older Node versions
      process.env.FALLBACK_SMTP_USER = process.env.FALLBACK_SMTP_USER || process.env.EMAIL_USER;
      process.env.FALLBACK_SMTP_PASS = process.env.FALLBACK_SMTP_PASS || process.env.EMAIL_PASSWORD;
      process.env.FALLBACK_SMTP_HOST = process.env.FALLBACK_SMTP_HOST || 'smtp.gmail.com';
      process.env.FALLBACK_SMTP_PORT = process.env.FALLBACK_SMTP_PORT || '587';
      process.env.FALLBACK_SMTP_SECURE = process.env.FALLBACK_SMTP_SECURE || 'false';
      
      console.log('🔧 Auto-assigned fallback SMTP credentials from EMAIL_USER');
    }
  }

  private hasValidCredentials(): boolean {
    return !!(
      process.env.EMAIL_USER &&
      process.env.EMAIL_PASSWORD &&
      process.env.EMAIL_USER.trim() !== '' &&
      process.env.EMAIL_PASSWORD.trim() !== '' &&
      process.env.EMAIL_USER !== 'your-email@gmail.com' &&
      process.env.EMAIL_PASSWORD !== 'your-email-password' &&
      process.env.EMAIL_PASSWORD !== 'your-app-password' &&
      this.isValidEmailFormat(process.env.EMAIL_USER)
    );
  }

  private isValidEmailFormat(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  public async verifyConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.transporter) {
        await this.initializeTransporter();
      }
      
      if (!this.transporter) {
        return { success: false, error: 'SMTP transporter not initialized' };
      }

      await this.transporter.verify();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  public async sendEmail(options: {
    to: string;
    subject: string;
    html?: string;
    text?: string;
    from?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!this.isInitialized || !this.transporter) {
        return { success: false, error: 'Email service not initialized - check EMAIL_USER credentials' };
      }

      const mailOptions = {
        from: options.from || `"TM Paysage" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      console.log(`✅ Email sent successfully to ${options.to}`);
      console.log(`📬 Message ID: ${result.messageId}`);
      
      return { success: true, messageId: result.messageId };
    } catch (error: any) {
      console.error('❌ Failed to send email:', error.message);
      return { success: false, error: error.message };
    }
  }

  public isReady(): boolean {
    return this.isInitialized && this.transporter !== null;
  }

  public getConfiguration() {
    return {
      isInitialized: this.isInitialized,
      hasTransporter: !!this.transporter,
      service: process.env.EMAIL_SERVICE || 'gmail',
      user: process.env.EMAIL_USER,
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      hasCredentials: this.hasValidCredentials()
    };
  }
}

// Export singleton instance
export const unifiedEmailService = new UnifiedEmailService(); 