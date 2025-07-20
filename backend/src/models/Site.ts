import mongoose, { Document, Schema } from 'mongoose';

export interface ISite extends Document {
  name: string;
  description?: string;
  address: string;
  city: string;
  postalCode: string;
  startDate: Date;
  expectedEndDate?: Date;
  actualEndDate?: Date;
  status: 'Planning' | 'Active' | 'On Hold' | 'Completed' | 'Cancelled';
  budget?: number;
  currentCost?: number;
  projectManager: mongoose.Types.ObjectId;
  assignedUsers: mongoose.Types.ObjectId[];
  tasks: mongoose.Types.ObjectId[];
  documents: string[];
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  clientName?: string;
  clientContact?: string;
  clientEmail?: string;
  clientPhone?: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  createdAt: Date;
  updatedAt: Date;
}

const siteSchema = new Schema<ISite>({
  name: {
    type: String,
    required: [true, 'Please add a site name'],
    trim: true,
    maxlength: [100, 'Site name cannot be more than 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  address: {
    type: String,
    required: [true, 'Please add an address'],
    maxlength: [200, 'Address cannot be more than 200 characters']
  },
  city: {
    type: String,
    required: [true, 'Please add a city'],
    maxlength: [50, 'City cannot be more than 50 characters']
  },
  postalCode: {
    type: String,
    required: [true, 'Please add a postal code'],
    match: [/^\d{5}$/, 'Please add a valid postal code']
  },
  startDate: {
    type: Date,
    required: [true, 'Please add a start date']
  },
  expectedEndDate: {
    type: Date
  },
  actualEndDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['Planning', 'Active', 'On Hold', 'Completed', 'Cancelled'],
    default: 'Planning'
  },
  budget: {
    type: Number,
    min: [0, 'Budget cannot be negative']
  },
  currentCost: {
    type: Number,
    min: [0, 'Current cost cannot be negative'],
    default: 0
  },
  projectManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please assign a project manager']
  },
  assignedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  tasks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }],
  documents: [{
    type: String
  }],
  coordinates: {
    latitude: {
      type: Number,
      min: [-90, 'Latitude must be between -90 and 90'],
      max: [90, 'Latitude must be between -90 and 90']
    },
    longitude: {
      type: Number,
      min: [-180, 'Longitude must be between -180 and 180'],
      max: [180, 'Longitude must be between -180 and 180']
    }
  },
  clientName: {
    type: String,
    maxlength: [100, 'Client name cannot be more than 100 characters']
  },
  clientContact: {
    type: String,
    maxlength: [100, 'Client contact cannot be more than 100 characters']
  },
  clientEmail: {
    type: String,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  clientPhone: {
    type: String,
    match: [/^\+?[1-9]\d{1,14}$/, 'Please add a valid phone number']
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  }
}, {
  timestamps: true
});

// Virtual for completion percentage
siteSchema.virtual('completionPercentage').get(function() {
  if (this.status === 'Completed') return 100;
  if (this.status === 'Cancelled') return 0;
  
  // This would be calculated based on completed tasks in a real implementation
  return 0;
});

// Create indexes for better performance
siteSchema.index({ status: 1 });
siteSchema.index({ projectManager: 1 });
siteSchema.index({ startDate: 1 });
siteSchema.index({ priority: 1 });
siteSchema.index({ 'coordinates.latitude': 1, 'coordinates.longitude': 1 });

export const Site = mongoose.model<ISite>('Site', siteSchema); 