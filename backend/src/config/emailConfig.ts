/**
 * Centralized Email Configuration Module
 * Handles defaulting fallback SMTP settings to main email credentials when not explicitly configured
 */

export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export interface EmailConfigResult {
  hasExplicitFallback: boolean;
  hasMainCredentials: boolean;
  hasWorkingConfig: boolean;
  fallbackConfig: SMTPConfig | null;
  mainConfig: SMTPConfig | null;
  usingDefaults: boolean;
}

/**
 * Auto-assign FALLBACK_SMTP variables from EMAIL_USER credentials if missing
 * This ensures the system works with just EMAIL_USER/EMAIL_PASSWORD configuration
 */
function autoAssignFallbackCredentials(): void {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    // Auto-assign fallback SMTP variables if not explicitly set
    if (!process.env.FALLBACK_SMTP_HOST) {
      process.env.FALLBACK_SMTP_HOST = 'smtp.gmail.com';
    }
    if (!process.env.FALLBACK_SMTP_PORT) {
      process.env.FALLBACK_SMTP_PORT = '587';
    }
    if (!process.env.FALLBACK_SMTP_USER) {
      process.env.FALLBACK_SMTP_USER = process.env.EMAIL_USER;
    }
    if (!process.env.FALLBACK_SMTP_PASS) {
      process.env.FALLBACK_SMTP_PASS = process.env.EMAIL_PASSWORD;
    }
    if (!process.env.FALLBACK_SMTP_SECURE) {
      process.env.FALLBACK_SMTP_SECURE = 'false';
    }
    
    console.log('🔧 Auto-assigned fallback SMTP credentials from EMAIL_USER');
  }
}

/**
 * Check if we're in test environment and should force unified configuration
 * Only applies when explicitly requesting test mode email unification
 */
function shouldForceUnifiedConfig(): boolean {
  return process.env.FORCE_UNIFIED_EMAIL_CONFIG === 'true' ||
         (process.env.NODE_ENV === 'test' && process.env.EMAIL_TEST_MODE === 'unified');
}

/**
 * Get email configuration with global fallback SMTP support
 * Enhanced with test environment support and global fallback for users without personal credentials
 */
export function getEmailConfiguration(): EmailConfigResult {
  const shouldForceUnified = shouldForceUnifiedConfig();
  
  console.log('\n🔧 ===== EMAIL CONFIG ANALYSIS =====');
  
  // First, auto-assign fallback credentials if needed
  autoAssignFallbackCredentials();
  
  // Check if explicit fallback SMTP is configured as global default
  const hasExplicitFallback = !!(
    process.env.FALLBACK_SMTP_HOST &&
    process.env.FALLBACK_SMTP_PORT &&
    process.env.FALLBACK_SMTP_USER &&
    process.env.FALLBACK_SMTP_PASS
  );

  // Validate email format (more lenient for development)
  const isValidEmailFormat = (email: string): boolean => {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Check main EMAIL_USER credentials with proper validation
  const hasUserCredentials = !!(
    process.env.EMAIL_USER &&
    process.env.EMAIL_PASSWORD &&
    process.env.EMAIL_USER.trim() !== '' &&
    process.env.EMAIL_PASSWORD.trim() !== '' &&
    process.env.EMAIL_USER !== 'your-email@gmail.com' &&
    process.env.EMAIL_PASSWORD !== 'your-email-password' &&
    process.env.EMAIL_PASSWORD !== 'your-app-password' &&
    isValidEmailFormat(process.env.EMAIL_USER)
  );

  // Check fallback SMTP credentials with proper validation
  const hasValidFallbackCredentials = hasExplicitFallback && 
    process.env.FALLBACK_SMTP_USER !== 'your-email@gmail.com' &&
    process.env.FALLBACK_SMTP_PASS !== 'your-email-password' &&
    process.env.FALLBACK_SMTP_PASS !== 'your-app-password' &&
    process.env.FALLBACK_SMTP_USER!.trim() !== '' &&
    process.env.FALLBACK_SMTP_PASS!.trim() !== '' &&
    isValidEmailFormat(process.env.FALLBACK_SMTP_USER!);

  console.log('📧 EMAIL_USER credentials:', hasUserCredentials ? '✅ Valid' : '❌ Missing/Invalid');
  console.log('📧 FALLBACK_SMTP credentials:', hasValidFallbackCredentials ? '✅ Valid' : '❌ Missing/Invalid');

  // PRIORITY: Use EMAIL_USER credentials when available
  const hasMainCredentials = hasUserCredentials || hasValidFallbackCredentials;

  // Use EMAIL_USER credentials as primary source
  let mainHost: string, mainPort: string, mainUser: string, mainPass: string;
  let fallbackHost: string, fallbackPort: string, fallbackUser: string, fallbackPass: string;
  let fallbackSecure: boolean;

  if (hasUserCredentials) {
    // Use EMAIL_USER credentials for main configuration
    console.log('🔧 Using EMAIL_USER credentials for main config');
    mainHost = process.env.EMAIL_SERVICE === 'gmail' ? 'smtp.gmail.com' : 'smtp.gmail.com';
    mainPort = '587';
    mainUser = process.env.EMAIL_USER!;
    mainPass = process.env.EMAIL_PASSWORD!;
    
    // For fallback: use auto-assigned or explicit fallback credentials
    if (hasValidFallbackCredentials && !shouldForceUnified) {
      console.log('🔧 Using explicit FALLBACK_SMTP for fallback config');
      fallbackHost = process.env.FALLBACK_SMTP_HOST!;
      fallbackPort = process.env.FALLBACK_SMTP_PORT!;
      fallbackUser = process.env.FALLBACK_SMTP_USER!;
      fallbackPass = process.env.FALLBACK_SMTP_PASS!;
      fallbackSecure = process.env.FALLBACK_SMTP_SECURE === 'true';
    } else {
      // Use auto-assigned fallback (unified mode with EMAIL_USER)
      console.log('🔧 Using EMAIL_USER credentials for fallback config (unified mode)');
      fallbackHost = process.env.FALLBACK_SMTP_HOST || mainHost;
      fallbackPort = process.env.FALLBACK_SMTP_PORT || mainPort;
      fallbackUser = process.env.FALLBACK_SMTP_USER || mainUser;
      fallbackPass = process.env.FALLBACK_SMTP_PASS || mainPass;
      fallbackSecure = process.env.FALLBACK_SMTP_SECURE === 'true';
    }
  } else if (hasValidFallbackCredentials) {
    // No EMAIL_USER credentials but valid FALLBACK_SMTP - use for both
    console.log('🔧 Using FALLBACK_SMTP credentials for both main and fallback config');
    mainHost = fallbackHost = process.env.FALLBACK_SMTP_HOST!;
    mainPort = fallbackPort = process.env.FALLBACK_SMTP_PORT!;
    mainUser = fallbackUser = process.env.FALLBACK_SMTP_USER!;
    mainPass = fallbackPass = process.env.FALLBACK_SMTP_PASS!;
    fallbackSecure = process.env.FALLBACK_SMTP_SECURE === 'true';
  } else {
    // No valid credentials available
    console.log('❌ No valid SMTP credentials found');
    mainHost = mainPort = mainUser = mainPass = '';
    fallbackHost = fallbackPort = fallbackUser = fallbackPass = '';
    fallbackSecure = false;
  }

  // Main email configuration (used for OTP emails)
  const mainConfig: SMTPConfig | null = (mainUser && mainPass) ? {
    host: mainHost,
    port: parseInt(mainPort),
    secure: false, // Keep false for main config (typically Gmail)
    auth: {
      user: mainUser,
      pass: mainPass
    }
  } : null;

  // Fallback configuration (used for dynamic/external emails)
  const fallbackConfig: SMTPConfig | null = (fallbackUser && fallbackPass) ? {
    host: fallbackHost,
    port: parseInt(fallbackPort),
    secure: fallbackSecure,
    auth: {
      user: fallbackUser,
      pass: fallbackPass
    }
  } : null;

  // Working config exists if we have any valid SMTP credentials
  const hasWorkingConfig = hasMainCredentials && (mainConfig !== null || fallbackConfig !== null);
  
  // Using defaults when we use EMAIL_USER for both main and fallback
  const usingDefaults = hasUserCredentials && (
    !hasValidFallbackCredentials || 
    shouldForceUnified ||
    (fallbackUser === mainUser && fallbackPass === mainPass)
  );

  console.log('📊 Configuration Summary:');
  console.log('- hasExplicitFallback:', hasExplicitFallback);
  console.log('- hasMainCredentials:', hasMainCredentials);
  console.log('- hasWorkingConfig:', hasWorkingConfig);
  console.log('- usingDefaults:', usingDefaults);
  console.log('- mainConfig available:', !!mainConfig);
  console.log('- fallbackConfig available:', !!fallbackConfig);
  if (fallbackConfig) {
    console.log('- fallbackUser:', fallbackConfig.auth.user);
  }
  if (mainConfig) {
    console.log('- mainUser:', mainConfig.auth.user);
  }
  console.log('=====================================\n');

  return {
    hasExplicitFallback,
    hasMainCredentials,
    hasWorkingConfig,
    fallbackConfig,
    mainConfig,
    usingDefaults
  };
}

/**
 * Get the unified SMTP configuration for fallback emails
 * Returns the explicit fallback config if available, otherwise defaults to main email config
 */
export function getFallbackSMTPConfig(): SMTPConfig | null {
  const config = getEmailConfiguration();
  return config.fallbackConfig;
}

/**
 * Get the main SMTP configuration for OTP emails
 */
export function getMainSMTPConfig(): SMTPConfig | null {
  const config = getEmailConfiguration();
  return config.mainConfig;
}

/**
 * Check if both OTP and fallback emails will use the same SMTP account
 */
export function isUsingSameAccount(): boolean {
  const config = getEmailConfiguration();
  
  if (!config.mainConfig || !config.fallbackConfig) {
    return false;
  }
  
  return config.mainConfig.auth.user === config.fallbackConfig.auth.user;
}

/**
 * Get configuration summary for debugging
 */
export function getConfigurationSummary(): {
  hasExplicitFallback: boolean;
  hasMainCredentials: boolean;
  hasWorkingConfig: boolean;
  usingDefaults: boolean;
  sameAccount: boolean;
  fallbackHost: string;
  fallbackPort: number;
  fallbackUser: string;
  mainUser: string;
} {
  const config = getEmailConfiguration();
  
  return {
    hasExplicitFallback: config.hasExplicitFallback,
    hasMainCredentials: config.hasMainCredentials,
    hasWorkingConfig: config.hasWorkingConfig,
    usingDefaults: config.usingDefaults,
    sameAccount: isUsingSameAccount(),
    fallbackHost: config.fallbackConfig?.host || 'not configured',
    fallbackPort: config.fallbackConfig?.port || 0,
    fallbackUser: config.fallbackConfig?.auth.user || 'not configured',
    mainUser: config.mainConfig?.auth.user || 'not configured'
  };
} 