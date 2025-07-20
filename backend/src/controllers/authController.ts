import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User } from '../models/User';
import { OTP } from '../models/OTP';
import { AuthenticatedRequest } from '../middleware/auth';
import { sendOTPEmail, sendWelcomeEmail } from '../config/email';

// Generate JWT token
const generateToken = (id: string): string => {
  return jwt.sign(
    { id }, 
    process.env.JWT_SECRET || 'fallback-secret',
    { expiresIn: '30d' }
  );
};

// Generate 6-digit OTP
const generateOTP = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};

// @desc    Initial registration - sends OTP to email
// @route   POST /api/auth/register
// @access  Public
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      role,
      phone,
      address
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({
        success: false,
        error: 'User already exists with this email'
      });
      return;
    }

    // Check if there's an existing pending OTP for this email
    await OTP.deleteMany({ email });

    // Generate OTP
    const otpCode = generateOTP();

    // Store OTP with user data
    const otpRecord = await OTP.create({
      email,
      otp: otpCode,
      userData: {
        firstName,
        lastName,
        email,
        password,
        role,
        phone,
        address
      }
    });
    
    console.log(`✅ OTP Record Created:`, {
      email: otpRecord.email,
      otp: otpRecord.otp,
      expiresAt: otpRecord.expiresAt,
      currentTime: new Date(),
      expiresInMinutes: Math.floor((otpRecord.expiresAt.getTime() - Date.now()) / (1000 * 60))
    });

    // Send OTP email
    const emailSent = await sendOTPEmail(email, otpCode, firstName);
    
    if (!emailSent) {
      await OTP.deleteOne({ _id: otpRecord._id });
      res.status(500).json({
        success: false,
        error: 'Failed to send verification email. Please try again.'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Verification code sent to your email. Please check your inbox.',
      data: {
        email,
        expiresIn: '10 minutes',
        attemptsLeft: 3
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify OTP and complete registration
// @route   POST /api/auth/verify-otp
// @access  Public
export const verifyOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, otp } = req.body;
    
    console.log(`🔍 OTP Verification Request - Email: ${email}, OTP: ${otp}`);

    if (!email || !otp) {
      res.status(400).json({
        success: false,
        error: 'Please provide email and OTP code'
      });
      return;
    }

    // Find OTP record
    const otpRecord = await OTP.findOne({ email, isVerified: false });
    
    console.log(`🔍 OTP Record found: ${otpRecord ? 'YES' : 'NO'}`);
    if (otpRecord) {
      console.log(`🔍 OTP Details:`, {
        storedOTP: otpRecord.otp,
        submittedOTP: otp,
        attempts: otpRecord.attempts,
        expiresAt: otpRecord.expiresAt,
        currentTime: new Date(),
        isExpired: otpRecord.expiresAt < new Date(),
        timeRemaining: Math.max(0, Math.floor((otpRecord.expiresAt.getTime() - Date.now()) / 1000))
      });
    }
    
    if (!otpRecord) {
      console.log(`❌ No OTP record found for email: ${email}`);
      
      // Check if there are any OTP records for this email (including verified ones)
      const anyRecord = await OTP.findOne({ email });
      console.log(`🔍 Any OTP record exists: ${anyRecord ? 'YES (verified: ' + anyRecord.isVerified + ')' : 'NO'}`);
      
      res.status(400).json({
        success: false,
        error: 'No pending verification found for this email'
      });
      return;
    }

    // Check if OTP has expired
    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      res.status(400).json({
        success: false,
        error: 'OTP has expired. Please request a new one.'
      });
      return;
    }

    // Check if maximum attempts exceeded
    if (otpRecord.attempts >= 3) {
      await OTP.deleteOne({ _id: otpRecord._id });
      res.status(400).json({
        success: false,
        error: 'Maximum verification attempts exceeded. Please register again.'
      });
      return;
    }

    // Verify OTP
    if (otpRecord.otp !== otp) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      
      const attemptsLeft = 3 - otpRecord.attempts;
      res.status(400).json({
        success: false,
        error: 'Invalid OTP code',
        attemptsLeft
      });
      return;
    }

    // OTP is valid, create the user
    const userData = otpRecord.userData;
    const user = await User.create(userData);

    // Mark OTP as verified
    otpRecord.isVerified = true;
    await otpRecord.save();

    // Clean up OTP record after successful verification
    await OTP.deleteOne({ _id: otpRecord._id });

    // Send welcome email
    await sendWelcomeEmail(user.email, user.firstName, user.lastName);

    // Generate token
    const token = generateToken(String(user._id));

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
        isActive: user.isActive
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
export const resendOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Please provide email address'
      });
      return;
    }

    // Find existing OTP record
    const existingOTP = await OTP.findOne({ email, isVerified: false });
    
    if (!existingOTP) {
      res.status(400).json({
        success: false,
        error: 'No pending verification found for this email'
      });
      return;
    }

    // Generate new OTP
    const newOtpCode = generateOTP();
    
    // Update OTP record
    existingOTP.otp = newOtpCode;
    existingOTP.attempts = 0;
    existingOTP.expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
    await existingOTP.save();

    // Send new OTP email
    const emailSent = await sendOTPEmail(email, newOtpCode, existingOTP.userData.firstName);
    
    if (!emailSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to send verification email. Please try again.'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'New verification code sent to your email.',
      data: {
        email,
        expiresIn: '10 minutes',
        attemptsLeft: 3
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate email and password
    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Please provide email and password'
      });
      return;
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
      return;
    }

    // Check if user is active
    if (!user.isActive) {
      res.status(401).json({
        success: false,
        error: 'Account is deactivated. Please contact administrator.'
      });
      return;
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
      return;
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(String(user._id));

    res.status(200).json({
      success: true,
      token,
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
        isActive: user.isActive,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.user.id)
      .populate('assignedSites', 'name address city status')
      .select('-password');

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/me
// @access  Private
export const updateProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const allowedFields = ['firstName', 'lastName', 'phone', 'address', 'profileImage'];
    const updateData: any = {};

    // Only allow certain fields to be updated
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    ).select('-password');

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
export const changePassword = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
      return;
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
}; 