import mongoose, { Document, Schema } from 'mongoose';

export interface IOTP extends Document {
  email: string;
  otp: string;
  userData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role: string;
    phone?: string;
    address?: string;
  };
  attempts: number;
  isVerified: boolean;
  expiresAt: Date;
  createdAt: Date;
}

const otpSchema = new Schema<IOTP>({
  email: {
    type: String,
    required: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  otp: {
    type: String,
    required: true,
    length: 6
  },
  userData: {
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      required: true,
      enum: [
        'Administrator',
        'RH',
        'Purchase Department',
        'Mechanics',
        'Workshop',
        'Conductors of Work',
        'Accounting',
        'Bureau d\'Études'
      ]
    },
    phone: String,
    address: String
  },
  attempts: {
    type: Number,
    default: 0,
    max: 3
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from creation
    expires: 600 // 10 minutes - this creates the TTL index automatically
  }
}, {
  timestamps: true
});

// Create index for email queries only (expiresAt index is created automatically by expires option)
otpSchema.index({ email: 1 });

export const OTP = mongoose.model<IOTP>('OTP', otpSchema); 