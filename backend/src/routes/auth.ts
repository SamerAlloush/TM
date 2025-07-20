import express from 'express';
import {
  register,
  verifyOTP,
  resendOTP,
  login,
  getMe,
  updateProfile,
  changePassword,
  logout
} from '../controllers/authController';
import { protect } from '../middleware/auth';
import {
  validateRegistration,
  validateLogin,
  validatePasswordChange,
  validateOTPVerification,
  validateResendOTP
} from '../middleware/validate';

const router = express.Router();

// Public routes
router.post('/register', validateRegistration, register);
router.post('/verify-otp', validateOTPVerification, verifyOTP);
router.post('/resend-otp', validateResendOTP, resendOTP);
router.post('/login', validateLogin, login);

// Protected routes
router.get('/me', protect, getMe);
router.put('/me', protect, updateProfile);
router.put('/change-password', protect, validatePasswordChange, changePassword);
router.post('/logout', protect, logout);

export default router; 