import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { User } from '../models/User';
import { mediaUpload } from '../middleware/mediaUpload';
import { fileProcessingService } from '../services/fileProcessingService';
import nodemailer from 'nodemailer';

// Email transporter (reuse from existing email config)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// @desc    Get user conversations
// @route   GET /api/conversations
// @access  Private
export const getConversations = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user._id.toString();
    
    const conversations = await Conversation.find({
      participants: userId,
      isActive: true
    })
    .populate('participants', 'firstName lastName email role profilePicture')
    .populate('lastMessage', 'content type createdAt sender attachments')
    .populate({
      path: 'lastMessage',
      populate: { path: 'sender', select: 'firstName lastName' }
    })
    .sort({ lastActivity: -1 })
    .limit(50);

    // Add unread count for each conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await Message.countDocuments({
          conversation: conv._id,
          sender: { $ne: userId },
          [`readBy.${userId}`]: { $exists: false }
        });

        return {
          ...conv.toObject(),
          unreadCount,
          otherParticipant: conv.participants.find(p => (p as any)._id.toString() !== userId)
        };
      })
    );

    res.json({
      success: true,
      count: conversationsWithUnread.length,
      data: conversationsWithUnread
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Create or get conversation
// @route   POST /api/conversations
// @access  Private
export const createConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user._id.toString();
    
    // 🔍 DEBUG: Log the full request for debugging
    console.log('\n📞 ===== CREATE CONVERSATION REQUEST =====');
    console.log('User ID:', userId);
    console.log('Request Body:', JSON.stringify(req.body, null, 2));
    console.log('Request Headers:', {
      'content-type': req.headers['content-type'],
      'authorization': req.headers.authorization ? 'Bearer ***' : 'Missing'
    });
    console.log('==========================================\n');

    // Handle both participantId (singular) and participants (array) for compatibility
    let participantId: string;
    
    if (req.body.participantId) {
      // Backend format (singular)
      participantId = req.body.participantId;
    } else if (req.body.participants && Array.isArray(req.body.participants) && req.body.participants.length > 0) {
      // Frontend format (array) - take first participant for direct conversations
      participantId = req.body.participants[0];
      console.log('🔄 Converted participants array to participantId:', participantId);
    } else {
      console.log('❌ Missing required field: participantId or participants');
      res.status(400).json({
        success: false,
        message: 'Participant ID is required',
        debug: {
          received: req.body,
          expected: {
            participantId: 'string (single user ID)',
            // OR
            participants: ['string (array of user IDs)'],
            type: 'direct | group (optional, defaults to direct)',
            name: 'string (optional, for group conversations)'
          }
        }
      });
      return;
    }

    const { type = 'direct', name } = req.body;

    console.log('✅ Extracted values:', { participantId, type, name });

    // Check if participant exists
    const participant = await User.findById(participantId);
    if (!participant) {
      res.status(404).json({
        success: false,
        message: 'Participant not found'
      });
      return;
    }

    // Check if conversation already exists (for direct conversations)
    if (type === 'direct') {
      const existingConversation = await Conversation.findOne({
        type: 'direct',
        participants: { $all: [userId, participantId], $size: 2 }
      })
      .populate('participants', 'firstName lastName email role')
      .populate('lastMessage');

      if (existingConversation) {
        res.json({
          success: true,
          data: existingConversation
        });
        return;
      }
    }

    // Create new conversation
    console.log('\n💾 ===== CREATING CONVERSATION =====');
    console.log('Creator User ID:', userId);
    console.log('Participant ID:', participantId);
    console.log('Participants array will be:', [userId, participantId]);
    console.log('====================================\n');

    const conversation = new Conversation({
      participants: type === 'direct' ? [userId, participantId] : [userId, participantId],
      type,
      name: name || (type === 'direct' ? undefined : 'New Group'),
      createdBy: userId
    });

    await conversation.save();
    console.log('✅ Conversation created:', conversation._id);

    // Populate conversation for response
    const populatedConversation = await Conversation.findById(conversation._id)
      .populate('participants', 'firstName lastName email role')
      .populate('createdBy', 'firstName lastName email');

    console.log('✅ Conversation populated and ready to send');

    res.status(201).json({
      success: true,
      data: populatedConversation
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get conversation messages
// @route   GET /api/conversations/:id/messages
// @access  Private
export const getMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user._id.toString();
    const { id: conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    console.log('\n📨 ===== GET MESSAGES REQUEST =====');
    console.log('User ID:', userId);
    console.log('Conversation ID:', conversationId);
    console.log('Page:', page, 'Limit:', limit);
    console.log('==================================\n');

    const conversation = await Conversation.findById(conversationId)
      .populate('participants', 'firstName lastName email role');

    if (!conversation) {
      res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
      return;
    }

    if (!conversation.isParticipant(userId)) {
      res.status(403).json({
        success: false,
        message: 'You are not a participant in this conversation'
      });
      return;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const messages = await Message.find({
      conversation: conversationId,
      isDeleted: false
    })
    .populate('sender', 'firstName lastName email role')
    .populate('replyTo', 'content sender type')
    .populate({
      path: 'replyTo',
      populate: { path: 'sender', select: 'firstName lastName' }
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

    const total = await Message.countDocuments({
      conversation: conversationId,
      isDeleted: false
    });

    // Ensure all messages have proper content and attachments
    const processedMessages = messages.map(msg => ({
      _id: msg._id,
      content: msg.content || '', // Always return string, never null/undefined
      sender: msg.sender,
      conversation: msg.conversation,
      attachments: msg.attachments || [], // Always return array, never null/undefined
      type: msg.type,
      replyTo: msg.replyTo,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
      status: msg.status,
      readBy: msg.readBy
    }));

    console.log('✅ Messages retrieved:', {
      count: processedMessages.length,
      messagesWithContent: processedMessages.filter(m => m.content && m.content.trim() !== '').length,
      messagesWithAttachments: processedMessages.filter(m => m.attachments && m.attachments.length > 0).length
    });

    res.json({
      success: true,
      data: processedMessages,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Send message with media support
// @route   POST /api/conversations/:id/messages
// @access  Private
export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user._id.toString();
    const { id: conversationId } = req.params;
    const { content = '', type = 'text', replyTo } = req.body;

    // 🔍 DEBUG: Log the request details
    console.log('\n📨 ===== SEND MESSAGE REQUEST =====');
    console.log('User ID:', userId);
    console.log('Conversation ID:', conversationId);
    console.log('Request Body:', JSON.stringify(req.body, null, 2));
    console.log('Request Headers:', {
      'content-type': req.headers['content-type'],
      'authorization': req.headers.authorization ? 'Bearer ***' : 'Missing'
    });
    console.log('====================================\n');

    // Validate required fields
    if (!conversationId) {
      console.log('❌ Validation failed: Missing conversation ID');
      res.status(400).json({
        success: false,
        message: 'Conversation ID is required',
        error: 'MISSING_CONVERSATION_ID'
      });
      return;
    }

    // Allow empty content if there are attachments
    const processedFiles = (req as any).processedFiles || [];
    if (!content.trim() && processedFiles.length === 0) {
      console.log('❌ Validation failed: Empty message content and no attachments');
      res.status(400).json({
        success: false,
        message: 'Message content or files are required',
        error: 'EMPTY_CONTENT_AND_NO_FILES'
      });
      return;
    }

    // Log validation success for both text and media uploads
    if (processedFiles.length > 0) {
      console.log('✅ Media upload validation successful:', {
        filesCount: processedFiles.length,
        hasContent: !!content.trim(),
        uploadType: content.trim() ? 'mixed' : 'media-only'
      });
    }

    // Find and verify conversation exists
    console.log('🔍 Finding conversation...');
    const conversation = await Conversation.findById(conversationId)
      .populate('participants', 'firstName lastName email role isActive');
    
    if (!conversation) {
      console.log('❌ Conversation not found:', conversationId);
      res.status(404).json({
        success: false,
        message: 'Conversation not found',
        error: 'CONVERSATION_NOT_FOUND'
      });
      return;
    }

    console.log('✅ Conversation found:', {
      id: conversation._id,
      type: conversation.type,
      participantCount: conversation.participants.length,
      participants: conversation.participants.map((p: any) => ({
        id: p._id,
        name: `${p.firstName} ${p.lastName}`,
        email: p.email,
        role: p.role,
        isActive: p.isActive
      }))
    });

    // 🔍 DETAILED PARTICIPANT VALIDATION DEBUGGING
    console.log('\n🔍 ===== PARTICIPANT VALIDATION DEBUG =====');
    console.log('Current User ID (from token):', userId);
    console.log('Current User ID type:', typeof userId);
    console.log('Conversation participants (raw):', conversation.participants.map((p: any) => p._id));
    console.log('Conversation participants (as strings):', conversation.participants.map((p: any) => p._id.toString()));
    
    // Test the isParticipant method step by step
    const participantIds = conversation.participants.map((p: any) => p._id.toString());
    const isUserInParticipants = participantIds.includes(userId);
    const isParticipantMethodResult = conversation.isParticipant(userId);
    
    console.log('Participant IDs as strings:', participantIds);
    console.log('Array.includes(userId) result:', isUserInParticipants);
    console.log('conversation.isParticipant(userId) result:', isParticipantMethodResult);
    console.log('=========================================\n');

    // ✅ FIXED: Use the updated isParticipant method that handles populated documents
    if (!conversation.isParticipant(userId)) {
      console.log('❌ User is not a participant in this conversation');
      console.log('❌ DEBUGGING INFO:');
      console.log('   - User trying to send:', userId);
      console.log('   - Participants in conversation:', participantIds);
      console.log('   - Manual check result:', isUserInParticipants);
      console.log('   - isParticipant method result:', isParticipantMethodResult);
      
      res.status(403).json({
        success: false,
        message: 'You are not a participant in this conversation',
        error: 'NOT_PARTICIPANT',
        debug: {
          userId,
          conversationId,
          participants: participantIds,
          participantCheck: isUserInParticipants,
          methodCheck: isParticipantMethodResult,
          reason: 'Fixed isParticipant method now handles populated documents'
        }
      });
      return;
    }

    console.log('✅ User is a valid participant');

    // Process attachments from the new media upload system
    const attachments = processedFiles.map((file: any) => ({
      fileName: file.fileName,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      url: file.url,
      path: file.path,
      thumbnailUrl: file.thumbnailUrl
    }));

    console.log('📎 Attachments processed:', attachments.length);

    // Determine message type and content
    let messageType = type;
    let messageContent = content.trim();
    
    if (attachments.length > 0) {
      const firstAttachment = attachments[0];
      if (firstAttachment.mimeType.startsWith('image/')) {
        messageType = 'image';
      } else if (firstAttachment.mimeType.startsWith('video/')) {
        messageType = 'video';
      } else if (firstAttachment.mimeType.startsWith('audio/')) {
        messageType = 'audio';
      } else {
        messageType = 'document';
      }
    } else if (messageContent) {
      messageType = 'text';
    }

    // Create message
    console.log('💾 Creating message...');
    const message = new Message({
      conversation: conversationId,
      sender: userId,
      content: messageContent, // Use processed content
      type: messageType,
      attachments,
      replyTo: replyTo || undefined
    });

    await message.save();
    console.log('✅ Message created:', message._id);

    // Update conversation last activity
    conversation.lastMessage = message._id as any;
    conversation.lastActivity = new Date();
    await conversation.save();
    console.log('✅ Conversation updated');

    // Populate message for response
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'firstName lastName email role')
      .populate('replyTo', 'content sender type')
      .populate({
        path: 'replyTo',
        populate: { path: 'sender', select: 'firstName lastName' }
      });

    console.log('✅ Message populated and ready to send');

    // 🔥 INSTANT MESSAGING: Emit socket event for real-time updates
    try {
      const socketManager = (global as any).socketManager;
      
      if (socketManager && populatedMessage) {
        // Emit to all participants in the conversation
        const eventData = {
          conversationId: conversationId,
          message: populatedMessage,
          sender: {
            _id: (populatedMessage.sender as any)._id,
            firstName: (populatedMessage.sender as any).firstName,
            lastName: (populatedMessage.sender as any).lastName,
            email: (populatedMessage.sender as any).email
          }
        };

        // Emit to conversation room for instant updates
        socketManager.emitToConversation(conversationId, 'message:new', eventData);
        console.log('📡 Real-time message event emitted to conversation room');

        // Also emit to individual user rooms for reliability
        conversation.participants.forEach((participant: any) => {
          const participantId = participant._id.toString();
          if (participantId !== userId) { // Don't emit to sender
            socketManager.emitToUser(participantId, 'message:new', eventData);
            console.log(`📡 Message event emitted to user:${participantId}`);
          }
        });
      } else {
        console.log('⚠️ Socket.IO not available for real-time updates');
      }
    } catch (socketError) {
      console.log('⚠️ Socket event emission failed (non-critical):', socketError);
    }

    // Send email notification if enabled
    try {
      await sendEmailNotification(conversation, populatedMessage as any, userId);
      console.log('✅ Email notification sent (if configured)');
    } catch (emailError) {
      console.log('⚠️ Email notification failed (non-critical):', emailError);
    }

    console.log('🎉 Message sent successfully!\n');

    res.status(201).json({
      success: true,
      data: populatedMessage
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Upload media files
// @route   POST /api/conversations/:id/upload
// @access  Private
export const uploadMedia = async (req: Request, res: Response): Promise<void> => {
  try {
    // Ensure proper JSON response headers
    res.setHeader('Content-Type', 'application/json');
    
    const userId = (req as any).user._id.toString();
    const { id: conversationId } = req.params;
    const { content = '[Media]', replyTo } = req.body;

    console.log('\n📎 ===== MEDIA UPLOAD REQUEST =====');
    console.log('User ID:', userId);
    console.log('Conversation ID:', conversationId);
    console.log('Content:', content);
    console.log('Raw files:', req.files);
    console.log('Processed files:', (req as any).processedFiles?.length || 0);
    console.log('Request headers:', req.headers);
    console.log('Request body:', req.body);
    console.log('====================================\n');

    // Validate conversation exists and user is participant
    const conversation = await Conversation.findById(conversationId)
      .populate('participants', 'firstName lastName email role');

    if (!conversation) {
      res.status(404).json({
        success: false,
        message: 'Conversation not found',
        error: 'CONVERSATION_NOT_FOUND'
      });
      return;
    }

    if (!conversation.isParticipant(userId)) {
      res.status(403).json({
        success: false,
        message: 'You are not a participant in this conversation',
        error: 'NOT_PARTICIPANT'
      });
      return;
    }

    // Get processed files from middleware
    const processedFiles = (req as any).processedFiles || [];

    if (processedFiles.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No files uploaded',
        error: 'NO_FILES'
      });
      return;
    }

    console.log('📎 Validation terminée, fichiers prêts à être envoyés:', processedFiles);

    // Convert processed files to attachments
    const attachments = processedFiles.map((file: any) => ({
      fileName: file.fileName,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      url: file.url,
      path: file.path,
      thumbnailUrl: file.thumbnailUrl
    }));

    // Determine message type and content
    let messageType = 'text';
    let messageContent = content.trim();
    
    if (attachments.length > 0) {
      const firstAttachment = attachments[0];
      if (firstAttachment.mimeType.startsWith('image/')) {
        messageType = 'image';
      } else if (firstAttachment.mimeType.startsWith('video/')) {
        messageType = 'video';
      } else if (firstAttachment.mimeType.startsWith('audio/')) {
        messageType = 'audio';
      } else {
        messageType = 'document';
      }
      
      // If no text content provided, use default media message
      if (!messageContent) {
        messageContent = '[Media]';
      }
    }

    // Create message
    const message = new Message({
      conversation: conversationId,
      sender: userId,
      content: messageContent,
      type: messageType,
      attachments,
      replyTo: replyTo || undefined
    });

    await message.save();

    // Update conversation
    conversation.lastMessage = message._id as any;
    conversation.lastActivity = new Date();
    await conversation.save();

    // Populate message
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'firstName lastName email role')
      .populate('replyTo', 'content sender type')
      .populate({
        path: 'replyTo',
        populate: { path: 'sender', select: 'firstName lastName' }
      });

    // Emit socket event for real-time updates
    const socketManager = (global as any).socketManager;
    if (socketManager && populatedMessage) {
      const eventData = {
        conversationId,
        message: populatedMessage,
        sender: {
          _id: (populatedMessage.sender as any)._id,
          firstName: (populatedMessage.sender as any).firstName,
          lastName: (populatedMessage.sender as any).lastName,
          email: (populatedMessage.sender as any).email
        }
      };

      // Emit to conversation room
      socketManager.emitToConversation(conversationId, 'message:new', eventData);
      
      // Also emit new_message event for compatibility
      socketManager.emitToConversation(conversationId, 'new_message', populatedMessage);
      
      console.log('📡 Socket events emitted for media upload');
    }

    console.log('✅ Media upload successful');

    // Return structured JSON response
    res.status(201).json({
      success: true,
      message: populatedMessage,
      files: processedFiles,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error uploading media:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during media upload',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// @desc    Delete message
// @route   DELETE /api/conversations/:id/messages/:messageId
// @access  Private
export const deleteMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user._id.toString();
    const { id: conversationId, messageId } = req.params;

    const message = await Message.findById(messageId)
      .populate('sender', 'firstName lastName email role');

    if (!message) {
      res.status(404).json({
        success: false,
        message: 'Message not found'
      });
      return;
    }

    if (message.conversation.toString() !== conversationId) {
      res.status(400).json({
        success: false,
        message: 'Message does not belong to this conversation'
      });
      return;
    }

    if (message.sender._id.toString() !== userId) {
      res.status(403).json({
        success: false,
        message: 'You can only delete your own messages'
      });
      return;
    }

    // Soft delete
    message.isDeleted = true;
    message.deletedAt = new Date();
    await message.save();

    // Emit socket event
    const socketManager = (global as any).socketManager;
    if (socketManager) {
      socketManager.emitToConversation(conversationId, 'message:deleted', {
        messageId,
        conversationId
      });
    }

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Search messages
// @route   GET /api/conversations/:id/search
// @access  Private
export const searchMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user._id.toString();
    const { id: conversationId } = req.params;
    const { q: query, page = 1, limit = 20 } = req.query;

    if (!query || query.toString().trim() === '') {
      res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
      return;
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.isParticipant(userId)) {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const messages = await Message.find({
      conversation: conversationId,
      isDeleted: false,
      $text: { $search: query.toString() }
    })
    .populate('sender', 'firstName lastName email role')
    .sort({ score: { $meta: 'textScore' } })
    .skip(skip)
    .limit(Number(limit));

    const total = await Message.countDocuments({
      conversation: conversationId,
      isDeleted: false,
      $text: { $search: query.toString() }
    });

    res.json({
      success: true,
      data: messages,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error searching messages:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Helper function for email notifications
async function sendEmailNotification(conversation: any, message: any, senderId: string) {
  // Email notification logic here
  // This is a placeholder - implement based on your email requirements
} 