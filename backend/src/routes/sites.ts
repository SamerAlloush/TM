import express from 'express';
import { protect, authorize } from '../middleware/auth';
import {
  getSites,
  getSite,
  createSite,
  updateSite,
  deleteSite,
  assignUserToSite,
  removeUserFromSite
} from '../controllers/siteController';

const router = express.Router();

// All routes require authentication
router.use(protect);

// @route   GET /api/sites
// @desc    Get all sites
// @access  All authenticated users
router.get('/', getSites);

// @route   GET /api/sites/:id
// @desc    Get single site
// @access  All authenticated users
router.get('/:id', getSite);

// @route   POST /api/sites
// @desc    Create new site
// @access  Admin, RH, Bureau d'Études
router.post('/', authorize('Administrator', 'RH', 'Bureau d\'Études'), createSite);

// @route   PUT /api/sites/:id
// @desc    Update site
// @access  Admin, RH, Bureau d'Études
router.put('/:id', authorize('Administrator', 'RH', 'Bureau d\'Études'), updateSite);

// @route   DELETE /api/sites/:id
// @desc    Delete site
// @access  Admin only
router.delete('/:id', authorize('Administrator'), deleteSite);

// @route   POST /api/sites/:id/assign-user
// @desc    Assign user to site
// @access  Admin, RH, Bureau d'Études
router.post('/:id/assign-user', authorize('Administrator', 'RH', 'Bureau d\'Études'), assignUserToSite);

// @route   DELETE /api/sites/:id/remove-user/:userId
// @desc    Remove user from site
// @access  Admin, RH, Bureau d'Études
router.delete('/:id/remove-user/:userId', authorize('Administrator', 'RH', 'Bureau d\'Études'), removeUserFromSite);

export default router; 