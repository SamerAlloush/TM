import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: 'Administrator' | 'RH' | 'Purchase Department' | 'Worker' | 'Workshop' | 'Conductors of Work' | 'Accounting' | 'Bureau d\'Études' | 'Project Manager';
  phone?: string;
  address?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  profileImage?: string;
  assignedSites: mongoose.Types.ObjectId[];
  permissions: string[];
  // Email service credentials
  emailServiceCredentials?: {
    provider: 'gmail' | 'outlook' | 'yahoo' | 'other';
    emailPassword: string; // Encrypted email service password
    hasCredentials: boolean;
    lastVerified?: Date;
    isOAuthEnabled?: boolean;
    oauthTokens?: {
      accessToken?: string;
      refreshToken?: string;
      expiresAt?: Date;
    };
  };
  comparePassword(candidatePassword: string): Promise<boolean>;
  setEmailCredentials(emailPassword: string): void;
  getEmailCredentials(): string | null;
  hasValidEmailCredentials(): boolean;
}

const userSchema = new Schema<IUser>({
  firstName: {
    type: String,
    required: [true, 'Please add a first name'],
    trim: true,
    maxlength: [50, 'First name cannot be more than 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Please add a last name'],
    trim: true,
    maxlength: [50, 'Last name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
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
    ],
    required: [true, 'Please specify a role']
  },
  phone: {
    type: String,
    match: [/^\+?[1-9]\d{1,14}$/, 'Please add a valid phone number']
  },
  address: {
    type: String,
    maxlength: [200, 'Address cannot be more than 200 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  profileImage: {
    type: String
  },
  assignedSites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site'
  }],
  permissions: [{
    type: String
  }],
  // Email service credentials with encryption
  emailServiceCredentials: {
    provider: {
      type: String,
      enum: ['gmail', 'outlook', 'yahoo', 'other'],
      required: false
    },
    emailPassword: {
      type: String,
      required: false,
      select: false // Don't include in queries by default
    },
    hasCredentials: {
      type: Boolean,
      default: false
    },
    lastVerified: {
      type: Date
    },
    isOAuthEnabled: {
      type: Boolean,
      default: false
    },
    oauthTokens: {
      accessToken: { type: String, select: false },
      refreshToken: { type: String, select: false },
      expiresAt: { type: Date }
    }
  }
}, {
  timestamps: true
});

// Encryption key for email passwords (use environment variable in production)
const getEncryptionKey = (): string => {
  return process.env.EMAIL_ENCRYPTION_KEY || 'default-dev-key-32-chars-long!!!';
};

// Encrypt email password before saving
const encryptEmailPassword = (password: string): string => {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher('aes-256-cbc', key);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

// Decrypt email password when retrieving
const decryptEmailPassword = (encryptedPassword: string): string => {
  const key = getEncryptionKey();
  const textParts = encryptedPassword.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = textParts.join(':');
  const decipher = crypto.createDecipher('aes-256-cbc', key);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

// Detect email provider from email address
const detectEmailProvider = (email: string): 'gmail' | 'outlook' | 'yahoo' | 'other' => {
  const domain = email.split('@')[1]?.toLowerCase();
  
  if (domain === 'gmail.com') return 'gmail';
  if (['outlook.com', 'hotmail.com', 'live.com'].includes(domain)) return 'outlook';
  if (['yahoo.com', 'yahoo.co.uk', 'yahoo.fr'].includes(domain)) return 'yahoo';
  
  return 'other';
};

// Encrypt password using bcrypt
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Auto-detect email provider when email changes
userSchema.pre('save', function(next) {
  if (this.isModified('email')) {
    if (!this.emailServiceCredentials) {
      this.emailServiceCredentials = {
        provider: detectEmailProvider(this.email),
        emailPassword: '',
        hasCredentials: false
      };
    } else {
      this.emailServiceCredentials.provider = detectEmailProvider(this.email);
    }
  }
  next();
});

// Match user entered password to hashed password in database
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Set encrypted email credentials
userSchema.methods.setEmailCredentials = function(emailPassword: string): void {
  if (!this.emailServiceCredentials) {
    this.emailServiceCredentials = {
      provider: detectEmailProvider(this.email),
      emailPassword: '',
      hasCredentials: false
    };
  }
  
  this.emailServiceCredentials.emailPassword = encryptEmailPassword(emailPassword);
  this.emailServiceCredentials.hasCredentials = true;
  this.emailServiceCredentials.lastVerified = new Date();
};

// Get decrypted email credentials
userSchema.methods.getEmailCredentials = function(): string | null {
  if (!this.emailServiceCredentials?.hasCredentials || !this.emailServiceCredentials.emailPassword) {
    return null;
  }
  
  try {
    return decryptEmailPassword(this.emailServiceCredentials.emailPassword);
  } catch (error) {
    console.error('Failed to decrypt email credentials:', error);
    return null;
  }
};

// Check if user has valid email credentials
userSchema.methods.hasValidEmailCredentials = function(): boolean {
  return !!(this.emailServiceCredentials?.hasCredentials && this.emailServiceCredentials.emailPassword);
};

// Create index for better performance
// Note: email index is automatically created by unique: true constraint
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ 'emailServiceCredentials.provider': 1 });
userSchema.index({ 'emailServiceCredentials.hasCredentials': 1 });

export const User = mongoose.model<IUser>('User', userSchema); 