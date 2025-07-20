import express from 'express';
import {
  submitInterventionRequest,
  getInterventionRequests,
  getInterventionRequest,
  updateRequestStatus,
  addComment,
  assignToWorkshop,
  getInterventionStats
} from '../controllers/interventionController';
import { protect, requireInterventionAccess, authorize } from '../middleware/auth';

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// @route   GET /api/intervention-requests/stats
// @desc    Get intervention request statistics
// @access  Private (role-based)
router.get('/stats', getInterventionStats);

// @route   POST /api/intervention-requests
// @desc    Submit new intervention request
// @access  Worker, Conductors of Work, Project Manager, Administrator
router.post('/', requireInterventionAccess, submitInterventionRequest);

// @route   GET /api/intervention-requests
// @desc    Get all intervention requests (filtered by role)
// @access  Private (role-based filtering)
router.get('/', getInterventionRequests);

// @route   GET /api/intervention-requests/:id
// @desc    Get single intervention request
// @access  Private (role-based access)
router.get('/:id', getInterventionRequest);

// @route   PUT /api/intervention-requests/:id/status
// @desc    Update intervention request status
// @access  Workshop, Administrator
router.put('/:id/status', authorize('Workshop', 'Administrator'), updateRequestStatus);

// @route   PUT /api/intervention-requests/:id/assign
// @desc    Assign request to workshop member
// @access  Workshop, Administrator
router.put('/:id/assign', authorize('Workshop', 'Administrator'), assignToWorkshop);

// @route   POST /api/intervention-requests/:id/comments
// @desc    Add comment to intervention request
// @access  Private (request participants + workshop + admin)
router.post('/:id/comments', addComment);

export default router; 