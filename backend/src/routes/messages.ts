import express from 'express';
import { protect } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Legacy API compatibility - redirect to new conversation system
router.all('*', (req, res) => {
  res.status(410).json({
    success: false,
    message: 'This messaging API has been upgraded to a new conversation-based system',
    migration: {
      message: 'Please use the new /api/conversations endpoints',
      endpoints: {
        'GET /api/messages': 'GET /api/conversations',
        'POST /api/messages': 'POST /api/conversations/:id/messages',
        'GET /api/messages/:id': 'GET /api/conversations/:conversationId/messages',
        'DELETE /api/messages/:id': 'DELETE /api/conversations/messages/:id'
      },
      documentation: 'Check the new conversation API for real-time messaging features',
      features: [
        'Real-time messaging with Socket.IO',
        'File attachments support',
        'Message reactions and read receipts',
        'Typing indicators',
        'User presence indicators'
      ]
    }
  });
});

export default router; 