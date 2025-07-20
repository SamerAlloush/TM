import { Request, Response, NextFunction } from 'express';
import { InterventionRequest } from '../models/InterventionRequest';
import { User } from '../models/User';
import { AuthenticatedRequest } from '../middleware/auth';
import { WorkshopService } from '../services/workshopService';

// @desc    Submit new intervention request
// @route   POST /api/intervention-requests
// @access  Worker, Conductors of Work, Project Manager, Administrator
export const submitInterventionRequest = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      title,
      description,
      priority,
      relatedSite,
      relatedTask,
      equipmentLocation,
      equipmentDetails,
      isEmergency,
      attachments
    } = req.body;

    // Prepare the intervention request data, handling undefined optional fields
    const interventionRequestData: any = {
      title,
      description,
      priority: priority || 'Medium',
      submittedBy: req.user.id,
      equipmentLocation,
      equipmentDetails,
      isEmergency: isEmergency || false,
      attachments: attachments || []
    };

    // Only add optional fields if they have valid values (not undefined, null, or empty string)
    if (relatedSite && relatedSite !== 'undefined' && relatedSite !== '') {
      interventionRequestData.relatedSite = relatedSite;
    }
    
    if (relatedTask && relatedTask !== 'undefined' && relatedTask !== '') {
      interventionRequestData.relatedTask = relatedTask;
    }

    // Create the intervention request
    const interventionRequest = await InterventionRequest.create(interventionRequestData);

    // Add initial log entry
    await interventionRequest.addTransferLog(
      'Request Submitted',
      req.user.id,
      `Submitted by ${req.user.firstName} ${req.user.lastName} (${req.user.role})`
    );

    // Automatically transfer to workshop
    await transferRequestToWorkshop(interventionRequest, req.user.id);

    // Populate the response
    const populatedRequest = await InterventionRequest.findById(interventionRequest._id)
      .populate('submittedBy', 'firstName lastName email role')
      .populate('relatedSite', 'name address city')
      .populate('relatedTask', 'title description')
      .populate('workshopAssignedTo', 'firstName lastName email')
      .populate('transferLog.performedBy', 'firstName lastName role')
      .populate('comments.user', 'firstName lastName role');

    // Emit real-time notification to workshop users
    const socketManager = (global as any).socketManager;
    if (socketManager) {
      await socketManager.emitNewInterventionRequest(populatedRequest);
    }

    res.status(201).json({
      success: true,
      message: 'Intervention request submitted and transferred to workshop successfully',
      data: populatedRequest
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all intervention requests (role-based)
// @route   GET /api/intervention-requests
// @access  Private (role-based filtering)
export const getInterventionRequests = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, priority, page = 1, limit = 20, search } = req.query;
    
    // Build query based on user role
    let query: any = {};
    
    // Role-based filtering
    if (req.user.role === 'Worker' || req.user.role === 'Conductors of Work') {
      // Can only see their own requests
      query.submittedBy = req.user.id;
    } else if (req.user.role === 'Project Manager') {
      // Can see requests from their assigned sites (if applicable)
      if (req.user.assignedSites && req.user.assignedSites.length > 0) {
        query.$or = [
          { submittedBy: req.user.id },
          { relatedSite: { $in: req.user.assignedSites } }
        ];
      } else {
        query.submittedBy = req.user.id;
      }
    } else if (req.user.role === 'Workshop') {
      // Workshop can see all transferred requests
      query.status = { $in: ['Transferred to Workshop', 'In Progress', 'Completed'] };
    }
    // Administrator and other management roles can see all requests

    // Apply filters
    if (status) {
      query.status = status;
    }
    if (priority) {
      query.priority = priority;
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { equipmentLocation: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const requests = await InterventionRequest.find(query)
      .populate([
        { path: 'submittedBy', select: 'firstName lastName email role' },
        { path: 'relatedSite', select: 'name address city' },
        { path: 'relatedTask', select: 'title description' },
        { path: 'workshopAssignedTo', select: 'firstName lastName email' }
      ])
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum);

    const total = await InterventionRequest.countDocuments(query);

    res.status(200).json({
      success: true,
      count: requests.length,
      total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      },
      data: requests
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single intervention request
// @route   GET /api/intervention-requests/:id
// @access  Private (role-based access)
export const getInterventionRequest = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const request = await InterventionRequest.findById(req.params.id)
      .populate('submittedBy', 'firstName lastName email role')
      .populate('relatedSite', 'name address city status')
      .populate('relatedTask', 'title description status')
      .populate('workshopAssignedTo', 'firstName lastName email role')
      .populate('transferLog.performedBy', 'firstName lastName role')
      .populate('comments.user', 'firstName lastName role');

    if (!request) {
      res.status(404).json({
        success: false,
        error: 'Intervention request not found'
      });
      return;
    }

    // Check access permissions
    const hasAccess = checkRequestAccess(request, req.user);
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: 'Not authorized to access this intervention request'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: request
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update intervention request status (Workshop/Admin only)
// @route   PUT /api/intervention-requests/:id/status
// @access  Workshop, Administrator
export const updateRequestStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, workshopNotes, estimatedCompletionDate } = req.body;

    const request = await InterventionRequest.findById(req.params.id);
    if (!request) {
      res.status(404).json({
        success: false,
        error: 'Intervention request not found'
      });
      return;
    }

    // Check if user can update status
    if (req.user.role !== 'Workshop' && req.user.role !== 'Administrator') {
      res.status(403).json({
        success: false,
        error: 'Not authorized to update request status'
      });
      return;
    }

    // Store old status for notification
    const oldStatus = request.status;

    // Update fields
    request.status = status;
    if (workshopNotes) request.workshopNotes = workshopNotes;
    if (estimatedCompletionDate) request.estimatedCompletionDate = new Date(estimatedCompletionDate);
    if (status === 'Completed') request.actualCompletionDate = new Date();

    // Add log entry
    await request.addTransferLog(
      `Status Updated to ${status}`,
      req.user.id,
      workshopNotes || 'Status updated by workshop'
    );

    await request.save();

    const updatedRequest = await InterventionRequest.findById(request._id)
      .populate('submittedBy', 'firstName lastName email role')
      .populate('relatedSite', 'name address city')
      .populate('workshopAssignedTo', 'firstName lastName email')
      .populate('transferLog.performedBy', 'firstName lastName role');

    // Emit real-time status update notification
    const socketManager = (global as any).socketManager;
    if (socketManager) {
      socketManager.emitInterventionStatusUpdate(updatedRequest, req.user, oldStatus);
    }

    res.status(200).json({
      success: true,
      message: 'Request status updated successfully',
      data: updatedRequest
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add comment to intervention request
// @route   POST /api/intervention-requests/:id/comments
// @access  Private (request participants + workshop + admin)
export const addComment = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'Comment text is required'
      });
      return;
    }

    const request = await InterventionRequest.findById(req.params.id);
    if (!request) {
      res.status(404).json({
        success: false,
        error: 'Intervention request not found'
      });
      return;
    }

    // Check access permissions
    const hasAccess = checkRequestAccess(request, req.user);
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: 'Not authorized to comment on this request'
      });
      return;
    }

    const isFromWorkshop = req.user.role === 'Workshop';
    await request.addComment(req.user.id, text.trim(), isFromWorkshop);

    // Add log entry for comment
    await request.addTransferLog(
      'Comment Added',
      req.user.id,
      `Comment added by ${req.user.firstName} ${req.user.lastName}`
    );

    const updatedRequest = await InterventionRequest.findById(request._id)
      .populate('comments.user', 'firstName lastName role')
      .populate('transferLog.performedBy', 'firstName lastName role')
      .populate('submittedBy', 'firstName lastName email role')
      .populate('workshopAssignedTo', 'firstName lastName email role');

    // Emit real-time comment notification
    const socketManager = (global as any).socketManager;
    if (socketManager && updatedRequest) {
      const latestComment = updatedRequest.comments[updatedRequest.comments.length - 1];
      socketManager.emitInterventionComment(updatedRequest, latestComment);
    }

    res.status(200).json({
      success: true,
      message: 'Comment added successfully',
      data: {
        comments: updatedRequest?.comments,
        transferLog: updatedRequest?.transferLog
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign request to workshop member
// @route   PUT /api/intervention-requests/:id/assign
// @access  Workshop, Administrator
export const assignToWorkshop = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { assignedTo, estimatedCompletionDate } = req.body;

    const request = await InterventionRequest.findById(req.params.id);
    if (!request) {
      res.status(404).json({
        success: false,
        error: 'Intervention request not found'
      });
      return;
    }

    // Verify assigned user exists and is workshop member
    const assignedUser = await User.findById(assignedTo);
    if (!assignedUser || assignedUser.role !== 'Workshop') {
      res.status(400).json({
        success: false,
        error: 'Invalid workshop member assignment'
      });
      return;
    }

    request.workshopAssignedTo = assignedTo;
    request.status = 'In Progress';
    if (estimatedCompletionDate) {
      request.estimatedCompletionDate = new Date(estimatedCompletionDate);
    }

    await request.addTransferLog(
      'Assigned to Workshop Member',
      req.user.id,
      `Assigned to ${assignedUser.firstName} ${assignedUser.lastName}`
    );

    await request.save();

    const updatedRequest = await InterventionRequest.findById(request._id)
      .populate('submittedBy', 'firstName lastName email role')
      .populate('workshopAssignedTo', 'firstName lastName email role')
      .populate('transferLog.performedBy', 'firstName lastName role');

    // Emit real-time assignment notification
    const socketManager = (global as any).socketManager;
    if (socketManager) {
      socketManager.emitInterventionStatusUpdate(updatedRequest, req.user, 'Transferred to Workshop');
    }

    res.status(200).json({
      success: true,
      message: 'Request assigned successfully',
      data: updatedRequest
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dashboard statistics for intervention requests
// @route   GET /api/intervention-requests/stats
// @access  Private (role-based)
export const getInterventionStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    let query: any = {};

    // Role-based filtering for stats
    if (req.user.role === 'Worker' || req.user.role === 'Conductors of Work') {
      query.submittedBy = req.user.id;
    } else if (req.user.role === 'Project Manager') {
      if (req.user.assignedSites && req.user.assignedSites.length > 0) {
        query.$or = [
          { submittedBy: req.user.id },
          { relatedSite: { $in: req.user.assignedSites } }
        ];
      } else {
        query.submittedBy = req.user.id;
      }
    } else if (req.user.role === 'Workshop') {
      query.status = { $in: ['Transferred to Workshop', 'In Progress', 'Completed'] };
    }

    const [statusStats, priorityStats, recentRequests] = await Promise.all([
      InterventionRequest.aggregate([
        { $match: query },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      InterventionRequest.aggregate([
        { $match: query },
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ]),
      InterventionRequest.find(query)
        .populate('submittedBy', 'firstName lastName role')
        .populate('relatedSite', 'name')
        .sort({ createdAt: -1 })
        .limit(5)
    ]);

    res.status(200).json({
      success: true,
      data: {
        statusBreakdown: statusStats,
        priorityBreakdown: priorityStats,
        recentRequests
      }
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to check request access permissions
function checkRequestAccess(request: any, user: any): boolean {
  // Administrator and Workshop can access all
  if (user.role === 'Administrator' || user.role === 'Workshop') {
    return true;
  }

  // Submitter can always access their own request
  if (request.submittedBy._id.toString() === user.id) {
    return true;
  }

  // Project Manager can access requests from their sites
  if (user.role === 'Project Manager' && user.assignedSites && request.relatedSite) {
    return user.assignedSites.some((siteId: string) => siteId.toString() === request.relatedSite._id.toString());
  }

  return false;
}

// Helper function to transfer request to workshop
async function transferRequestToWorkshop(request: any, performedBy: string): Promise<void> {
  try {
    const transferResult = await WorkshopService.transferInterventionRequest(request, performedBy);
    
    if (!transferResult.success) {
      throw new Error(transferResult.error || 'Workshop transfer failed');
    }
    
    console.log(`📧 Workshop Transfer: Request ${request._id} transferred successfully`);
    console.log(`   - Notifications sent: Email=${transferResult.notificationsSent?.email}, DB=${transferResult.notificationsSent?.database}`);
    
  } catch (error) {
    console.error('Workshop transfer failed:', error);
    throw new Error('Failed to transfer request to workshop');
  }
} 