import express from 'express';
import { protect, authorize } from '../middleware/auth';
import {
  getDashboardStats,
  getSiteOverview,
  getTaskSummary,
  getRecentActivity,
  getUserPerformance,
  getProjectProgress,
  getAbsenceCalendar,
  getNotifications
} from '../controllers/dashboardController';

const router = express.Router();

// All routes require authentication
router.use(protect);

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics
// @access  All authenticated users (filtered by role)
router.get('/stats', getDashboardStats);

// @route   GET /api/dashboard/site-overview
// @desc    Get site overview for dashboard
// @access  All authenticated users
router.get('/site-overview', getSiteOverview);

// @route   GET /api/dashboard/task-summary
// @desc    Get task summary for current user
// @access  All authenticated users
router.get('/task-summary', getTaskSummary);

// @route   GET /api/dashboard/recent-activity
// @desc    Get recent activity
// @access  All authenticated users
router.get('/recent-activity', getRecentActivity);

// @route   GET /api/dashboard/user-performance
// @desc    Get user performance metrics
// @access  Admin, RH, or own performance
router.get('/user-performance', getUserPerformance);

// @route   GET /api/dashboard/project-progress
// @desc    Get project progress overview
// @access  Admin, RH, Bureau d'Études, Conductors of Work
router.get('/project-progress', authorize('Administrator', 'RH', 'Bureau d\'Études', 'Conductors of Work'), getProjectProgress);

// @route   GET /api/dashboard/absence-calendar
// @desc    Get absence calendar data
// @access  Admin, RH, or own calendar
router.get('/absence-calendar', getAbsenceCalendar);

// @route   GET /api/dashboard/notifications
// @desc    Get user notifications
// @access  All authenticated users
router.get('/notifications', getNotifications);

export default router; 