import { Request, Response, NextFunction } from 'express';
import { Site } from '../models/Site';
import { User } from '../models/User';
import { AuthenticatedRequest } from '../middleware/auth';
import mongoose from 'mongoose';

// @desc    Get all sites
// @route   GET /api/sites
// @access  All authenticated users
export const getSites = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sites = await Site.find()
      .populate('assignedUsers', 'firstName lastName email role')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: sites.length,
      data: sites
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single site
// @route   GET /api/sites/:id
// @access  All authenticated users
export const getSite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const site = await Site.findById(req.params.id)
      .populate('assignedUsers', 'firstName lastName email role phone')
      .populate('createdBy', 'firstName lastName email');

    if (!site) {
      res.status(404).json({
        success: false,
        error: 'Site not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: site
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new site
// @route   POST /api/sites
// @access  Admin, RH, Bureau d'Études
export const createSite = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      name,
      description,
      address,
      city,
      postalCode,
      startDate,
      expectedEndDate,
      status,
      priority,
      budget,
      clientName,
      clientContact
    } = req.body;

    const site = await Site.create({
      name,
      description,
      address,
      city,
      postalCode,
      startDate,
      expectedEndDate,
      status: status || 'planned',
      priority: priority || 'medium',
      budget,
      clientName,
      clientContact,
      createdBy: req.user.id
    });

    const populatedSite = await Site.findById(site._id)
      .populate('createdBy', 'firstName lastName email');

    res.status(201).json({
      success: true,
      data: populatedSite
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update site
// @route   PUT /api/sites/:id
// @access  Admin, RH, Bureau d'Études
export const updateSite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const site = await Site.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    ).populate('assignedUsers', 'firstName lastName email role')
     .populate('createdBy', 'firstName lastName email');

    if (!site) {
      res.status(404).json({
        success: false,
        error: 'Site not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: site
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete site
// @route   DELETE /api/sites/:id
// @access  Admin only
export const deleteSite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const site = await Site.findById(req.params.id);

    if (!site) {
      res.status(404).json({
        success: false,
        error: 'Site not found'
      });
      return;
    }

    await site.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Site deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign user to site
// @route   POST /api/sites/:id/assign-user
// @access  Admin, RH, Bureau d'Études
export const assignUserToSite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.body;
    const siteId = req.params.id;

    const site = await Site.findById(siteId);
    const user = await User.findById(userId);

    if (!site) {
      res.status(404).json({
        success: false,
        error: 'Site not found'
      });
      return;
    }

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    // Check if user is already assigned
    if (site.assignedUsers.includes(userId)) {
      res.status(400).json({
        success: false,
        error: 'User is already assigned to this site'
      });
      return;
    }

    site.assignedUsers.push(new mongoose.Types.ObjectId(userId));
    user.assignedSites.push(new mongoose.Types.ObjectId(siteId));

    await site.save();
    await user.save();

    const updatedSite = await Site.findById(siteId)
      .populate('assignedUsers', 'firstName lastName email role');

    res.status(200).json({
      success: true,
      data: updatedSite
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove user from site
// @route   DELETE /api/sites/:id/remove-user/:userId
// @access  Admin, RH, Bureau d'Études
export const removeUserFromSite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id: siteId, userId } = req.params;

    const site = await Site.findById(siteId);
    const user = await User.findById(userId);

    if (!site) {
      res.status(404).json({
        success: false,
        error: 'Site not found'
      });
      return;
    }

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    // Remove user from site
    site.assignedUsers = site.assignedUsers.filter(id => id.toString() !== userId);
    user.assignedSites = user.assignedSites.filter(id => id.toString() !== siteId);

    await site.save();
    await user.save();

    const updatedSite = await Site.findById(siteId)
      .populate('assignedUsers', 'firstName lastName email role');

    res.status(200).json({
      success: true,
      data: updatedSite
    });
  } catch (error) {
    next(error);
  }
}; 