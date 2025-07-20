import nodemailer from 'nodemailer';

// Email transporter configuration with SSL/TLS fixes
const createTransporter = async () => {
  try {
    // For development - using Gmail SMTP with SSL/TLS fixes
    return nodemailer.createTransport({
      service: 'gmail',
      secure: false, // Use TLS instead of SSL
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      },
      tls: {
        rejectUnauthorized: false // Ignore self-signed certificates in development
      },
      // Additional options for better reliability
      pool: true,
      maxConnections: 1,
      rateDelta: 20000,
      rateLimit: 5
    });
  } catch (error) {
    console.error('Failed to create email transporter:', error);
    // Fallback transporter with even more relaxed settings
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      },
      tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3'
      },
      connectionTimeout: 60000,
      greetingTimeout: 30000,
      socketTimeout: 60000
    });
  }
};

// Send OTP email with enhanced development mode
export const sendOTPEmail = async (email: string, otp: string, firstName: string): Promise<boolean> => {
  // Enhanced development mode logging
  if (process.env.NODE_ENV === 'development') {
    console.log('\n🔐 ===== OTP VERIFICATION CODE ===== 🔐');
    console.log('=======================================');
    console.log(`📧 Email: ${email}`);
    console.log(`👤 Name: ${firstName}`);
    console.log(`🔢 OTP Code: ${otp}`);
    console.log(`⏰ Expires: 10 minutes`);
    console.log(`🔄 Attempts: 3 maximum`);
    console.log('=======================================\n');
    
    // If no real email credentials configured, use console-only mode
    if (!process.env.EMAIL_USER || 
        !process.env.EMAIL_PASSWORD || 
        process.env.EMAIL_USER === 'your-email@gmail.com' ||
        process.env.EMAIL_PASSWORD === 'your-app-password') {
      console.log('📝 Email credentials not configured - using console-only mode for testing');
      console.log('✅ OTP generated successfully (check console for code)');
      return true;
    }
  }

  try {
    const transporter = await createTransporter();

    // Verify transporter configuration
    await transporter.verify();

    const mailOptions = {
      from: {
        name: 'TM Paysage',
        address: process.env.EMAIL_USER || 'noreply@gsconstruction.com'
      },
      to: email,
      subject: 'Account Verification - OTP Code',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Account Verification</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
            .otp-code { background: #fff; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px; border: 2px dashed #2563eb; }
            .otp-number { font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 8px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
            .warning { background: #fef3cd; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; margin: 20px 0; color: #92400e; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏗️ TM Paysage</h1>
              <h2>Account Verification</h2>
            </div>
            <div class="content">
              <h3>Hello ${firstName}!</h3>
              <p>Thank you for registering with TM Paysage Site Manager. To complete your account creation, please verify your email address using the OTP code below:</p>
              
              <div class="otp-code">
                <p style="margin: 0; font-size: 18px; color: #666;">Your Verification Code:</p>
                <div class="otp-number">${otp}</div>
              </div>

              <div class="warning">
                <strong>⚠️ Important:</strong>
                <ul style="margin: 10px 0;">
                  <li>This code will expire in <strong>10 minutes</strong></li>
                  <li>You have <strong>3 attempts</strong> to enter the correct code</li>
                  <li>Do not share this code with anyone</li>
                </ul>
              </div>

              <p>If you didn't request this verification, please ignore this email or contact our support team.</p>
              
              <div class="footer">
                <p>Best regards,<br>TM Paysage Team</p>
                <p style="font-size: 12px; color: #999;">This is an automated message, please do not reply to this email.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ OTP email sent successfully to ${email}`);
    return true;
  } catch (error: any) {
    console.error('❌ Failed to send OTP email:', error);
    
    // In development, if email fails but we have the OTP, still allow registration
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 Development mode: Email failed but OTP logged to console');
      return true;
    }
    
    return false;
  }
};

// Send welcome email after successful verification
export const sendWelcomeEmail = async (email: string, firstName: string, lastName: string): Promise<boolean> => {
  // Skip welcome email in development if no real credentials
  if (process.env.NODE_ENV === 'development' && 
      (!process.env.EMAIL_USER || process.env.EMAIL_USER === 'your-email@gmail.com')) {
    console.log(`🎉 Welcome ${firstName} ${lastName}! Account created successfully.`);
    return true;
  }

  try {
    const transporter = await createTransporter();

    const mailOptions = {
      from: {
        name: 'TM Paysage',
        address: process.env.EMAIL_USER || 'noreply@gsconstruction.com'
      },
      to: email,
      subject: 'Welcome to TM Paysage Site Manager!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome to TM Paysage</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
            .success-icon { font-size: 48px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏗️ TM Paysage</h1>
              <div class="success-icon">✅</div>
              <h2>Account Successfully Created!</h2>
            </div>
            <div class="content">
              <h3>Welcome ${firstName} ${lastName}!</h3>
              <p>Your account has been successfully verified and created. You can now log in to the TM Paysage Site Manager platform and start managing your construction projects.</p>
              
              <h4>🚀 What's next?</h4>
              <ul>
                <li>Log in to your account using your email and password</li>
                <li>Complete your profile information</li>
                <li>Explore the platform features</li>
                <li>Start managing your construction sites and tasks</li>
              </ul>

              <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
              
              <div class="footer">
                <p>Best regards,<br>TM Paysage Team</p>
                <p style="font-size: 12px; color: #999;">This is an automated message, please do not reply to this email.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Welcome email sent successfully to ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send welcome email:', error);
    // Don't fail the registration if welcome email fails
    return true;
  }
};

// Health check function for email service
export const testEmailConnection = async (): Promise<boolean> => {
  try {
    if (!process.env.EMAIL_USER || process.env.EMAIL_USER === 'your-email@gmail.com') {
      console.log('📧 Email service: Console-only mode (no credentials configured)');
      return true;
    }

    const transporter = await createTransporter();
    await transporter.verify();
    console.log('📧 Email service: Connected successfully');
    return true;
  } catch (error) {
    console.error('📧 Email service: Connection failed:', error);
    return false;
  }
}; 