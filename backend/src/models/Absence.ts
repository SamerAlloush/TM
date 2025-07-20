import mongoose, { Document, Schema } from 'mongoose';

export interface IAbsence extends Document {
  user: mongoose.Types.ObjectId;
  type: 'Vacation' | 'Sick Leave' | 'Personal Leave' | 'Emergency' | 'Training' | 'Other';
  startDate: Date;
  endDate: Date;
  reason?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled' | 'Declared';
  requestType: 'Request' | 'Declaration';
  isFullDay: boolean;
  startTime?: string;
  endTime?: string;
  dayCount: number;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  documents: string[];
  comments: {
    user: mongoose.Types.ObjectId;
    text: string;
    createdAt: Date;
  }[];
  notificationSent: boolean;
  replacementUser?: mongoose.Types.ObjectId;
  affectedSites: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const absenceSchema = new Schema<IAbsence>({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Absence must be associated with a user']
  },
  type: {
    type: String,
    enum: ['Vacation', 'Sick Leave', 'Personal Leave', 'Emergency', 'Training', 'Other'],
    required: [true, 'Please specify absence type']
  },
  startDate: {
    type: Date,
    required: [true, 'Please specify start date']
  },
  endDate: {
    type: Date,
    required: [true, 'Please specify end date'],
    validate: {
      validator: function(this: IAbsence, value: Date) {
        return value >= this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  reason: {
    type: String,
    maxlength: [500, 'Reason cannot be more than 500 characters']
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Cancelled', 'Declared'],
    default: 'Pending'
  },
  requestType: {
    type: String,
    enum: ['Request', 'Declaration'],
    required: [true, 'Please specify request type']
  },
  isFullDay: {
    type: Boolean,
    default: true
  },
  startTime: {
    type: String,
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please provide valid time format (HH:MM)']
  },
  endTime: {
    type: String,
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please provide valid time format (HH:MM)']
  },
  dayCount: {
    type: Number,
    min: [0.5, 'Day count must be at least 0.5'],
    required: [true, 'Day count is required']
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
  documents: [{
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
  notificationSent: {
    type: Boolean,
    default: false
  },
  replacementUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  affectedSites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site'
  }]
}, {
  timestamps: true
});

// Virtual for duration in days
absenceSchema.virtual('duration').get(function() {
  const timeDiff = this.endDate.getTime() - this.startDate.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
});

// Virtual for checking if absence is current
absenceSchema.virtual('isCurrent').get(function() {
  const now = new Date();
  return this.startDate <= now && this.endDate >= now && this.status === 'Approved';
});

// Virtual for checking if absence is upcoming
absenceSchema.virtual('isUpcoming').get(function() {
  const now = new Date();
  return this.startDate > now && this.status === 'Approved';
});

// Pre-save middleware to calculate day count for full-day absences
absenceSchema.pre('save', function(next) {
  if (this.isFullDay && this.isModified('startDate') || this.isModified('endDate')) {
    const timeDiff = this.endDate.getTime() - this.startDate.getTime();
    this.dayCount = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
  }
  
  // Set approval date when status changes to approved
  if (this.isModified('status') && this.status === 'Approved' && !this.approvedAt) {
    this.approvedAt = new Date();
  }
  
  next();
});

// Create indexes for better performance
absenceSchema.index({ user: 1 });
absenceSchema.index({ startDate: 1 });
absenceSchema.index({ endDate: 1 });
absenceSchema.index({ status: 1 });
absenceSchema.index({ type: 1 });
absenceSchema.index({ requestType: 1 });
absenceSchema.index({ approvedBy: 1 });

export const Absence = mongoose.model<IAbsence>('Absence', absenceSchema); 