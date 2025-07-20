import mongoose, { Document, Schema } from 'mongoose';

export interface IAttachment {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  path?: string;
  thumbnailUrl?: string;
}

export interface IMessage extends Document {
  conversation: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  content: string;
  type: 'text' | 'image' | 'video' | 'document' | 'audio' | 'contact' | 'location' | 'system';
  attachments: IAttachment[];
  replyTo?: mongoose.Types.ObjectId;
  mentions: mongoose.Types.ObjectId[];
  reactions: Map<string, mongoose.Types.ObjectId[]>; // emoji -> user ids
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  readBy: Map<string, Date>; // userId -> timestamp
  editedAt?: Date;
  deletedAt?: Date;
  isDeleted: boolean;
  metadata: {
    deviceInfo?: string;
    location?: {
      latitude: number;
      longitude: number;
      address?: string;
    };
    emailSent?: boolean;
    emailRecipients?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
  
  // Method declarations
  markAsRead(userId: string): void;
  addReaction(emoji: string, userId: string): void;
  removeReaction(emoji: string, userId: string): void;
}

const attachmentSchema = new Schema<IAttachment>({
  fileName: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true,
    min: 0,
    max: 100 * 1024 * 1024 // 100MB limit
  },
  url: {
    type: String,
    required: true
  },
  path: {
    type: String
  },
  thumbnailUrl: {
    type: String
  }
}, { _id: false });

const messageSchema = new Schema<IMessage>({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    maxlength: [5000, 'Message content cannot exceed 5000 characters'],
    default: ''
  },
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'document', 'audio', 'contact', 'location', 'system'],
    default: 'text'
  },
  attachments: [attachmentSchema],
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  reactions: {
    type: Map,
    of: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    default: new Map()
  },
  status: {
    type: String,
    enum: ['sending', 'sent', 'delivered', 'read', 'failed'],
    default: 'sent'
  },
  readBy: {
    type: Map,
    of: Date,
    default: new Map()
  },
  editedAt: {
    type: Date
  },
  deletedAt: {
    type: Date
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  metadata: {
    deviceInfo: {
      type: String
    },
    location: {
      latitude: {
        type: Number,
        min: -90,
        max: 90
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180
      },
      address: {
        type: String
      }
    },
    emailSent: {
      type: Boolean,
      default: false
    },
    emailRecipients: [{
      type: String
    }]
  }
}, {
  timestamps: true
});

// Indexes for better performance
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ conversation: 1, sender: 1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ type: 1 });

// Text search index for message content
messageSchema.index({ 
  content: 'text',
  'attachments.originalName': 'text'
}, {
  weights: {
    content: 10,
    'attachments.originalName': 5
  },
  name: 'message_text_index'
});

// Virtual for checking if message has attachments
messageSchema.virtual('hasAttachments').get(function() {
  return this.attachments && this.attachments.length > 0;
});

// Virtual for getting attachment count
messageSchema.virtual('attachmentCount').get(function() {
  return this.attachments ? this.attachments.length : 0;
});

// Virtual for checking if message is edited
messageSchema.virtual('isEdited').get(function() {
  return !!this.editedAt;
});

// Method to mark as read by user
messageSchema.methods.markAsRead = function(userId: string) {
  this.readBy.set(userId, new Date());
  if (this.status === 'delivered') {
    this.status = 'read';
  }
};

// Method to add reaction
messageSchema.methods.addReaction = function(emoji: string, userId: string) {
  const reactions = this.reactions.get(emoji) || [];
  const userObjectId = new mongoose.Types.ObjectId(userId);
  
  if (!reactions.some((id: mongoose.Types.ObjectId) => id.toString() === userId)) {
    reactions.push(userObjectId);
    this.reactions.set(emoji, reactions);
  }
};

// Method to remove reaction
messageSchema.methods.removeReaction = function(emoji: string, userId: string) {
  const reactions = this.reactions.get(emoji) || [];
  const filteredReactions = reactions.filter((id: mongoose.Types.ObjectId) => id.toString() !== userId);
  
  if (filteredReactions.length === 0) {
    this.reactions.delete(emoji);
  } else {
    this.reactions.set(emoji, filteredReactions);
  }
};

// Pre-save middleware
messageSchema.pre('save', function(next) {
  // Validate content based on type
  if (this.type === 'text' && !this.content && this.attachments.length === 0) {
    throw new Error('Text message must have content or attachments');
  }
  
  // Auto-detect message type based on attachments
  if (this.attachments.length > 0 && this.type === 'text') {
    const firstAttachment = this.attachments[0];
    if (firstAttachment.mimeType.startsWith('image/')) {
      this.type = 'image';
    } else if (firstAttachment.mimeType.startsWith('video/')) {
      this.type = 'video';
    } else if (firstAttachment.mimeType.startsWith('audio/')) {
      this.type = 'audio';
    } else {
      this.type = 'document';
    }
  }
  
  next();
});

export const Message = mongoose.model<IMessage>('Message', messageSchema); 