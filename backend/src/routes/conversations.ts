import express from 'express';
import {
  getConversations,
  createConversation,
  getMessages,
  sendMessage,
  uploadMedia,
  deleteMessage,
  searchMessages
} from '../controllers/conversationController';
import { protect } from '../middleware/auth';
import { validateSendMessage, validateCreateConversation } from '../middleware/validate';
import { mediaUpload } from '../middleware/mediaUpload';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// Debug endpoint to test request format
router.post('/debug', (req, res) => {
  console.log('\n🔍 ===== CONVERSATION DEBUG ENDPOINT =====');
  console.log('User:', (req as any).user?.id);
  console.log('Headers:', req.headers);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('Query:', req.query);
  console.log('========================================\n');
  
  res.json({
    success: true,
    message: 'Debug info logged to console',
    received: {
      user: (req as any).user?.id,
      body: req.body,
      headers: {
        'content-type': req.headers['content-type'],
        'authorization': req.headers.authorization ? 'Bearer ***' : 'Missing'
      }
    }
  });
});

// Conversation routes
router.route('/')
  .get(getConversations)
  .post(validateCreateConversation, createConversation);

// Search messages
router.get('/:id/search', searchMessages);

// Conversation message routes
router.route('/:id/messages')
  .get(getMessages)
  .post(
    mediaUpload.array('files', 10), // Support files directly on messages endpoint
    validateSendMessage, 
    sendMessage
  );

// Media upload route with universal file support (legacy support)
router.post('/:id/upload', 
  mediaUpload.array('files', 10), // Allow up to 10 files
  uploadMedia
);

// Individual message routes
router.delete('/:id/messages/:messageId', deleteMessage);

export default router; 