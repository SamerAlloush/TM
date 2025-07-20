import express from 'express';
import { protect, authorize } from '../middleware/auth';
import {
  getAbsences,
  getAbsence,
  createAbsenceRequest,
  updateAbsence,
  deleteAbsence,
  approveAbsence,
  rejectAbsence,
  declareAbsence,
  getMyAbsences,
  getPendingAbsences,
  getAbsencesByUser,
  getAbsenceHistory,
  getAbsenceCalendar
} from '../controllers/absenceController';

const router = express.Router();

// All routes require authentication
router.use(protect);

// @route   GET /api/absences
// @desc    Get all absences
// @access  Admin, RH
router.get('/', authorize('Administrator', 'RH'), getAbsences);

// @route   GET /api/absences/my-absences
// @desc    Get current user's absences
// @access  All authenticated users
router.get('/my-absences', getMyAbsences);

// @route   GET /api/absences/pending
// @desc    Get pending absence requests
// @access  Admin, RH
router.get('/pending', authorize('Administrator', 'RH'), getPendingAbsences);

// @route   GET /api/absences/user/:userId
// @desc    Get absences by user
// @access  Admin, RH, or own absences
router.get('/user/:userId', getAbsencesByUser);

// @route   GET /api/absences/:id
// @desc    Get single absence
// @access  Admin, RH, or requester
router.get('/:id', getAbsence);

// @route   POST /api/absences
// @desc    Create absence request
// @access  All authenticated users
router.post('/', createAbsenceRequest);

// @route   POST /api/absences/declare
// @desc    Declare absence for user
// @access  Admin, RH
router.post('/declare', authorize('Administrator', 'RH'), declareAbsence);

// @route   PUT /api/absences/:id
// @desc    Update absence request
// @access  Requester (if pending), Admin, RH
router.put('/:id', updateAbsence);

// @route   PUT /api/absences/:id/approve
// @desc    Approve absence request
// @access  Admin, RH
router.put('/:id/approve', authorize('Administrator', 'RH'), approveAbsence);

// @route   PUT /api/absences/:id/reject
// @desc    Reject absence request
// @access  Admin, RH
router.put('/:id/reject', authorize('Administrator', 'RH'), rejectAbsence);

// @route   DELETE /api/absences/:id
// @desc    Delete absence request
// @access  Requester (if pending), Admin
router.delete('/:id', deleteAbsence);

// @route   GET /api/absences/history/:userId
// @desc    Get user's absence history with calendar data
// @access  User can view own, Admin can view all
router.get('/history/:userId', getAbsenceHistory);

// @route   GET /api/absences/calendar/:userId
// @desc    Get absence calendar data for date range
// @access  User can view own, Admin can view all
router.get('/calendar/:userId', getAbsenceCalendar);

export default router; 