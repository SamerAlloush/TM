import express from 'express';
import { protect, authorize } from '../middleware/auth';
import {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  assignTask,
  getTasksBySite,
  getMyTasks
} from '../controllers/taskController';

const router = express.Router();

// All routes require authentication
router.use(protect);

// @route   GET /api/tasks
// @desc    Get all tasks
// @access  Admin, RH, Bureau d'Études, Conductors of Work
router.get('/', authorize('Administrator', 'RH', 'Bureau d\'Études', 'Conductors of Work'), getTasks);

// @route   GET /api/tasks/my-tasks
// @desc    Get current user's tasks
// @access  All authenticated users
router.get('/my-tasks', getMyTasks);

// @route   GET /api/tasks/site/:siteId
// @desc    Get tasks by site
// @access  All authenticated users
router.get('/site/:siteId', getTasksBySite);

// @route   GET /api/tasks/:id
// @desc    Get single task
// @access  All authenticated users
router.get('/:id', getTask);

// @route   POST /api/tasks
// @desc    Create new task
// @access  Admin, RH, Bureau d'Études, Conductors of Work
router.post('/', authorize('Administrator', 'RH', 'Bureau d\'Études', 'Conductors of Work'), createTask);

// @route   PUT /api/tasks/:id
// @desc    Update task
// @access  Admin, RH, Bureau d'Études, Conductors of Work, or assigned user
router.put('/:id', updateTask);

// @route   PUT /api/tasks/:id/status
// @desc    Update task status
// @access  Assigned user or supervisors
router.put('/:id/status', updateTaskStatus);

// @route   PUT /api/tasks/:id/assign
// @desc    Assign task to user
// @access  Admin, RH, Bureau d'Études, Conductors of Work
router.put('/:id/assign', authorize('Administrator', 'RH', 'Bureau d\'Études', 'Conductors of Work'), assignTask);

// @route   DELETE /api/tasks/:id
// @desc    Delete task
// @access  Admin, RH, Bureau d'Études
router.delete('/:id', authorize('Administrator', 'RH', 'Bureau d\'Études'), deleteTask);

export default router; 