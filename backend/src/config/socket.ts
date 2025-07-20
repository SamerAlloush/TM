import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Message } from '../models/Message';
import { Conversation } from '../models/Conversation';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: any;
}

class SocketManager {
  private io: Server;
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: [
          "http://localhost:8081", 
          "http://localhost:19006", 
          "http://localhost:19000",
          "http://localhost:3000",
          "exp://192.168.1.100:8081",
          "exp://localhost:19006",
          "exp://localhost:19000"
        ],
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 25000, // 25s timeout for stability
      pingInterval: 10000, // 10s ping interval for faster detection
      upgradeTimeout: 30000, // 30s to upgrade transport
      maxHttpBufferSize: 1e8, // 100MB buffer size for large files
      allowEIO3: true,
      connectTimeout: 30000, // 30s connection timeout
      serveClient: false, // Don't serve socket.io client
      allowUpgrades: true, // Allow transport upgrades
      perMessageDeflate: {
        threshold: 1024, // Only compress messages > 1KB
        concurrencyLimit: 10,
        windowBits: 13
      },
      httpCompression: {
        threshold: 1024
      },
      cookie: false, // Disable cookies for security
      cleanupEmptyChildNamespaces: true
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        console.log('🔐 Socket auth attempt:', {
          socketId: socket.id,
          hasToken: !!token,
          tokenStart: token ? `${token.substring(0, 10)}...` : 'none'
        });
        
        if (!token) {
          console.log('❌ Socket auth failed: No token provided');
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user || !user.isActive) {
          console.log('❌ Socket auth failed: User not found or inactive', {
            userId: decoded.id,
            userExists: !!user,
            userActive: user?.isActive
          });
          return next(new Error('User not found or inactive'));
        }

        socket.userId = (user._id as any).toString();
        socket.user = user;
        
        console.log('✅ Socket authenticated:', {
          socketId: socket.id,
          userId: socket.userId,
          userEmail: user.email
        });
        
        next();
      } catch (error: any) {
        console.error('❌ Socket authentication error:', {
          socketId: socket.id,
          error: error.message,
          name: error.name
        });
        
        if (error.name === 'TokenExpiredError') {
          next(new Error('Token expired'));
        } else if (error.name === 'JsonWebTokenError') {
          next(new Error('Invalid token'));
        } else {
          next(new Error('Authentication failed'));
        }
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`🔌 User ${socket.user?.firstName} connected: ${socket.id}`);
      
      // Store user connection
      if (socket.userId) {
        this.connectedUsers.set(socket.userId, socket.id);
        console.log(`👤 User ${socket.user.email} (${socket.userId}) mapped to socket ${socket.id}`);
        
        // Join user to their personal room
        socket.join(`user:${socket.userId}`);
        console.log(`🏠 User joined personal room: user:${socket.userId}`);
        
        // Emit user online status
        socket.broadcast.emit('user:online', {
          userId: socket.userId,
          user: {
            _id: socket.user._id,
            firstName: socket.user.firstName,
            lastName: socket.user.lastName,
            email: socket.user.email,
            role: socket.user.role
          }
        });
        console.log(`📡 Broadcasted online status for user ${socket.user.email}`);
      }

      // Join conversation rooms for existing conversations
      this.joinUserConversations(socket);

      // Handle message sending
      socket.on('message:send', async (data) => {
        await this.handleSendMessage(socket, data);
      });

      // Handle joining conversation
      socket.on('conversation:join', async (conversationId) => {
        await this.handleJoinConversation(socket, conversationId);
      });

      // Handle leaving conversation
      socket.on('conversation:leave', (conversationId) => {
        socket.leave(`conversation:${conversationId}`);
      });

      // Handle typing indicators
      socket.on('typing:start', (data) => {
        socket.to(`conversation:${data.conversationId}`).emit('typing:start', {
          userId: socket.userId,
          user: socket.user,
          conversationId: data.conversationId
        });
      });

      socket.on('typing:stop', (data) => {
        socket.to(`conversation:${data.conversationId}`).emit('typing:stop', {
          userId: socket.userId,
          conversationId: data.conversationId
        });
      });

      // Handle message read status
      socket.on('message:read', async (data) => {
        await this.handleMessageRead(socket, data);
      });

      // Handle message reactions
      socket.on('message:react', async (data) => {
        await this.handleMessageReaction(socket, data);
      });

      // Handle media upload events
      socket.on('media:upload_start', (data) => {
        socket.to(`conversation:${data.conversationId}`).emit('media:upload_start', {
          userId: socket.userId,
          user: socket.user,
          conversationId: data.conversationId,
          files: data.files
        });
      });

      socket.on('media:upload_progress', (data) => {
        socket.to(`conversation:${data.conversationId}`).emit('media:upload_progress', {
          userId: socket.userId,
          conversationId: data.conversationId,
          fileId: data.fileId,
          progress: data.progress
        });
      });

      // Handle new upload progress events
      socket.on('upload:start', (data) => {
        socket.to(`conversation:${data.conversationId}`).emit('upload:start', {
          userId: socket.userId,
          user: socket.user,
          ...data
        });
      });

      socket.on('upload:progress', (data) => {
        socket.to(`conversation:${data.conversationId}`).emit('upload:progress', {
          userId: socket.userId,
          ...data
        });
      });

      socket.on('upload:complete', (data) => {
        socket.to(`conversation:${data.conversationId}`).emit('upload:complete', {
          userId: socket.userId,
          user: socket.user,
          ...data
        });
      });

      socket.on('upload:error', (data) => {
        socket.to(`conversation:${data.conversationId}`).emit('upload:error', {
          userId: socket.userId,
          ...data
        });
      });

      socket.on('media:upload_complete', (data) => {
        socket.to(`conversation:${data.conversationId}`).emit('media:upload_complete', {
          userId: socket.userId,
          user: socket.user,
          conversationId: data.conversationId,
          files: data.files
        });
      });

      socket.on('typing:media', (data) => {
        socket.to(`conversation:${data.conversationId}`).emit('typing:media', {
          userId: socket.userId,
          user: socket.user,
          conversationId: data.conversationId
        });
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        console.log(`🔌 User ${socket.user?.firstName} disconnected: ${socket.id}`, {
          reason,
          userId: socket.userId,
          email: socket.user?.email
        });
        
        if (socket.userId) {
          this.connectedUsers.delete(socket.userId);
          console.log(`🗑️ Removed user ${socket.user.email} from connected users map`);
          
          // Emit user offline status
          socket.broadcast.emit('user:offline', {
            userId: socket.userId
          });
          console.log(`📡 Broadcasted offline status for user ${socket.user.email}`);
        }
      });
    });
  }

  private async joinUserConversations(socket: AuthenticatedSocket) {
    try {
      const conversations = await Conversation.find({
        participants: socket.userId,
        isActive: true
      }).select('_id');

      conversations.forEach(conv => {
        socket.join(`conversation:${conv._id}`);
      });

      console.log(`📱 User ${socket.user?.firstName} joined ${conversations.length} conversations`);
    } catch (error) {
      console.error('Error joining user conversations:', error);
    }
  }

  private async handleSendMessage(socket: AuthenticatedSocket, data: any) {
    try {
      const { conversationId, content, type = 'text', attachments = [], replyTo } = data;

      // Verify user is participant of conversation
      const conversation = await Conversation.findById(conversationId);
      if (!conversation || !conversation.isParticipant(socket.userId!)) {
        socket.emit('error', { message: 'Not authorized to send message to this conversation' });
        return;
      }

      // Create message
      const message = new Message({
        conversation: conversationId,
        sender: socket.userId,
        content,
        type,
        attachments,
        replyTo,
        status: 'sent'
      });

      await message.save();

      // Populate message for response
      const populatedMessage = await Message.findById(message._id)
        .populate('sender', 'firstName lastName email role')
        .populate('replyTo', 'content sender type')
        .populate({
          path: 'replyTo',
          populate: { path: 'sender', select: 'firstName lastName' }
        });

      // Update conversation last activity and message
      conversation.lastMessage = message._id as any;
      conversation.lastActivity = new Date();
      await conversation.save();

      // Emit to all conversation participants
      this.io.to(`conversation:${conversationId}`).emit('message:new', {
        message: populatedMessage,
        conversationId
      });

      // Send notification to offline users
      const offlineParticipants = conversation.participants.filter(
        (participantId: any) => !this.connectedUsers.has(participantId.toString())
      );

      if (offlineParticipants.length > 0) {
        // TODO: Send push notifications to offline users
        console.log(`📧 Should send notifications to ${offlineParticipants.length} offline users`);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  private async handleJoinConversation(socket: AuthenticatedSocket, conversationId: string) {
    try {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation || !conversation.isParticipant(socket.userId!)) {
        socket.emit('error', { message: 'Not authorized to join this conversation' });
        return;
      }

      socket.join(`conversation:${conversationId}`);
      
      // Mark messages as delivered for this user
      await Message.updateMany(
        {
          conversation: conversationId,
          sender: { $ne: socket.userId },
          status: 'sent'
        },
        { status: 'delivered' }
      );

      socket.emit('conversation:joined', { conversationId });
    } catch (error) {
      console.error('Error joining conversation:', error);
      socket.emit('error', { message: 'Failed to join conversation' });
    }
  }

  private async handleMessageRead(socket: AuthenticatedSocket, data: any) {
    try {
      const { messageId, conversationId } = data;

      const message = await Message.findById(messageId);
      if (!message) {
        return;
      }

      // Mark message as read
      message.markAsRead(socket.userId!);
      await message.save();

      // Emit read status to conversation
      socket.to(`conversation:${conversationId}`).emit('message:read', {
        messageId,
        userId: socket.userId,
        user: socket.user
      });

    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }

  private async handleMessageReaction(socket: AuthenticatedSocket, data: any) {
    try {
      const { messageId, emoji, action } = data; // action: 'add' | 'remove'

      const message = await Message.findById(messageId);
      if (!message) {
        return;
      }

      if (action === 'add') {
        message.addReaction(emoji, socket.userId!);
      } else {
        message.removeReaction(emoji, socket.userId!);
      }

      await message.save();

      // Emit reaction update to conversation
      this.io.to(`conversation:${message.conversation}`).emit('message:reaction', {
        messageId,
        emoji,
        action,
        userId: socket.userId,
        user: socket.user,
        reactions: message.reactions
      });

    } catch (error) {
      console.error('Error handling message reaction:', error);
    }
  }

  // Public methods for external use
  public emitToUser(userId: string, event: string, data: any) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
    }
  }

  public emitToConversation(conversationId: string, event: string, data: any) {
    this.io.to(`conversation:${conversationId}`).emit(event, data);
  }

  public getConnectedUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  // Intervention Request specific methods
  public async emitNewInterventionRequest(interventionRequest: any) {
    try {
      // Import User model here to avoid circular dependency
      const { User } = await import('../models/User');
      
      // Get all workshop users
      const workshopUsers = await User.find({ 
        role: 'Workshop', 
        isActive: true 
      }).select('_id firstName lastName email role');

      console.log(`📋 Emitting new intervention request to ${workshopUsers.length} workshop users`);

      // Emit to all online workshop users
      workshopUsers.forEach(user => {
        const userId = (user._id as any).toString();
        if (this.connectedUsers.has(userId)) {
          console.log(`🔧 Sending intervention notification to workshop user: ${user.email}`);
          this.emitToUser(userId, 'intervention:new', {
            message: `New intervention request: ${interventionRequest.title}`,
            request: interventionRequest,
            priority: interventionRequest.priority,
            isEmergency: interventionRequest.isEmergency,
            submittedBy: interventionRequest.submittedBy
          });
        }
      });

      // Also emit to administrators
      const adminUsers = await User.find({ 
        role: 'Administrator', 
        isActive: true 
      }).select('_id firstName lastName email role');

      adminUsers.forEach(user => {
        const userId = (user._id as any).toString();
        if (this.connectedUsers.has(userId)) {
          console.log(`👑 Sending intervention notification to admin: ${user.email}`);
          this.emitToUser(userId, 'intervention:new', {
            message: `New intervention request: ${interventionRequest.title}`,
            request: interventionRequest,
            priority: interventionRequest.priority,
            isEmergency: interventionRequest.isEmergency,
            submittedBy: interventionRequest.submittedBy
          });
        }
      });

    } catch (error) {
      console.error('❌ Error emitting new intervention request:', error);
    }
  }

  public emitInterventionStatusUpdate(interventionRequest: any, updatedBy: any, oldStatus: string) {
    try {
      console.log(`📋 Emitting intervention status update: ${interventionRequest._id}`);
      
      // Emit to the original requester
      const requesterId = interventionRequest.submittedBy._id || interventionRequest.submittedBy;
      if (this.connectedUsers.has(requesterId.toString())) {
        console.log(`📤 Sending status update to requester: ${interventionRequest.submittedBy.email || 'Unknown'}`);
        this.emitToUser(requesterId.toString(), 'intervention:statusUpdate', {
          message: `Your intervention request "${interventionRequest.title}" status changed from ${oldStatus} to ${interventionRequest.status}`,
          request: interventionRequest,
          oldStatus,
          newStatus: interventionRequest.status,
          updatedBy: {
            firstName: updatedBy.firstName,
            lastName: updatedBy.lastName,
            role: updatedBy.role
          }
        });
      }

      // If request is assigned, emit to the assigned workshop member
      if (interventionRequest.workshopAssignedTo) {
        const assignedUserId = interventionRequest.workshopAssignedTo._id || interventionRequest.workshopAssignedTo;
        if (this.connectedUsers.has(assignedUserId.toString())) {
          console.log(`👷 Sending assignment notification to workshop member`);
          this.emitToUser(assignedUserId.toString(), 'intervention:assigned', {
            message: `You have been assigned intervention request: ${interventionRequest.title}`,
            request: interventionRequest,
            assignedBy: {
              firstName: updatedBy.firstName,
              lastName: updatedBy.lastName,
              role: updatedBy.role
            }
          });
        }
      }

    } catch (error) {
      console.error('❌ Error emitting intervention status update:', error);
    }
  }

  public emitInterventionComment(interventionRequest: any, comment: any) {
    try {
      console.log(`💬 Emitting new comment on intervention request: ${interventionRequest._id}`);
      
      // Emit to the original requester if they're not the commenter
      const requesterId = interventionRequest.submittedBy._id || interventionRequest.submittedBy;
      const commenterId = comment.user._id || comment.user;
      
      if (requesterId.toString() !== commenterId.toString() && this.connectedUsers.has(requesterId.toString())) {
        this.emitToUser(requesterId.toString(), 'intervention:comment', {
          message: `New comment on your intervention request: ${interventionRequest.title}`,
          request: interventionRequest,
          comment: comment,
          commenter: {
            firstName: comment.user.firstName,
            lastName: comment.user.lastName,
            role: comment.user.role
          }
        });
      }

      // Emit to assigned workshop member if they're not the commenter
      if (interventionRequest.workshopAssignedTo) {
        const assignedUserId = interventionRequest.workshopAssignedTo._id || interventionRequest.workshopAssignedTo;
        if (assignedUserId.toString() !== commenterId.toString() && this.connectedUsers.has(assignedUserId.toString())) {
          this.emitToUser(assignedUserId.toString(), 'intervention:comment', {
            message: `New comment on assigned intervention request: ${interventionRequest.title}`,
            request: interventionRequest,
            comment: comment,
            commenter: {
              firstName: comment.user.firstName,
              lastName: comment.user.lastName,
              role: comment.user.role
            }
          });
        }
      }

    } catch (error) {
      console.error('❌ Error emitting intervention comment:', error);
    }
  }
}

// Global socket manager instance
let socketManagerInstance: SocketManager | null = null;

export const initializeSocketManager = (httpServer: HttpServer): SocketManager => {
  socketManagerInstance = new SocketManager(httpServer);
  return socketManagerInstance;
};

export const getSocketManager = (): SocketManager | null => {
  return socketManagerInstance;
};

export default SocketManager; 