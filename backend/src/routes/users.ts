import express from 'express';
import { protect, authorize } from '../middleware/auth';
import {
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  updateUserStatus,
  getMessagingContacts
} from '../controllers/userController';

const router = express.Router();

// All routes require authentication
router.use(protect);

// @route   GET /api/users
// @desc    Get all users
// @access  Admin, RH
router.get('/', authorize('Administrator', 'RH'), getUsers);

// @route   GET /api/users/contacts
// @desc    Get users for messaging/contacts
// @access  All authenticated users
router.get('/contacts', getMessagingContacts);

// @route   GET /api/users/:id
// @desc    Get single user
// @access  Admin, RH, or own profile
router.get('/:id', getUser);

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Admin, RH
router.put('/:id', authorize('Administrator', 'RH'), updateUser);

// @route   PUT /api/users/:id/status
// @desc    Update user status (activate/deactivate)
// @access  Admin, RH
router.put('/:id/status', authorize('Administrator', 'RH'), updateUserStatus);

// @route   DELETE /api/users/:id
// @desc    Delete user
// @access  Admin only
router.delete('/:id', authorize('Administrator'), deleteUser);

export default router; 