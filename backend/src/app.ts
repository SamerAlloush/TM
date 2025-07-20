import express from 'express';
import cors from 'cors';
import path from 'path';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import authRoutes from './routes/auth';
import conversationRoutes from './routes/conversations';
import messageRoutes from './routes/messages';
import userRoutes from './routes/users';
import siteRoutes from './routes/sites';
import taskRoutes from './routes/tasks';
import documentRoutes from './routes/documents';
import absenceRoutes from './routes/absences';
import interventionRoutes from './routes/interventionRequests';
import mailRoutes from './routes/mail';
import dashboardRoutes from './routes/dashboard';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 📁 Serve uploaded files statically BEFORE API routes
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
console.log('📁 Static file serving enabled:', path.join(__dirname, '..', 'uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/absences', absenceRoutes);
app.use('/api/intervention-requests', interventionRoutes);
app.use('/api/mail', mailRoutes);
app.use('/api/dashboard', dashboardRoutes);

// API fallback route to prevent HTML response on bad API calls
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: "API route not found", path: req.path });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

export { app }; 