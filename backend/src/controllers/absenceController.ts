import { Request, Response, NextFunction } from 'express';
import { Absence } from '../models/Absence';
import { User } from '../models/User';
import { AuthenticatedRequest } from '../middleware/auth';
import { getSocketManager } from '../config/socket';

// @desc    Get all absences
// @route   GET /api/absences
// @access  Admin, RH
export const getAbsences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const absences = await Absence.find()
      .populate('user', 'firstName lastName email role')
      .populate('approvedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: absences.length,
      data: absences
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single absence
// @route   GET /api/absences/:id
// @access  Admin, RH, or requester
export const getAbsence = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const absence = await Absence.findById(req.params.id)
      .populate('user', 'firstName lastName email role')
      .populate('approvedBy', 'firstName lastName email');

    if (!absence) {
      res.status(404).json({
        success: false,
        error: 'Absence not found'
      });
      return;
    }

    // Check if user has access to this absence
    const hasAccess = req.user.role === 'Administrator' ||
                     req.user.role === 'RH' ||
                     absence.user._id.toString() === req.user.id;

    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: 'Not authorized to view this absence'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: absence
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create absence request
// @route   POST /api/absences
// @access  All authenticated users
export const createAbsenceRequest = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      type,
      startDate,
      endDate,
      reason,
      requestType,
      isFullDay,
      startTime,
      endTime,
      dayCount
    } = req.body;

    const absence = await Absence.create({
      user: req.user.id,
      type,
      startDate,
      endDate,
      reason,
      requestType: requestType || 'Request',
      isFullDay: isFullDay !== undefined ? isFullDay : true,
      startTime,
      endTime,
      dayCount: dayCount || 1,
      status: 'Pending'
    });

    const populatedAbsence = await Absence.findById(absence._id)
      .populate('user', 'firstName lastName email role');

    // Emit socket event to Admin and HR users for new absence request
    const socketManager = getSocketManager();
    if (socketManager && populatedAbsence) {
      // Find all Admin and HR users and emit to them
      const adminHRUsers = await User.find({ 
        role: { $in: ['Administrator', 'RH'] }, 
        isActive: true 
      }).select('_id');
      
      adminHRUsers.forEach((user: any) => {
        socketManager.emitToUser(user._id.toString(), 'absence:new', {
          absence: populatedAbsence,
          message: `New absence request from ${(populatedAbsence.user as any).firstName} ${(populatedAbsence.user as any).lastName}`,
          type: 'request'
        });
      });
    }

    res.status(201).json({
      success: true,
      data: populatedAbsence
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update absence request
// @route   PUT /api/absences/:id
// @access  Requester (if pending), Admin, RH
export const updateAbsence = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const absence = await Absence.findById(req.params.id);

    if (!absence) {
      res.status(404).json({
        success: false,
        error: 'Absence not found'
      });
      return;
    }

    // Check permissions
    const canUpdate = req.user.role === 'Administrator' ||
                     req.user.role === 'RH' ||
                     (absence.user.toString() === req.user.id && absence.status === 'Pending');

    if (!canUpdate) {
      res.status(403).json({
        success: false,
        error: 'Not authorized to update this absence request'
      });
      return;
    }

    // If user is the requester, only allow updating certain fields
    let updateData = req.body;
    if (absence.user.toString() === req.user.id && req.user.role !== 'Administrator' && req.user.role !== 'RH') {
      const allowedFields = ['type', 'startDate', 'endDate', 'reason', 'requestType', 'isFullDay', 'startTime', 'endTime', 'dayCount'];
      updateData = {};
      Object.keys(req.body).forEach(key => {
        if (allowedFields.includes(key)) {
          updateData[key] = req.body[key];
        }
      });
    }

    const updatedAbsence = await Absence.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    )
    .populate('user', 'firstName lastName email role')
    .populate('approvedBy', 'firstName lastName email');

    res.status(200).json({
      success: true,
      data: updatedAbsence
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete absence request
// @route   DELETE /api/absences/:id
// @access  Requester (if pending), Admin
export const deleteAbsence = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const absence = await Absence.findById(req.params.id);

    if (!absence) {
      res.status(404).json({
        success: false,
        error: 'Absence not found'
      });
      return;
    }

    // Check permissions
    const canDelete = req.user.role === 'Administrator' ||
                     (absence.user.toString() === req.user.id && absence.status === 'Pending');

    if (!canDelete) {
      res.status(403).json({
        success: false,
        error: 'Not authorized to delete this absence request'
      });
      return;
    }

    await absence.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Absence request deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve absence request
// @route   PUT /api/absences/:id/approve
// @access  Admin, RH
export const approveAbsence = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const absence = await Absence.findById(req.params.id);

    if (!absence) {
      res.status(404).json({
        success: false,
        error: 'Absence not found'
      });
      return;
    }

    if (absence.status !== 'Pending') {
      res.status(400).json({
        success: false,
        error: 'Only pending absence requests can be approved'
      });
      return;
    }

    absence.status = 'Approved';
    absence.approvedBy = req.user.id;
    absence.approvedAt = new Date();

    await absence.save();

    const updatedAbsence = await Absence.findById(req.params.id)
      .populate('user', 'firstName lastName email role')
      .populate('approvedBy', 'firstName lastName email');

    // Emit socket event to the requester about approval
    const socketManager = getSocketManager();
    if (socketManager && updatedAbsence) {
      socketManager.emitToUser((updatedAbsence.user as any)._id.toString(), 'absence:approved', {
        absence: updatedAbsence,
        message: `Your absence request has been approved by ${req.user.firstName} ${req.user.lastName}`,
        type: 'approval'
      });
    }

    res.status(200).json({
      success: true,
      data: updatedAbsence
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject absence request
// @route   PUT /api/absences/:id/reject
// @access  Admin, RH
export const rejectAbsence = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { rejectionReason } = req.body;
    const absence = await Absence.findById(req.params.id);

    if (!absence) {
      res.status(404).json({
        success: false,
        error: 'Absence not found'
      });
      return;
    }

    if (absence.status !== 'Pending') {
      res.status(400).json({
        success: false,
        error: 'Only pending absence requests can be rejected'
      });
      return;
    }

    absence.status = 'Rejected';
    absence.approvedBy = req.user.id;
    absence.approvedAt = new Date();
    if (rejectionReason) absence.rejectionReason = rejectionReason;

    await absence.save();

    const updatedAbsence = await Absence.findById(req.params.id)
      .populate('user', 'firstName lastName email role')
      .populate('approvedBy', 'firstName lastName email');

    // Emit socket event to the requester about rejection
    const socketManager = getSocketManager();
    if (socketManager && updatedAbsence) {
      socketManager.emitToUser((updatedAbsence.user as any)._id.toString(), 'absence:rejected', {
        absence: updatedAbsence,
        message: `Your absence request has been rejected by ${req.user.firstName} ${req.user.lastName}`,
        rejectionReason: rejectionReason || 'No reason provided',
        type: 'rejection'
      });
    }

    res.status(200).json({
      success: true,
      data: updatedAbsence
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Declare absence (admin creates absence for user)
// @route   POST /api/absences/declare
// @access  Admin, RH
export const declareAbsence = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      userId,
      type,
      startDate,
      endDate,
      reason,
      isFullDay,
      startTime,
      endTime,
      dayCount
    } = req.body;

    const absence = await Absence.create({
      user: userId,
      type,
      startDate,
      endDate,
      reason,
      requestType: 'Declaration',
      isFullDay: isFullDay !== undefined ? isFullDay : true,
      startTime,
      endTime,
      dayCount: dayCount || 1,
      status: 'Declared',
      approvedBy: req.user.id,
      approvedAt: new Date()
    });

    const populatedAbsence = await Absence.findById(absence._id)
      .populate('user', 'firstName lastName email role')
      .populate('approvedBy', 'firstName lastName email role');

    res.status(201).json({
      success: true,
      data: populatedAbsence
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user's absences
// @route   GET /api/absences/my-absences
// @access  All authenticated users
export const getMyAbsences = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const absences = await Absence.find({ user: req.user.id })
      .populate('approvedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: absences.length,
      data: absences
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get pending absence requests
// @route   GET /api/absences/pending
// @access  Admin, RH
export const getPendingAbsences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const absences = await Absence.find({ status: 'Pending' })
      .populate('user', 'firstName lastName email role')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: absences.length,
      data: absences
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get absences by user
// @route   GET /api/absences/user/:userId
// @access  Admin, RH, or own absences
export const getAbsencesByUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;

    // Check permissions
    const hasAccess = req.user.role === 'Administrator' ||
                     req.user.role === 'RH' ||
                     userId === req.user.id;

    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: 'Not authorized to view absences for this user'
      });
      return;
    }

    const absences = await Absence.find({ user: userId })
      .populate('user', 'firstName lastName email role')
      .populate('approvedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: absences.length,
      data: absences
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's absence history with calendar data
// @route   GET /api/absences/history/:userId
// @access  Private (user can view own, admin can view all)
export const getAbsenceHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const requestingUser = (req as any).user;

    // Check if user can access this data
    if (requestingUser.id !== userId && requestingUser.role !== 'Administrator' && requestingUser.role !== 'RH') {
      res.status(403).json({
        success: false,
        message: 'Not authorized to view this user\'s absence history'
      });
      return;
    }

    // Get all confirmed absences (approved or declared)
    const absences = await Absence.find({
      user: userId,
      status: { $in: ['Approved', 'Declared'] }
    })
    .populate('user', 'firstName lastName email role')
    .populate('approvedBy', 'firstName lastName email role')
    .sort({ startDate: -1 });

    // Process absences for calendar marking
    const calendarData: { [key: string]: any } = {};
    const absenceHistory: any[] = [];

    absences.forEach(absence => {
      // Add to history
      absenceHistory.push({
        _id: absence._id,
        reason: absence.reason,
        type: absence.type,
        startDate: absence.startDate,
        endDate: absence.endDate,
        status: absence.status,
        requestType: absence.requestType,
        dayCount: absence.dayCount,
        origin: absence.requestType === 'Declaration' ? 'admin' : 'user',
        approvedBy: absence.approvedBy,
        approvedAt: absence.approvedAt,
        createdAt: absence.createdAt
      });

      // Mark calendar dates
      const start = new Date(absence.startDate);
      const end = new Date(absence.endDate);
      
      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        // Skip weekends (optional - can be configured)
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip Sunday (0) and Saturday (6)
        
        calendarData[dateStr] = {
          marked: true,
          dotColor: '#ff4444', // Red for absence
          activeOpacity: 0.8,
          selectedColor: '#ff4444',
          absent: true,
          absenceInfo: {
            reason: absence.reason,
            type: absence.type,
            status: absence.status
          }
        };
      }
    });

    // Add green dots for working days (last 90 days + next 30 days)
    const today = new Date();
    const startRange = new Date(today);
    startRange.setDate(today.getDate() - 90);
    const endRange = new Date(today);
    endRange.setDate(today.getDate() + 30);

    for (let date = new Date(startRange); date <= endRange; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();
      
      // Skip weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;
      
      // If not already marked as absent, mark as working day
      if (!calendarData[dateStr]) {
        calendarData[dateStr] = {
          marked: true,
          dotColor: '#22c55e', // Green for working day
          activeOpacity: 0.8,
          working: true
        };
      }
    }

    res.json({
      success: true,
      data: {
        absenceHistory,
        calendarData,
        stats: {
          totalAbsences: absences.length,
          totalDays: absences.reduce((sum, absence) => sum + absence.dayCount, 0),
          thisMonth: absences.filter(absence => {
            const absenceDate = new Date(absence.startDate);
            return absenceDate.getMonth() === today.getMonth() && 
                   absenceDate.getFullYear() === today.getFullYear();
          }).length
        }
      }
    });
  } catch (error) {
    console.error('Error fetching absence history:', error);
    next(error);
  }
};

// @desc    Get absence calendar data for date range
// @route   GET /api/absences/calendar/:userId
// @access  Private
export const getAbsenceCalendar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    const requestingUser = (req as any).user;

    // Check authorization
    if (requestingUser.id !== userId && requestingUser.role !== 'Administrator' && requestingUser.role !== 'RH') {
      res.status(403).json({
        success: false,
        message: 'Not authorized to view this calendar data'
      });
      return;
    }

    // Default date range if not provided
    const start = startDate ? new Date(startDate as string) : (() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 3);
      return date;
    })();
    
    const end = endDate ? new Date(endDate as string) : (() => {
      const date = new Date();
      date.setMonth(date.getMonth() + 3);
      return date;
    })();

    // Get absences in date range
    const absences = await Absence.find({
      user: userId,
      status: { $in: ['Approved', 'Declared'] },
      $or: [
        { startDate: { $gte: start, $lte: end } },
        { endDate: { $gte: start, $lte: end } },
        { 
          startDate: { $lte: start },
          endDate: { $gte: end }
        }
      ]
    });

    const calendarData: { [key: string]: any } = {};

    // Mark absence dates
    absences.forEach(absence => {
      const absenceStart = new Date(Math.max(start.getTime(), new Date(absence.startDate).getTime()));
      const absenceEnd = new Date(Math.min(end.getTime(), new Date(absence.endDate).getTime()));
      
      for (let date = new Date(absenceStart); date <= absenceEnd; date.setDate(date.getDate() + 1)) {
        const dateStr = date.toISOString().split('T')[0];
        const dayOfWeek = date.getDay();
        
        // Skip weekends
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;
        
        calendarData[dateStr] = {
          marked: true,
          dotColor: '#ff4444',
          absent: true,
          absenceInfo: {
            reason: absence.reason,
            type: absence.type,
            status: absence.status,
            id: absence._id
          }
        };
      }
    });

    // Mark working days
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay();
      
      // Skip weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;
      
      if (!calendarData[dateStr]) {
        calendarData[dateStr] = {
          marked: true,
          dotColor: '#22c55e',
          working: true
        };
      }
    }

    res.json({
      success: true,
      data: calendarData
    });
  } catch (error) {
    console.error('Error fetching calendar data:', error);
    next(error);
  }
}; 