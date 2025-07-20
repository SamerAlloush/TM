import { Request, Response, NextFunction } from 'express';
import { Task } from '../models/Task';
import { AuthenticatedRequest } from '../middleware/auth';

// @desc    Get all tasks
// @route   GET /api/tasks
// @access  Admin, RH, Bureau d'Études, Conductors of Work
export const getTasks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tasks = await Task.find()
      .populate('assignedTo', 'firstName lastName email role')
      .populate('site', 'name address city status')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single task
// @route   GET /api/tasks/:id
// @access  All authenticated users
export const getTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'firstName lastName email role phone')
      .populate('site', 'name address city status')
      .populate('createdBy', 'firstName lastName email');

    if (!task) {
      res.status(404).json({
        success: false,
        error: 'Task not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: task
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new task
// @route   POST /api/tasks
// @access  Admin, RH, Bureau d'Études, Conductors of Work
export const createTask = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      title,
      description,
      site,
      assignedTo,
      priority,
      dueDate,
      estimatedHours,
      category,
      status
    } = req.body;

    // Ensure assignedTo is an array
    const assignedToArray = Array.isArray(assignedTo) ? assignedTo : (assignedTo ? [assignedTo] : []);

    const task = await Task.create({
      title,
      description,
      site,
      assignedTo: assignedToArray,
      priority: priority || 'Medium',
      dueDate,
      estimatedHours,
      category,
      status: status || 'Not Started',
      createdBy: req.user.id
    });

    const populatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'firstName lastName email role')
      .populate('site', 'name address city')
      .populate('createdBy', 'firstName lastName email');

    res.status(201).json({
      success: true,
      data: populatedTask
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Admin, RH, Bureau d'Études, Conductors of Work, or assigned user
export const updateTask = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      res.status(404).json({
        success: false,
        error: 'Task not found'
      });
      return;
    }

    // Check if user has permission to update this task
    const isAssigned = task.assignedTo.some(userId => userId.toString() === req.user.id);
    const canUpdate = req.user.role === 'Administrator' ||
                     req.user.role === 'RH' ||
                     req.user.role === 'Bureau d\'Études' ||
                     req.user.role === 'Conductors of Work' ||
                     isAssigned ||
                     task.createdBy.toString() === req.user.id;

    if (!canUpdate) {
      res.status(403).json({
        success: false,
        error: 'Not authorized to update this task'
      });
      return;
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    ).populate('assignedTo', 'firstName lastName email role')
     .populate('site', 'name address city')
     .populate('createdBy', 'firstName lastName email');

    res.status(200).json({
      success: true,
      data: updatedTask
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Admin, RH, Bureau d'Études
export const deleteTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      res.status(404).json({
        success: false,
        error: 'Task not found'
      });
      return;
    }

    await task.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update task status
// @route   PUT /api/tasks/:id/status
// @access  Assigned user or supervisors
export const updateTaskStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, actualHours } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task) {
      res.status(404).json({
        success: false,
        error: 'Task not found'
      });
      return;
    }

    // Check if user has permission to update status
    const isAssigned = task.assignedTo.some(userId => userId.toString() === req.user.id);
    const canUpdateStatus = req.user.role === 'Administrator' ||
                           req.user.role === 'RH' ||
                           req.user.role === 'Bureau d\'Études' ||
                           req.user.role === 'Conductors of Work' ||
                           isAssigned;

    if (!canUpdateStatus) {
      res.status(403).json({
        success: false,
        error: 'Not authorized to update task status'
      });
      return;
    }

    task.status = status;
    if (actualHours) task.actualHours = actualHours;
    if (status === 'Completed') task.completedDate = new Date();

    await task.save();

    const updatedTask = await Task.findById(req.params.id)
      .populate('assignedTo', 'firstName lastName email role')
      .populate('site', 'name address city')
      .populate('createdBy', 'firstName lastName email');

    res.status(200).json({
      success: true,
      data: updatedTask
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign task to user
// @route   PUT /api/tasks/:id/assign
// @access  Admin, RH, Bureau d'Études, Conductors of Work
export const assignTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userIds } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task) {
      res.status(404).json({
        success: false,
        error: 'Task not found'
      });
      return;
    }

    // Ensure userIds is an array
    const userIdArray = Array.isArray(userIds) ? userIds : [userIds];
    task.assignedTo = userIdArray;
    await task.save();

    const updatedTask = await Task.findById(req.params.id)
      .populate('assignedTo', 'firstName lastName email role')
      .populate('site', 'name address city')
      .populate('createdBy', 'firstName lastName email');

    res.status(200).json({
      success: true,
      data: updatedTask
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get tasks by site
// @route   GET /api/tasks/site/:siteId
// @access  All authenticated users
export const getTasksBySite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tasks = await Task.find({ site: req.params.siteId })
      .populate('assignedTo', 'firstName lastName email role')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user's tasks
// @route   GET /api/tasks/my-tasks
// @access  All authenticated users
export const getMyTasks = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tasks = await Task.find({ assignedTo: req.user.id })
      .populate('site', 'name address city status')
      .populate('createdBy', 'firstName lastName email')
      .sort({ dueDate: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks
    });
  } catch (error) {
    next(error);
  }
}; 