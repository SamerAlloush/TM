import mongoose, { Document, Schema } from 'mongoose';

export interface IInterventionRequest extends Document {
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'Submitted' | 'Transferred to Workshop' | 'In Progress' | 'Completed' | 'Cancelled' | 'Rejected';
  submittedBy: mongoose.Types.ObjectId;
  relatedSite?: mongoose.Types.ObjectId;
  relatedTask?: mongoose.Types.ObjectId;
  equipmentLocation?: string;
  equipmentDetails?: string;
  isEmergency: boolean;
  attachments: string[];
  workshopTransferredAt?: Date;
  workshopAssignedTo?: mongoose.Types.ObjectId;
  estimatedCompletionDate?: Date;
  actualCompletionDate?: Date;
  rejectionReason?: string;
  transferLog: {
    action: string;
    performedBy: mongoose.Types.ObjectId;
    timestamp: Date;
    notes?: string;
  }[];
  comments: {
    user: mongoose.Types.ObjectId;
    text: string;
    createdAt: Date;
    isFromWorkshop: boolean;
  }[];
  workshopNotes?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  addTransferLog(action: string, performedBy: string, notes?: string): Promise<IInterventionRequest>;
  transferToWorkshop(performedBy: string, assignedTo?: string): Promise<IInterventionRequest>;
  addComment(userId: string, text: string, isFromWorkshop?: boolean): Promise<IInterventionRequest>;
}

const interventionRequestSchema = new Schema<IInterventionRequest>({
  title: {
    type: String,
    required: [true, 'Please add a request title'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Please provide a description'],
    maxlength: [2000, 'Description cannot be more than 2000 characters']
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  status: {
    type: String,
    enum: ['Submitted', 'Transferred to Workshop', 'In Progress', 'Completed', 'Cancelled', 'Rejected'],
    default: 'Submitted'
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Request must have a submitter']
  },
  relatedSite: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site'
  },
  relatedTask: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  },
  equipmentLocation: {
    type: String,
    maxlength: [300, 'Equipment location cannot be more than 300 characters']
  },
  equipmentDetails: {
    type: String,
    maxlength: [500, 'Equipment details cannot be more than 500 characters']
  },
  isEmergency: {
    type: Boolean,
    default: false
  },
  attachments: [{
    type: String
  }],
  workshopTransferredAt: {
    type: Date
  },
  workshopAssignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  estimatedCompletionDate: {
    type: Date
  },
  actualCompletionDate: {
    type: Date
  },
  rejectionReason: {
    type: String,
    maxlength: [500, 'Rejection reason cannot be more than 500 characters']
  },
  transferLog: [{
    action: {
      type: String,
      required: true,
      maxlength: [100, 'Action description cannot be more than 100 characters']
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot be more than 500 characters']
    }
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    text: {
      type: String,
      required: true,
      maxlength: [1000, 'Comment cannot be more than 1000 characters']
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    isFromWorkshop: {
      type: Boolean,
      default: false
    }
  }],
  workshopNotes: {
    type: String,
    maxlength: [2000, 'Workshop notes cannot be more than 2000 characters']
  }
}, {
  timestamps: true
});

// Index for better performance
interventionRequestSchema.index({ submittedBy: 1 });
interventionRequestSchema.index({ status: 1 });
interventionRequestSchema.index({ priority: 1 });
interventionRequestSchema.index({ createdAt: -1 });
interventionRequestSchema.index({ relatedSite: 1 });

// Virtual for checking if request is overdue
interventionRequestSchema.virtual('isOverdue').get(function() {
  if (!this.estimatedCompletionDate || this.status === 'Completed') return false;
  return new Date() > this.estimatedCompletionDate;
});

// Method to add transfer log entry
interventionRequestSchema.methods.addTransferLog = function(action: string, performedBy: string, notes?: string) {
  this.transferLog.push({
    action,
    performedBy,
    timestamp: new Date(),
    notes
  });
  return this.save();
};

// Method to transfer to workshop
interventionRequestSchema.methods.transferToWorkshop = function(performedBy: string, assignedTo?: string) {
  this.status = 'Transferred to Workshop';
  this.workshopTransferredAt = new Date();
  if (assignedTo) {
    this.workshopAssignedTo = assignedTo;
  }
  this.addTransferLog('Transferred to Workshop', performedBy, 'Request automatically transferred to workshop');
  return this.save();
};

// Method to add comment
interventionRequestSchema.methods.addComment = function(userId: string, text: string, isFromWorkshop: boolean = false) {
  this.comments.push({
    user: userId,
    text,
    createdAt: new Date(),
    isFromWorkshop
  });
  return this.save();
};

export const InterventionRequest = mongoose.model<IInterventionRequest>('InterventionRequest', interventionRequestSchema); 