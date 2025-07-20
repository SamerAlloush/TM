const nodemailer = require('nodemailer');

// Global variable to hold the transporter
let globalSMTPTransport = null;

// Function to create or get the global SMTP transport
const getGlobalSMTPTransport = () => {
  if (globalSMTPTransport) {
    return globalSMTPTransport;
  }

  console.log('\n🔧 ===== CREATING GLOBAL SMTP TRANSPORT =====');
  console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'configured' : 'missing');
  console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? 'configured' : 'missing'); 
  console.log('EMAIL_SERVICE:', process.env.EMAIL_SERVICE || 'gmail');
  console.log('EMAIL_FROM:', process.env.EMAIL_FROM || 'not set');
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.error('❌ EMAIL_USER or EMAIL_PASSWORD not configured in .env');
    console.error('💡 Please check your .env file');
    return null;
  }

  console.log('✅ Creating nodemailer transport...');
  
  try {
    globalSMTPTransport = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      tls: { rejectUnauthorized: false },
    });
    
    console.log('✅ Global SMTP transport created successfully');
    console.log('===============================================\n');
    
    return globalSMTPTransport;
  } catch (error) {
    console.error('❌ Failed to create SMTP transport:', error);
    return null;
  }
};

// Create a proxy object that calls getGlobalSMTPTransport() for sendMail
const transportProxy = {
  sendMail: function(mailOptions) {
    const transport = getGlobalSMTPTransport();
    if (!transport) {
      throw new Error('Global SMTP transport not available - check EMAIL_USER configuration');
    }
    return transport.sendMail(mailOptions);
  },
  verify: function() {
    const transport = getGlobalSMTPTransport();
    if (!transport) {
      throw new Error('Global SMTP transport not available - check EMAIL_USER configuration');
    }
    return transport.verify();
  }
};

// Export the proxy object
module.exports = transportProxy;
module.exports.getTransporter = getGlobalSMTPTransport;
module.exports.isReady = () => {
  return !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);
}; 