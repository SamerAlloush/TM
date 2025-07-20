import { Response, NextFunction } from 'express';
import { User } from '../models/User';
import { AuthenticatedRequest } from '../middleware/auth';

// @desc    Get all users
// @route   GET /api/users
// @access  Private (Admin, RH)
export const getUsers = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const users = await User.find()
      .select('-password')
      .populate('assignedSites', 'name address city')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private (Admin, RH, or own profile)
export const getUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('assignedSites', 'name address city status');

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    // Check if user can access this profile
    if (req.user.role !== 'Administrator' && 
        req.user.role !== 'RH' && 
        req.user.id !== req.params.id) {
      res.status(403).json({
        success: false,
        error: 'Not authorized to access this profile'
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

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Admin, RH)
export const updateUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const allowedFields = ['firstName', 'lastName', 'phone', 'address', 'isActive', 'role', 'assignedSites', 'permissions'];
    const updateData: any = {};

    // Only allow certain fields to be updated
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.params.id,
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

// @desc    Delete user (deactivate)
// @route   DELETE /api/users/:id
// @access  Private (Admin only)
export const deleteUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    // Don't allow deletion of own account
    if (req.user.id === req.params.id) {
      res.status(400).json({
        success: false,
        error: 'Cannot delete your own account'
      });
      return;
    }

    // Deactivate instead of deleting
    user.isActive = false;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'User deactivated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get users by role
// @route   GET /api/users/role/:role
// @access  Private
export const getUsersByRole = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { role } = req.params;
    
    const validRoles = [
      'Administrator',
      'RH',
      'Purchase Department',
      'Worker',
      'Workshop',
      'Conductors of Work',
      'Accounting',
      'Bureau d\'Études',
      'Project Manager'
    ];

    if (!validRoles.includes(role)) {
      res.status(400).json({
        success: false,
        error: 'Invalid role specified'
      });
      return;
    }

    const users = await User.find({ role, isActive: true })
      .select('-password')
      .sort({ firstName: 1, lastName: 1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get active users
// @route   GET /api/users/active
// @access  Private
export const getActiveUsers = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const users = await User.find({ isActive: true })
      .select('-password')
      .populate('assignedSites', 'name')
      .sort({ firstName: 1, lastName: 1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get users for messaging/contacts (limited info for all authenticated users)
// @route   GET /api/users/contacts
// @access  Private (All authenticated users)
export const getMessagingContacts = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Return only essential info needed for messaging, exclude current user
    const users = await User.find({ 
      isActive: true,
      _id: { $ne: req.user.id } // Exclude current user
    })
      .select('firstName lastName email role')
      .sort({ firstName: 1, lastName: 1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign user to sites
// @route   PUT /api/users/:id/assign-sites
// @access  Private (Admin, RH, Conductors)
export const assignUserToSites = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { siteIds } = req.body;

    if (!Array.isArray(siteIds)) {
      res.status(400).json({
        success: false,
        error: 'Site IDs must be an array'
      });
      return;
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { assignedSites: siteIds },
      { new: true, runValidators: true }
    ).select('-password').populate('assignedSites', 'name address city');

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

// @desc    Update user status (activate/deactivate)
// @route   PUT /api/users/:id/status
// @access  Private (Admin, RH)
export const updateUserStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { isActive } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    // Don't allow deactivation of own account
    if (req.user.id === req.params.id && !isActive) {
      res.status(400).json({
        success: false,
        error: 'Cannot deactivate your own account'
      });
      return;
    }

    user.isActive = isActive;
    await user.save();

    const updatedUser = await User.findById(req.params.id)
      .select('-password')
      .populate('assignedSites', 'name address city');

    res.status(200).json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
}; 