import mongoose, { Document, Schema } from 'mongoose';

export interface IConversation extends Document {
  participants: mongoose.Types.ObjectId[];
  type: 'direct' | 'group';
  name?: string; // For group conversations
  lastMessage?: mongoose.Types.ObjectId;
  lastActivity: Date;
  createdBy: mongoose.Types.ObjectId;
  isActive: boolean;
  metadata: {
    unreadCounts: Map<string, number>;
    pinnedBy: mongoose.Types.ObjectId[];
    archivedBy: mongoose.Types.ObjectId[];
  };
  createdAt: Date;
  updatedAt: Date;
  
  // Method declarations
  isParticipant(userId: string): boolean;
  addParticipant(userId: string): void;
  removeParticipant(userId: string): void;
}

const conversationSchema = new Schema<IConversation>({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  type: {
    type: String,
    enum: ['direct', 'group'],
    default: 'direct'
  },
  name: {
    type: String,
    maxlength: [100, 'Conversation name cannot exceed 100 characters']
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  metadata: {
    unreadCounts: {
      type: Map,
      of: Number,
      default: new Map()
    },
    pinnedBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    archivedBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  }
}, {
  timestamps: true
});

// Indexes for better performance
conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastActivity: -1 });
conversationSchema.index({ createdBy: 1 });

// Virtual for participant count
conversationSchema.virtual('participantCount').get(function() {
  return this.participants.length;
});

// Method to check if user is participant (handles both populated and non-populated documents)
conversationSchema.methods.isParticipant = function(userId: string) {
  return this.participants.some((participant: any) => {
    // Handle populated documents (participant is a user object with _id)
    if (participant._id) {
      return participant._id.toString() === userId.toString();
    }
    // Handle non-populated documents (participant is just an ObjectId)
    return participant.toString() === userId.toString();
  });
};

// Method to add participant
conversationSchema.methods.addParticipant = function(userId: string) {
  if (!this.isParticipant(userId)) {
    this.participants.push(new mongoose.Types.ObjectId(userId));
  }
};

// Method to remove participant
conversationSchema.methods.removeParticipant = function(userId: string) {
  this.participants = this.participants.filter((id: mongoose.Types.ObjectId) => id.toString() !== userId.toString());
};

// Pre-save middleware
conversationSchema.pre('save', function(next) {
  // Ensure at least 2 participants for direct conversation
  if (this.type === 'direct' && this.participants.length !== 2) {
    throw new Error('Direct conversation must have exactly 2 participants');
  }
  
  // Group conversations need a name
  if (this.type === 'group' && this.participants.length > 2 && !this.name) {
    this.name = `Group Chat (${this.participants.length} members)`;
  }
  
  next();
});

export const Conversation = mongoose.model<IConversation>('Conversation', conversationSchema); 