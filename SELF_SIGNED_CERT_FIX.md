# 🔧 **Nodemailer Self-Signed Certificate Fix**

## 🚨 **Problem**

Getting this error when sending emails with nodemailer:

```json
{
  "success": false,
  "message": "self-signed certificate in certificate chain",
  "debug": {
    "error": "self-signed certificate in certificate chain",
    "stack": "Error: self-signed certificate in certificate chain\n at TLSSocket.onConnectSecure ..."
  }
}
```

## ✅ **Complete Solution**

This error occurs when your SMTP server uses self-signed certificates. Here's how to fix it **securely** by only allowing self-signed certificates in development.

### **🔐 The Secure Approach (Recommended)**

```javascript
const nodemailer = require('nodemailer');

// Environment detection
const isDevelopment = process.env.NODE_ENV === 'development';
const allowSelfSigned = process.env.ALLOW_SELF_SIGNED_CERTS === 'true';

/**
 * Environment-specific TLS configuration
 * ⚠️ Only allows self-signed certificates in development!
 */
function getTLSConfig() {
  if (isDevelopment || allowSelfSigned) {
    console.log('🔓 Development mode: Allowing self-signed certificates');
    console.log('   ⚠️  WARNING: This setting should NEVER be used in production!');
    
    return {
      rejectUnauthorized: false,        // 🔑 Main fix: allow self-signed certs
      ciphers: 'SSLv3',                // Compatibility
      secureProtocol: 'TLSv1_method',  // Fallback protocol
      checkServerIdentity: false,      // Skip hostname verification
      requestCert: false               // Don't require client cert
    };
  } else {
    console.log('🔒 Production mode: Strict certificate validation');
    
    return {
      rejectUnauthorized: true,        // Strict validation in production
      minVersion: 'TLSv1.2',          // Modern TLS only
      maxVersion: 'TLSv1.3'
    };
  }
}

// Create transporter with environment-aware TLS
const transporter = nodemailer.createTransport({
  service: 'gmail', // or your SMTP server
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  tls: getTLSConfig() // 🎯 Apply the fix here
});
```

### **🚀 Quick Integration for Your Project**

If you already have a nodemailer setup, just add the TLS configuration:

```javascript
// Your existing transporter
const transporter = nodemailer.createTransport({
  // ... your existing config ...
  
  // Add this TLS configuration:
  tls: {
    rejectUnauthorized: process.env.NODE_ENV !== 'development'
  }
});
```

### **📧 For Gmail Specifically**

```javascript
const transporter = nodemailer.createTransport({
  service: 'gmail',
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD // Use app password, not regular password
  },
  tls: {
    rejectUnauthorized: process.env.NODE_ENV !== 'development'
  }
});
```

### **🏢 For Custom SMTP Servers**

```javascript
const transporter = nodemailer.createTransport({
  host: 'your-smtp-server.com',
  port: 587,
  secure: false, // Use STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: process.env.NODE_ENV !== 'development'
  }
});
```

---

## 🧪 **Testing Your Fix**

### **Run the Test Script**

```bash
# Test in development mode (should allow self-signed certs)
NODE_ENV=development node backend/email-ssl-fix-example.js

# Test in production mode (should require valid certs)
NODE_ENV=production node backend/email-ssl-fix-example.js
```

### **Test with Your Email Credentials**

```bash
# Set your email credentials
export EMAIL_USER="your-email@gmail.com"
export EMAIL_PASSWORD="your-app-password"
export TEST_EMAIL_RECIPIENT="test@example.com"

# Run the test
NODE_ENV=development node backend/email-ssl-fix-example.js
```

---

## 🔧 **Integration Options**

### **Option 1: Update Existing Mail Controller (Your Project)**

In your `backend/src/controllers/mailController.ts`:

```typescript
// Add environment-aware TLS config
const isDevelopment = process.env.NODE_ENV === 'development';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  tls: {
    rejectUnauthorized: !isDevelopment // Only allow self-signed in dev
  }
});
```

### **Option 2: Environment Variable Control**

```javascript
const transporter = nodemailer.createTransport({
  // ... your config ...
  tls: {
    rejectUnauthorized: process.env.ALLOW_SELF_SIGNED_CERTS !== 'true'
  }
});
```

Then set the environment variable:

```bash
# For development/testing
export ALLOW_SELF_SIGNED_CERTS=true

# For production (default)
unset ALLOW_SELF_SIGNED_CERTS
```

### **Option 3: Configuration Object**

```javascript
const emailConfig = {
  development: {
    service: 'gmail',
    tls: { rejectUnauthorized: false },
    debug: true
  },
  production: {
    service: 'gmail',
    tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
    debug: false
  }
};

const env = process.env.NODE_ENV || 'production';
const transporter = nodemailer.createTransport({
  ...emailConfig[env],
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});
```

---

## 🔐 **Security Considerations**

### **✅ What This Fix Does Right**

- ✅ **Environment Detection**: Only allows self-signed certificates in development
- ✅ **Production Security**: Maintains strict certificate validation in production
- ✅ **Explicit Configuration**: Clear logging shows which mode is active
- ✅ **Fallback Options**: Multiple ways to control the behavior

### **⚠️ What NOT to Do**

```javascript
// ❌ NEVER do this (applies to all environments):
const transporter = nodemailer.createTransport({
  tls: { rejectUnauthorized: false } // Dangerous in production!
});

// ❌ NEVER disable SSL/TLS entirely:
const transporter = nodemailer.createTransport({
  secure: false,
  ignoreTLS: true // Sends passwords in plain text!
});
```

### **🛡️ Production Best Practices**

- ✅ Use proper SSL certificates in production
- ✅ Set `NODE_ENV=production` explicitly
- ✅ Use environment variables for credentials
- ✅ Enable certificate validation in production
- ✅ Use modern TLS versions (1.2+)

---

## 🚨 **Common Scenarios Where This Error Occurs**

### **Development Environments**
- Local mail servers (MailHog, MailCatcher)
- Self-signed certificates for testing
- Corporate development environments

### **Staging Environments**
- Internal SMTP servers with self-signed certificates
- Testing with non-production mail services

### **Corporate Networks**
- Internal mail servers with company-issued certificates
- Proxy servers with certificate interception

---

## 🎯 **Quick Fix Summary**

1. **Identify environment**: Check if you're in development vs production
2. **Apply conditional TLS**: Only disable certificate validation in development
3. **Test thoroughly**: Verify the fix works in both environments
4. **Deploy safely**: Ensure production maintains strict security

### **One-Line Fix**

For a quick fix, add this to your existing transporter:

```javascript
tls: { rejectUnauthorized: process.env.NODE_ENV !== 'development' }
```

### **Environment Variables to Set**

```bash
# Required for development testing
NODE_ENV=development

# Optional: Force allow self-signed certs
ALLOW_SELF_SIGNED_CERTS=true

# Your email credentials
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

---

## 📞 **If You're Still Having Issues**

### **Check Your Configuration**

```bash
# Verify environment detection
node -e "console.log('NODE_ENV:', process.env.NODE_ENV)"

# Test the fix
node backend/email-ssl-fix-example.js
```

### **Common Issues**

1. **Environment not detected**: Ensure `NODE_ENV=development` is set
2. **Still getting errors**: Check if your SMTP server requires authentication
3. **Gmail issues**: Make sure you're using an "App Password", not your regular password
4. **Corporate networks**: May need additional proxy/firewall configuration

### **Enable Debug Mode**

```javascript
const transporter = nodemailer.createTransport({
  // ... your config ...
  debug: true,  // Enable detailed SMTP logging
  logger: true  // Enable connection logging
});
```

---

**🎉 Your email sending should now work in development while maintaining security in production!** 