import mongoose, { Document, Schema } from 'mongoose';

export interface ITask extends Document {
  title: string;
  description?: string;
  site: mongoose.Types.ObjectId;
  assignedTo: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  status: 'Not Started' | 'In Progress' | 'On Hold' | 'Completed' | 'Cancelled';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  startDate?: Date;
  dueDate?: Date;
  completedDate?: Date;
  estimatedHours?: number;
  actualHours?: number;
  category: 'Planning' | 'Foundation' | 'Structure' | 'Electrical' | 'Plumbing' | 'Finishing' | 'Inspection' | 'Other';
  dependencies: mongoose.Types.ObjectId[];
  attachments: string[];
  comments: {
    user: mongoose.Types.ObjectId;
    text: string;
    createdAt: Date;
  }[];
  tags: string[];
  location?: string;
  materials?: {
    name: string;
    quantity: number;
    unit: string;
    cost?: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>({
  title: {
    type: String,
    required: [true, 'Please add a task title'],
    trim: true,
    maxlength: [100, 'Task title cannot be more than 100 characters']
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  site: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    required: [true, 'Please assign task to a site']
  },
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Task must have a creator']
  },
  status: {
    type: String,
    enum: ['Not Started', 'In Progress', 'On Hold', 'Completed', 'Cancelled'],
    default: 'Not Started'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  startDate: {
    type: Date
  },
  dueDate: {
    type: Date
  },
  completedDate: {
    type: Date
  },
  estimatedHours: {
    type: Number,
    min: [0, 'Estimated hours cannot be negative']
  },
  actualHours: {
    type: Number,
    min: [0, 'Actual hours cannot be negative']
  },
  category: {
    type: String,
    enum: ['Planning', 'Foundation', 'Structure', 'Electrical', 'Plumbing', 'Finishing', 'Inspection', 'Other'],
    default: 'Other'
  },
  dependencies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }],
  attachments: [{
    type: String
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
      maxlength: [500, 'Comment cannot be more than 500 characters']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  tags: [{
    type: String,
    trim: true
  }],
  location: {
    type: String,
    maxlength: [100, 'Location cannot be more than 100 characters']
  },
  materials: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [0, 'Quantity cannot be negative']
    },
    unit: {
      type: String,
      required: true,
      trim: true
    },
    cost: {
      type: Number,
      min: [0, 'Cost cannot be negative']
    }
  }]
}, {
  timestamps: true
});

// Virtual for overdue status
taskSchema.virtual('isOverdue').get(function() {
  if (!this.dueDate || this.status === 'Completed' || this.status === 'Cancelled') {
    return false;
  }
  return new Date() > this.dueDate;
});

// Virtual for duration
taskSchema.virtual('duration').get(function() {
  if (this.startDate && this.completedDate) {
    return Math.ceil((this.completedDate.getTime() - this.startDate.getTime()) / (1000 * 60 * 60 * 24));
  }
  return null;
});

// Middleware to set completedDate when status changes to 'Completed'
taskSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'Completed' && !this.completedDate) {
    this.completedDate = new Date();
  }
  next();
});

// Create indexes for better performance
taskSchema.index({ site: 1 });
taskSchema.index({ assignedTo: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ priority: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ category: 1 });
taskSchema.index({ createdBy: 1 });

export const Task = mongoose.model<ITask>('Task', taskSchema); 