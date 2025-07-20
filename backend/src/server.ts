// Load environment variables FIRST before any imports that need them
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import path from 'path';
import nodemailer from 'nodemailer';

import { connectDB } from './config/database';
import { testEmailConnection } from './config/email';
import { getEmailConfiguration } from './config/emailConfig';
import { globalSMTPTransport, getSMTPStatus, verifyGlobalSMTP } from './services/globalEmailService';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { initializeSocketManager } from './config/socket';

// Routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import siteRoutes from './routes/sites';
import taskRoutes from './routes/tasks';
import messageRoutes from './routes/messages';
import absenceRoutes from './routes/absences';
import documentRoutes from './routes/documents';
import dashboardRoutes from './routes/dashboard';
import conversationRoutes from './routes/conversations';
import mailRoutes from './routes/mail';
import interventionRequestRoutes from './routes/interventionRequests';

// Add debug logging to verify email configuration
console.log('\n🔍 ===== EMAIL CONFIGURATION DEBUG =====');
console.log('EMAIL_SERVICE:', process.env.EMAIL_SERVICE);
console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'configured' : 'missing');
console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? 'configured' : 'missing');
console.log('EMAIL_FROM:', process.env.EMAIL_FROM);
console.log('FALLBACK_SMTP_ENABLED:', process.env.FALLBACK_SMTP_ENABLED);
console.log('FALLBACK_SMTP_HOST:', process.env.FALLBACK_SMTP_HOST);
console.log('FALLBACK_SMTP_USER:', process.env.FALLBACK_SMTP_USER ? 'configured' : 'missing');
console.log('FALLBACK_SMTP_PASS:', process.env.FALLBACK_SMTP_PASS ? 'configured' : 'missing');
console.log('=========================================\n');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false
}));

// Enhanced CORS configuration for development and production
app.use(cors({
  origin: [
    'http://localhost:19006',     // Expo dev server
    'http://localhost:8081',      // Alternative Expo port  
    'http://localhost:3000',      // React dev server
    'http://localhost:3001',      // Backend dev server
    'http://localhost:3002',      // Alternative backend port
    'http://localhost:19000',     // Expo web
    'exp://localhost:19000',      // Expo tunnel
    'exp://localhost:19006',      // Expo tunnel alternative
    process.env.FRONTEND_URL || 'http://localhost:19006'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  exposedHeaders: ['X-Total-Count'],
  maxAge: 86400 // 24 hours
}));

// Handle preflight requests
app.options('*', cors());

// Rate limiting with enhanced configuration
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for health checks
  skip: (req) => req.path === '/health'
});
app.use('/api/', limiter);

// Body parsing middleware with enhanced limits
app.use(express.json({ 
  limit: process.env.MAX_FILE_SIZE || '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf.toString());
    } catch (e) {
      (res as express.Response).status(400).json({
        success: false,
        error: 'Invalid JSON format'
      });
      throw new Error('Invalid JSON');
    }
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: process.env.MAX_FILE_SIZE || '10mb' 
}));

// Compression middleware
app.use(compression());

// Enhanced logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
  
  // Add detailed request logging for debugging
  app.use('/api/conversations', (req, res, next) => {
    console.log(`\n🔍 ${req.method} ${req.path} - Request Details:`);
    console.log('Headers:', {
      'content-type': req.headers['content-type'],
      'authorization': req.headers.authorization ? 'Bearer ***' : 'Missing',
      'user-agent': req.headers['user-agent']
    });
    if (req.method !== 'GET') {
      console.log('Body:', JSON.stringify(req.body, null, 2));
    }
    console.log('Query:', req.query);
    console.log('Params:', req.params);
    next();
  });
} else {
  app.use(morgan('combined'));
}

// Connect to MongoDB
connectDB();

// Initialize Global SMTP Service  
console.log('\n🔧 ===== INITIALIZING GLOBAL SMTP SERVICE =====');
const smtpStatus = getSMTPStatus();
console.log('Global SMTP Configuration:');
console.log('- Service:', smtpStatus.service);
console.log('- User:', smtpStatus.user);
console.log('- From:', smtpStatus.from);
console.log('- Is Configured:', smtpStatus.isConfigured);
console.log('- Has Credentials:', smtpStatus.hasCredentials);

// Verify SMTP connection asynchronously
verifyGlobalSMTP().then((smtpVerification) => {
  if (smtpVerification.success) {
    console.log('✅ Global SMTP Service: READY');
    console.log('📧 All emails (OTP + external) will use the same SMTP account');
    console.log('📧 No more "user has no credentials" errors');
    console.log('📧 Consistent reply-to behavior enabled');
  } else {
    console.log('❌ Global SMTP Service: NOT READY');
    console.log('💡 Check EMAIL_USER and EMAIL_PASSWORD in .env file');
    console.log('❌ Error:', smtpVerification.error);
  }
}).catch((error) => {
  console.log('❌ Global SMTP verification failed:', error.message);
});
console.log('================================================\n');

// Enhanced health check route
app.get('/health', async (req, res) => {
  const health = {
    status: 'OK',
    message: 'TM Paysage Site Manager API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    services: {
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      email: await testEmailConnection() ? 'available' : 'unavailable'
    }
  };

  const statusCode = health.services.database === 'connected' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Handle favicon requests gracefully
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // No content for favicon
});

// API routes with enhanced error handling
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/absences', absenceRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/mail', mailRoutes);
app.use('/api/intervention-requests', interventionRequestRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'TM Paysage Site Manager API',
    version: '1.0.0',
    documentation: '/health',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      users: '/api/users',
      sites: '/api/sites',
      tasks: '/api/tasks',
      messages: '/api/messages',
      conversations: '/api/conversations',
      absences: '/api/absences',
      documents: '/api/documents',
      dashboard: '/api/dashboard',
      mail: '/api/mail',
      interventionRequests: '/api/intervention-requests'
    }
  });
});

// Error handling middleware (must be last)
app.use(notFound);
app.use(errorHandler);

// Enhanced server startup with error handling
const startServer = async () => {
  try {
    // Create HTTP server
    const httpServer = createServer(app);
    
    // Initialize Socket.IO
    const socketManager = initializeSocketManager(httpServer);
    
    // Store socket manager globally for use in controllers
    (global as any).socketManager = socketManager;
    
    const server = httpServer.listen(PORT, () => {
      console.log('\n🚀 ===== TM PAYSAGE API STARTED =====');
      console.log(`📍 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🌐 API base URL: http://localhost:${PORT}/api`);
      console.log(`💬 Real-time messaging: Socket.IO enabled`);
      console.log(`⚡ CORS origins: ${process.env.FRONTEND_URL || 'http://localhost:19006'}`);
      console.log('==========================================\n');
    });

    // Handle server errors, especially port conflicts
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${PORT} is already in use!`);
        console.log('🔧 Quick fixes:');
        console.log(`   1. Kill the process: netstat -ano | findstr :${PORT}, then taskkill /PID <PID> /F`);
        console.log(`   2. Use a different port: set PORT=3002 && npm run dev`);
        console.log(`   3. Or kill all node processes: taskkill /F /IM node.exe`);
        console.log('   4. Wait a few seconds and try again\n');
        
        // Try alternative ports automatically
        const alternativePorts = [3002, 3003, 3004, 3005];
        console.log('🔄 Attempting to find an available port...');
        
        let portFound = false;
        for (const altPort of alternativePorts) {
          try {
            const altServer = httpServer.listen(altPort, () => {
              console.log(`\n🚀 ===== SERVER STARTED ON ALTERNATIVE PORT =====`);
              console.log(`📍 Server running on port ${altPort} (fallback)`);
              console.log(`🔗 Health check: http://localhost:${altPort}/health`);
              console.log(`🌐 API base URL: http://localhost:${altPort}/api`);
              console.log('===============================================\n');
              portFound = true;
            });
            
            altServer.on('error', () => {
              // Port also in use, try next
            });
            
            if (portFound) break;
          } catch (e) {
            // Continue to next port
          }
        }
        
        if (!portFound) {
          console.error('❌ Could not find an available port. Please manually resolve the port conflict.');
          process.exit(1);
        }
      } else {
        console.error('❌ Server error:', error);
        process.exit(1);
      }
    });

    // Graceful shutdown handling
         process.on('SIGTERM', () => {
       console.log('SIGTERM received, shutting down gracefully...');
       server.close(() => {
         mongoose.connection.close().then(() => {
           console.log('Server closed and database connection terminated.');
           process.exit(0);
         });
       });
     });

         process.on('SIGINT', () => {
       console.log('SIGINT received, shutting down gracefully...');
       server.close(() => {
         mongoose.connection.close().then(() => {
           console.log('Server closed and database connection terminated.');
           process.exit(0);
         });
       });
     });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

export default app; 