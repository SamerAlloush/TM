import mongoose, { Document as MongoDocument, Schema } from 'mongoose';

export interface IDocument extends MongoDocument {
  title: string;
  description?: string;
  documentType: 'Absence Request' | 'Material Request' | 'Workshop Intervention' | 'Depot Return' | 'HR Document' | 'Recruitment' | 'QSES Audit' | 'QQOQC Audit' | 'BL Upload' | 'Daily Planning' | 'Admin Document' | 'Accounting Document' | 'Other';
  category: 'Form' | 'Report' | 'Certificate' | 'Invoice' | 'Contract' | 'Photo' | 'Video' | 'Other';
  filePath: string;
  originalFileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: mongoose.Types.ObjectId;
  relatedSite?: mongoose.Types.ObjectId;
  relatedTask?: mongoose.Types.ObjectId;
  relatedUser?: mongoose.Types.ObjectId;
  status: 'Draft' | 'Pending Review' | 'Approved' | 'Rejected' | 'Archived';
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  version: number;
  isPublic: boolean;
  accessPermissions: {
    roles: string[];
    users: mongoose.Types.ObjectId[];
  };
  tags: string[];
  expiryDate?: Date;
  workflowStage?: string;
  formData?: any;
  comments: {
    user: mongoose.Types.ObjectId;
    text: string;
    createdAt: Date;
  }[];
  downloadCount: number;
  lastDownloadedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<IDocument>({
  title: {
    type: String,
    required: [true, 'Please add a document title'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  documentType: {
    type: String,
    enum: [
      'Absence Request',
      'Material Request',
      'Workshop Intervention',
      'Depot Return',
      'HR Document',
      'Recruitment',
      'QSES Audit',
      'QQOQC Audit',
      'BL Upload',
      'Daily Planning',
      'Admin Document',
      'Accounting Document',
      'Other'
    ],
    required: [true, 'Please specify document type']
  },
  category: {
    type: String,
    enum: ['Form', 'Report', 'Certificate', 'Invoice', 'Contract', 'Photo', 'Video', 'Other'],
    default: 'Other'
  },
  filePath: {
    type: String,
    required: [true, 'File path is required']
  },
  originalFileName: {
    type: String,
    required: [true, 'Original file name is required']
  },
  fileSize: {
    type: Number,
    required: [true, 'File size is required'],
    min: [0, 'File size cannot be negative']
  },
  mimeType: {
    type: String,
    required: [true, 'MIME type is required']
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Document must have an uploader']
  },
  relatedSite: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site'
  },
  relatedTask: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  },
  relatedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['Draft', 'Pending Review', 'Approved', 'Rejected', 'Archived'],
    default: 'Draft'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  rejectionReason: {
    type: String,
    maxlength: [500, 'Rejection reason cannot be more than 500 characters']
  },
  version: {
    type: Number,
    default: 1,
    min: [1, 'Version must be at least 1']
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  accessPermissions: {
    roles: [{
      type: String,
      enum: [
        'Administrator',
        'RH',
        'Purchase Department',
        'Worker',
        'Workshop',
        'Conductors of Work',
        'Accounting',
        'Bureau d\'Études',
        'Project Manager'
      ]
    }],
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  tags: [{
    type: String,
    trim: true
  }],
  expiryDate: {
    type: Date
  },
  workflowStage: {
    type: String,
    maxlength: [100, 'Workflow stage cannot be more than 100 characters']
  },
  formData: {
    type: Schema.Types.Mixed
  },
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    text: {
      type: String,
      required: true,
      maxlength: [500, 'Comment cannot be more than 500 characters']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  downloadCount: {
    type: Number,
    default: 0,
    min: [0, 'Download count cannot be negative']
  },
  lastDownloadedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Virtual for checking if document is expired
documentSchema.virtual('isExpired').get(function() {
  if (!this.expiryDate) return false;
  return new Date() > this.expiryDate;
});

// Virtual for file size in readable format
documentSchema.virtual('readableFileSize').get(function() {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (this.fileSize === 0) return '0 Bytes';
  const i = Math.floor(Math.log(this.fileSize) / Math.log(1024));
  return Math.round(this.fileSize / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
});

// Pre-save middleware to set approval date
documentSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'Approved' && !this.approvedAt) {
    this.approvedAt = new Date();
  }
  next();
});

// Method to increment download count
documentSchema.methods.incrementDownloadCount = function() {
  this.downloadCount += 1;
  this.lastDownloadedAt = new Date();
  return this.save();
};

// Method to check if user has access to document
documentSchema.methods.hasAccess = function(user: any) {
  // Public documents are accessible to all
  if (this.isPublic) return true;
  
  // Check if user role is in allowed roles
  if (this.accessPermissions.roles.includes(user.role)) return true;
  
  // Check if user is specifically granted access
  if (this.accessPermissions.users.some((userId: any) => userId.toString() === user._id.toString())) return true;
  
  // Document uploader always has access
  if (this.uploadedBy.toString() === user._id.toString()) return true;
  
  // Administrator always has access
  if (user.role === 'Administrator') return true;
  
  return false;
};

// Create indexes for better performance
documentSchema.index({ uploadedBy: 1 });
documentSchema.index({ documentType: 1 });
documentSchema.index({ category: 1 });
documentSchema.index({ status: 1 });
documentSchema.index({ relatedSite: 1 });
documentSchema.index({ relatedTask: 1 });
documentSchema.index({ relatedUser: 1 });
documentSchema.index({ tags: 1 });
documentSchema.index({ createdAt: -1 });
documentSchema.index({ expiryDate: 1 });

export const Document = mongoose.model<IDocument>('Document', documentSchema); 